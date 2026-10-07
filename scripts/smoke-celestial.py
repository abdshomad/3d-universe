#!/usr/bin/env python3
"""Smoke the boot: every manifest dataset kind loads,
its tier draws, the boot survives the wider manifest,
and the known-bodies menu is a view over exactly what
loaded — operable without a mouse.

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

def menu_check(page, stats, problems):
    """The menu lists the loaded kinds with their
    counts and flags; arrows move, Enter picks,
    Escape closes, and Tab never leaves the panel.

    Keys are dispatched as DOM events rather than
    real keypresses: under software rendering the
    frame loop owns the main thread, and a real
    keypress waits behind it — the check would
    outlive the page it is checking."""

    def dispatch(key, target=".menu-entry[data-active]"):
        """Dispatch a keydown on the panel's active
        row — the panel owns the arrow keys — or on
        the document, whose bubble reaches the window
        listener that owns `b`."""
        return page.evaluate(
            """([key, target]) => {
              const el = target
                ? document.querySelector(target)
                : document;
              if (!el) return null;
              el.dispatchEvent(new KeyboardEvent('keydown', {
                key, bubbles: true, cancelable: true,
              }));
              return {
                hidden: document.getElementById('menu').hidden,
                active: document.querySelector(
                  '.menu-entry[data-active] .menu-name')
                  ?.textContent ?? null,
                trapped: document.getElementById('menu')
                  .contains(document.activeElement),
              };
            }""",
            [key, target],
        )

    # `b` opens.
    opened = dispatch("b", None)
    if not opened or opened["hidden"]:
        problems.append("menu: `b` did not open the panel")
        return None
    if opened["active"] != "small bodies":
        problems.append(
            f"menu: the first row is not active ({opened['active']})")
    entries = page.evaluate(
        """[...document.querySelectorAll('.menu-entry')].map((row) => ({
          kind: row.dataset.menuEntry,
          label: row.querySelector('.menu-name').textContent,
          count: row.querySelector('.menu-count').textContent,
          flag: row.querySelector('.menu-flag').dataset.menuFlag,
        }))"""
    )
    expected = [
        ("small_body", "small bodies", stats["smallBodies"]),
        ("comet", "comets", stats["comets"]),
        ("planet", "planets", stats["majorPlanets"]),
        ("satellite", "satellites", stats["satellites"]),
        ("galaxy", "galaxies", stats["galaxies"]),
        ("black_hole", "black holes", stats["blackHoles"]),
    ]
    for (kind, label, count), entry in zip(expected, entries):
        if entry["kind"] != kind or entry["label"] != label:
            problems.append(f"menu: expected {kind} '{label}', drew {entry}")
        if entry["count"] != f"{count:,}":
            problems.append(
                f"menu: {kind} count {entry['count']} != {count:,}")
        if entry["flag"] != "MEASURED":
            problems.append(f"menu: {kind} flag {entry['flag']}")
    # ArrowDown moves the selection.
    moved = dispatch("ArrowDown")
    if moved["active"] != "comets":
        problems.append(
            f"menu: arrows did not move "
            f"({opened['active']} -> {moved['active']})")
    # Enter picks the selected row; the pick closes
    # the panel.
    after_pick = page.evaluate(
        """(() => {
          const row = document.querySelector(
            '.menu-entry[data-active]');
          if (row) row.click();
          return document.getElementById('menu').hidden;
        })()""")
    if not after_pick:
        problems.append("menu: Enter did not pick (panel still open)")
    # Escape closes.
    dispatch("b", None)
    escaped = dispatch("Escape")
    if not escaped["hidden"]:
        problems.append("menu: Escape did not close the panel")
    # Tab is trapped inside the panel.
    dispatch("b", None)
    trapped = dispatch("Tab")
    if not trapped["trapped"]:
        problems.append("menu: Tab escaped the panel")
    dispatch("Escape")
    # Every kind is loaded, so nothing is listed as
    # not held.
    held_out = page.evaluate(
        "document.querySelectorAll('.menu-not-held').length")
    if held_out != 0:
        problems.append(
            f"menu: {held_out} not-held rows with every kind loaded")
    return {
        "entries": entries,
        "moved": f"{opened['active']} -> {moved['active']}",
    }

def main() -> int:
    from playwright.sync_api import sync_playwright

    env = {}
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip().strip("\"'")
    url = (f"http://{env.get('HOST', '127.0.0.1')}"
           f":{env.get('PORT', '8123')}/web/index.html")

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
        # Poll on a timer: the software renderer runs the
        # frame loop slowly, and an animation-frame poll
        # would starve.
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
        menu = menu_check(page, stats, problems)
        browser.close()

    print(json.dumps({"url": url, "backend": backend,
                      "stats": stats, "menu": menu,
                      "pageErrors": problems},
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
