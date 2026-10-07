#!/usr/bin/env python3
"""Smoke the boot: every manifest dataset kind loads,
its tier draws, the boot survives the wider manifest,
and the known-bodies menu is a view over exactly what
loaded — a kind lists its bodies, a body flies, and a
typed name is the same ask as a menu pick.

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
    counts and flags; a kind lists its bodies,
    brightest first and capped with the count
    beside it; a body flies, opens its card and
    exports with its flag; and a typed name is
    the same ask as a menu pick.

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

    def click_active():
        """Click the selected row — the row's own ask."""
        return page.evaluate(
            """(() => {
              const row = document.querySelector(
                '.menu-entry[data-active]');
              if (!row) return null;
              const entry = row.dataset.menuEntry;
              row.click();
              return {
                entry,
                hidden: document.getElementById('menu').hidden,
                active: document.querySelector(
                  '.menu-entry[data-active] .menu-name')
                  ?.textContent ?? null,
                subtitle: document.querySelector(
                  '[data-menu=subtitle]')?.textContent ?? null,
              };
            })()""")

    # `b` opens on the kinds.
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
    # ArrowDown moves the selection, ArrowUp moves back.
    moved = dispatch("ArrowDown")
    if moved["active"] != "comets":
        problems.append(
            f"menu: arrows did not move "
            f"({opened['active']} -> {moved['active']})")
    back = dispatch("ArrowUp")
    if back["active"] != "small bodies":
        problems.append(
            f"menu: arrows did not move back ({back['active']})")
    # Enter on a kind lists its bodies: brightest
    # first, capped, the cap saying what it shows.
    drilled = click_active()
    wanted = f"small bodies — 100 brightest of {stats['smallBodies']:,}"
    if drilled["subtitle"] != wanted:
        problems.append(
            f"menu: drilling drew '{drilled['subtitle']}', "
            f"not '{wanted}'")
    bodies = page.evaluate(
        """[...document.querySelectorAll('.menu-entry')].map((row) => ({
          id: row.dataset.menuEntry,
          name: row.querySelector('.menu-name').textContent,
          distance: row.querySelector('.menu-count').textContent,
          flag: row.querySelector('.menu-flag').dataset.menuFlag,
        }))"""
    )
    if len(bodies) != 100:
        problems.append(f"menu: {len(bodies)} bodies listed, not 100")
    for body in bodies[:10]:
        if body["flag"] != "MEASURED":
            problems.append(f"menu: {body['name']} flag {body['flag']}")
        if not body["distance"].endswith("AU"):
            problems.append(
                f"menu: {body['name']} distance {body['distance']}")
    # Enter on a body flies to it: the route
    # carries the target's name, the first
    # waypoint ("here") is underway, the card
    # opens cited, the panel closes.
    picked = click_active()
    page.wait_for_timeout(400)
    route = page.evaluate("window.__atlas.stats.route ?? null")
    waypoint = page.evaluate(
        "document.querySelector('[data-hud=waypoint]')?.textContent"
        " ?? null")
    card_name = page.evaluate(
        "document.querySelector('[data-fact=name]')?.textContent"
        " ?? null")
    card_prov = page.evaluate(
        "document.querySelector('[data-fact=provenance]')?.textContent"
        " ?? null")
    wanted_route = f"flight to {picked['active']}"
    if route != wanted_route:
        problems.append(
            f"menu: the pick did not fly "
            f"(route {route!r}, wanted {wanted_route!r})")
    if waypoint != "here":
        problems.append(
            f"menu: the flight is not underway "
            f"(waypoint {waypoint!r})")
    if card_name != picked["active"]:
        problems.append(
            f"menu: the card names {card_name}, "
            f"the pick was {picked['active']}")
    if "nasa.jpl.sbdb" not in (card_prov or ""):
        problems.append(f"menu: the card is not cited ({card_prov})")
    if not picked["hidden"]:
        problems.append("menu: a pick did not close the panel")
    # A typed name is the same ask: the same flight.
    searched = page.evaluate(
        """(name) => {
          const box = document.getElementById('search');
          box.value = name;
          box.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', bubbles: true, cancelable: true,
          }));
          return window.__atlas.stats.route ?? null;
        }""",
        picked["active"],
    )
    if searched != route:
        problems.append(
            f"menu: search flew to {searched!r}, "
            f"the menu flew to {route!r}")
    # The export carries the picked row, with the
    # flag its tile holds.
    try:
        with page.expect_download() as download_info:
            page.evaluate("document.getElementById('export').click()")
        download = download_info.value
        csv_text = Path(download.path()).read_text(encoding="utf-8")
        row = next(
            (line for line in csv_text.splitlines()
             if line.startswith(f"{picked['entry']},")),
            None,
        )
        if row is None:
            problems.append(
                f"menu: the export holds no row for {picked['entry']}")
        elif "MEASURED" not in row.split(",")[1]:
            problems.append(
                f"menu: the exported row is not flagged: {row[:80]}")
    except TimeoutError as error:
        problems.append(f"menu: the export did not download ({error})")
    # Escape backs out of a list, then out of the
    # menu; Tab never leaves the panel.
    dispatch("b", None)
    escaped = dispatch("Escape")
    if not escaped["hidden"]:
        problems.append("menu: Escape did not close the panel")
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
        "drilled": drilled["subtitle"],
        "picked": picked["active"],
        "route": route,
        "waypoint": waypoint,
        "searched": searched,
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
