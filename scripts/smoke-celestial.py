#!/usr/bin/env python3
"""Smoke the boot: every manifest dataset kind loads,
its tier draws, and the boot survives the wider
manifest.

    python3 scripts/smoke-celestial.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROMIUM_ARGS = [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--no-sandbox",
]


def main() -> int:
    from playwright.sync_api import sync_playwright

    env = {}
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip().strip("\"'")
    url = f"http://{env.get('HOST', '127.0.0.1')}:{env.get('PORT', '8123')}/web/index.html"

    problems: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=CHROMIUM_ARGS)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda error: problems.append(str(error)))
        page.on(
            "console",
            lambda message: problems.append(message.text)
            if message.type == "error"
            else None,
        )
        page.goto(url, wait_until="load")
        page.wait_for_function(
            "window.__atlas && window.__atlas.stats.smallBodies !== undefined"
            " && window.__atlas.stats.comets !== undefined"
            " && window.__atlas.stats.majorPlanets !== undefined"
            " && window.__atlas.stats.satellites !== undefined"
            " && window.__atlas.stats.galaxies !== undefined"
            " && window.__atlas.stats.blackHoles !== undefined",
            timeout=60_000,
            polling=100,
        )
        stats = page.evaluate("window.__atlas.stats")
        backend = page.evaluate("window.__atlas.stats.backend")
        browser.close()

    print(json.dumps({"url": url, "backend": backend,
                      "stats": stats, "pageErrors": problems},
                     indent=2))
    if problems:
        print("page errors during the run", file=sys.stderr)
        return 1
    expected = {
        "smallBodies": 500,
        "comets": 1769,
        "majorPlanets": 8,
        "satellites": 21,
        "galaxies": 10618,
        "blackHoles": 33,
    }
    for key, wanted in expected.items():
        drew = stats.get(key)
        if drew != wanted:
            print(f"expected {wanted} {key}, drew {drew}",
                  file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
