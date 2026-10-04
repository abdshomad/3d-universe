#!/usr/bin/env python3
"""Performance harness: drive the fixed route, time every frame, decide pass/fail.

    python3 scripts/perf-check.py --seconds 25

The budget depends on what is actually rasterising the frame, and the budgets
live in config/perf-budgets.json so tightening the bar is an edit, not a code
change. Exits non-zero when the run misses its budget, so CI can gate on it.

This harness launches Chromium with SwiftShader, so by default it measures the
*software* profile. That is a floor, not a GPU result: it catches regressions in
the scene graph, the LOD and the tile path, and it cannot tell you what the
atlas does on real hardware. Run it with `--profile gpu` only against a browser
you have configured for hardware acceleration.
"""

from __future__ import annotations

import argparse
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


def load_env() -> dict:
    values = {}
    env_path = ROOT / ".env"
    if not env_path.exists():
        return values
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip("\"'")
    return values


def load_budgets() -> dict:
    return json.loads((ROOT / "config" / "perf-budgets.json").read_text(encoding="utf-8"))


def run(seconds: float, out: Path | None, profile: str) -> int:
    from playwright.sync_api import sync_playwright

    env = load_env()
    host = env.get("HOST", "127.0.0.1")
    port = env.get("PORT", "8123")
    url = f"http://{host}:{port}/web/index.html"
    budget = load_budgets()[profile]

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=CHROMIUM_ARGS)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        problems: list[str] = []
        page.on("pageerror", lambda error: problems.append(str(error)))
        page.goto(url, wait_until="load")
        page.wait_for_function("window.__atlas && window.__atlas.perf", timeout=60_000)

        backend = page.evaluate("window.__atlas.stats.backend")
        page.evaluate("window.__atlas.perf.start()")
        page.wait_for_timeout(int(seconds * 1000))
        report = page.evaluate(
            "(options) => window.__atlas.perf.report(options)",
            {
                "budgetFrameSeconds": budget["budgetFrameSeconds"],
                "stallSeconds": budget["stallSeconds"],
            },
        )
        waypoint = page.evaluate("window.__atlas.stats.waypoint")
        points = page.evaluate("window.__atlas.stats.points")
        page.evaluate("window.__atlas.perf.stop()")
        browser.close()

    result = {
        "url": url,
        "profile": profile,
        "backend": backend,
        "budget": budget,
        "waypointAtEnd": waypoint,
        "pointsDrawn": points,
        "pageErrors": problems,
        **report,
    }

    print(json.dumps(result, indent=2))
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"\nwrote {out}", file=sys.stderr)

    if problems:
        print("page errors during the run", file=sys.stderr)
        return 1
    return 0 if result["passed"] else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=float, default=25.0)
    parser.add_argument("--profile", choices=["software", "gpu"], default="software")
    parser.add_argument("--out", type=Path, default=ROOT / "docs" / "perf" / "last-run.json")
    args = parser.parse_args()
    return run(args.seconds, args.out, args.profile)


if __name__ == "__main__":
    raise SystemExit(main())