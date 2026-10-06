#!/usr/bin/env python3
"""First-run harness: drive the atlas the way a person drives it.

    python3 scripts/first-run.py [--out docs/perf/first-run.json]

Lands cold, reads the opening, lets the tour and the onboarding run,
flies the guided journey, searches for a star, clicks a star and an
event, exports the slice, opens the shared link in a fresh page, and
flies out toward the modelled tier. Every step records what it saw;
the run fails on any console error, any failed check, or any
artefact that is not the one a person asked for. Exits non-zero so
CI can gate on it.

The export and the link run before the outward flight: a person
asks for them while stars are still on screen, and that is where
they can be checked. The outward flight ends with the tier's
receipt — the frame budget may defer an optional tier, and on the
software profile it does, so the harness records which of the three
states it saw (visible, deferred, not reached yet) instead of
failing silently or passing blindly.

Launches Chromium with SwiftShader: this is the software profile, a
floor rather than a GPU result. Timings recorded here (cold start,
seconds to the modelled tier) are measurements of this machine and
belong to the re-measurement task, not to this harness's verdict.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROMIUM_ARGS = [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--no-sandbox",
]

# Project a scene layer's members through the same matrices three uses
# on a click, and return the on-screen one nearest the centre. This is
# what pickEventAt and pickCellAt do; doing it here tells the harness
# where a click will land, so the drive clicks what a person sees.
FIND_ON_SCREEN = """(kind) => {
  const atlas = window.__atlas;
  const rect = document.getElementById('view').getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const wants = kind === 'spark'
    ? (c) => c.userData && c.userData.events
    : (c) => c.userData && c.userData.cellIndices && c.visible;
  const layer = atlas.scene.children.find(wants);
  if (!layer) return null;
  const pos = layer.geometry.attributes.position.array;
  const count = pos.length / 3;
  const lm = layer.matrixWorld.elements;
  const mi = atlas.camera.matrixWorldInverse.elements;
  const pj = atlas.camera.projectionMatrix.elements;
  let best = null;
  for (let i = 0; i < count; i += 1) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    const wx = lm[0] * x + lm[4] * y + lm[8] * z + lm[12];
    const wy = lm[1] * x + lm[5] * y + lm[9] * z + lm[13];
    const wz = lm[2] * x + lm[6] * y + lm[10] * z + lm[14];
    const vx = mi[0] * wx + mi[4] * wy + mi[8] * wz + mi[12];
    const vy = mi[1] * wx + mi[5] * wy + mi[9] * wz + mi[13];
    const vz = mi[2] * wx + mi[6] * wy + mi[10] * wz + mi[14];
    if (vz >= 0) continue; // behind the camera
    const sx = pj[0] * vx + pj[4] * vy + pj[8] * vz + pj[12];
    const sy = pj[1] * vx + pj[5] * vy + pj[9] * vz + pj[13];
    const sw = pj[3] * vx + pj[7] * vy + pj[11] * vz + pj[15];
    if (sw <= 0) continue;
    const ndcX = sx / sw, ndcY = sy / sw;
    if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1) continue;
    const px = rect.left + ((ndcX + 1) / 2) * rect.width;
    const py = rect.top + (1 - (ndcY + 1) / 2) * rect.height;
    const d = (px - cx) ** 2 + (py - cy) ** 2;
    if (!best || d < best.d) best = { d, x: px, y: py };
  }
  return best ? { x: best.x, y: best.y } : null;
}"""

READ_CARD = """() => {
  const card = document.querySelector('[data-hud=factcard]');
  return {
    cardVisible: card ? !card.hidden : false,
    name: card ? card.querySelector('[data-fact=name]').textContent : '',
    provenance: card ? card.querySelector('[data-fact=provenance]').textContent : '',
    rows: card ? card.querySelector('[data-fact=rows]').textContent : '',
  };
}"""

# The tier's own numbers: the fade starts at 1 Mpc (lss-layer.js),
# and the frame budget gives an optional tier 20 ms a frame.
MPC_IN_PC = 1e6
TIER_BUDGET_MS = 20


def read_card(page):
    return page.evaluate(READ_CARD)


def wait_settled(page, timeout=240_000):
    """Wait for the camera to stop moving — a flight that has arrived.

    The waypoint alone cannot say: a finished route parks at its last
    shot under its own name, and free flight says 'free flight' both
    when parked and when flying. Two position samples that agree do.
    """
    deadline = time.monotonic() + timeout / 1000
    while time.monotonic() < deadline:
        first = page.evaluate("window.__atlas.rig.positionMetres")
        page.wait_for_timeout(2_000)
        second = page.evaluate("window.__atlas.rig.positionMetres")
        drift = max(abs(a - b) for a, b in zip(first, second))
        if drift <= 1.0:
            return True
    return False


def run(url: str, out: Path | None) -> int:
    from playwright.sync_api import sync_playwright

    report: dict = {"url": url, "steps": [], "checks": [],
                    "console_errors": [], "page_errors": []}

    def step(label: str, **evidence) -> None:
        report["steps"].append({"step": label, **evidence})
        print(f"  {label}  {json.dumps(evidence)}")

    def check(name: str, ok: bool, detail: str = "") -> None:
        report["checks"].append({"check": name, "ok": bool(ok),
                                 "detail": str(detail)})
        suffix = f" — {detail}" if detail else ""
        print(("  PASS " if ok else "  FAIL ") + name + suffix)

    def attempt(name: str, action) -> bool:
        """Run one phase; a failure is recorded, never hidden."""
        try:
            action()
            return True
        except Exception as err:  # the drive's job is to find these
            check(name, False, str(err).splitlines()[0][:200])
            return False

    with sync_playwright() as p:
        browser = p.chromium.launch(args=CHROMIUM_ARGS)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        for watcher in (page,):
            watcher.on("pageerror", lambda err: report["page_errors"].append(str(err)))
            watcher.on("console", lambda msg: report["console_errors"].append(msg.text)
                       if msg.type == "error" else None)

        # 1. Land, cold. The door a visitor actually walks in.
        started = time.time()
        page.goto(url, wait_until="load")
        page.wait_for_function(
            "window.__atlas && window.__atlas.stats.points > 0", timeout=90_000)
        cold_start = time.time() - started
        step("landed", cold_start_seconds=round(cold_start, 1),
             points_drawn=page.evaluate("window.__atlas.stats.points"),
             backend=page.evaluate("window.__atlas.stats.backend"))

        # 2. The tour is offered to a new visitor, and leaves when asked.
        def tour_runs():
            page.wait_for_selector("#tour:not([hidden])", timeout=15_000)
            step("tour offered",
                 title=page.locator("#tour [data-tour=title]").inner_text())
            page.keyboard.press("Escape")
            page.wait_for_selector("#tour[hidden]", state="attached", timeout=5_000)
            check("the tour leaves when dismissed", True)
        attempt("the tour runs", tour_runs)

        # 3. The opening hint speaks once the tour is out of the way.
        def onboarding_runs():
            page.wait_for_function(
                "document.getElementById('hint').textContent.trim() !== ''",
                timeout=15_000)
            step("onboarding speaks", hint=page.locator("#hint").inner_text())
            check("the opening hint appears", True)
        attempt("the onboarding runs", onboarding_runs)

        # 4. The guided journey flies.
        def journey_flies():
            page.keyboard.press("j")
            page.wait_for_function(
                "window.__atlas.stats.waypoint && "
                "window.__atlas.stats.waypoint !== 'free flight'",
                timeout=30_000)
            step("journey flies",
                 waypoint=page.evaluate("window.__atlas.stats.waypoint"))
            check("the journey leaves free flight", True)
            page.wait_for_timeout(3_000)
        attempt("the journey flies", journey_flies)

        # 5. A name is typed, previewed, and flown to.
        def search_flies():
            page.fill("#search", "sirius")
            # The HUD renders in caps; a preview is compared as read.
            preview = page.locator("#search-result").inner_text().lower()
            check("the search previews the match",
                  "pc" in preview and "hip" in preview, preview)
            page.keyboard.press("Enter")
            page.wait_for_function(
                "window.__atlas.stats.route && "
                "window.__atlas.stats.route.startsWith('flight to')",
                timeout=15_000)
            step("search flies",
                 route=page.evaluate("window.__atlas.stats.route"),
                 search_result=page.evaluate("window.__atlas.stats.searchResult"))
            check("the flight names its target",
                  bool(page.evaluate("window.__atlas.stats.searchResult")))
        attempt("the search flies", search_flies)

        # 6. Click a star. The reticle locks the nearest star to the
        #    view centre, so the centre is where a person clicks.
        def star_clicked():
            page.mouse.click(640, 400)
            page.wait_for_function(
                "window.__atlas.stats.picked !== null", timeout=10_000)
            card = read_card(page)
            step("star clicked", **card)
            check("a star pick names an object", bool(card["name"]))
            check("the star card cites its source", bool(card["provenance"]))
        attempt("a star is clicked", star_clicked)

        # 7. Click an event. Sparks are picked on top of stars, so the
        #    harness clicks where a spark actually is.
        def event_clicked():
            spark = None
            for _ in range(9):  # the sky moves; give it 45 s to show one
                spark = page.evaluate(FIND_ON_SCREEN, "spark")
                if spark:
                    break
                page.wait_for_timeout(5_000)
            if not spark:
                check("an event spark is on screen", False,
                      "none projected within 45 s")
                return
            before = page.evaluate("window.__atlas.stats.picked")
            page.mouse.click(spark["x"], spark["y"])
            page.wait_for_function(
                "(id) => window.__atlas.stats.picked !== null && "
                "window.__atlas.stats.picked !== id",
                arg=before, timeout=10_000)
            card = read_card(page)
            step("event clicked", **card)
            check("an event pick names an object", bool(card["name"]))
            check("the event card cites its catalogue", bool(card["provenance"]))
        attempt("an event is clicked", event_clicked)

        # 8. Export the slice, from where the visitor is standing.
        #    The file must be the one asked for: the stars actually
        #    drawn, the planets of the hosts actually drawn, each row
        #    saying what it is.
        def slice_exported():
            wait_settled(page)  # a parked view exports a stable slice
            with page.expect_download(timeout=15_000) as download_info:
                page.click("#export")
            download = download_info.value
            text = Path(download.path()).read_text(encoding="utf-8")
            rows = list(csv.reader(io.StringIO(text)))
            header, body = rows[0], rows[1:]
            flag_ix = header.index("flag")
            unflagged = [row for row in body
                         if len(row) <= flag_ix or not row[flag_ix]]
            measured = sum(1 for row in body if row[flag_ix] == "MEASURED")
            derived = sum(1 for row in body if row[flag_ix] == "DERIVED")
            reported = page.evaluate("window.__atlas.stats.exported")
            step("slice exported", filename=download.suggested_filename,
                 rows=len(body), measured=measured, derived=derived,
                 reported=reported)
            check("the slice carries rows", len(body) > 0)
            check("the slice carries the stars on screen", measured > 0,
                  f"{measured} measured rows")
            check("every row says what it is", not unflagged,
                  f"{len(unflagged)} unflagged")
            check("the file matches the counter", len(body) == reported,
                  f"{len(body)} rows vs {reported} reported")
        attempt("the slice is exported", slice_exported)

        # 9. The shared link, opened cold: the second load is the one
        #     most viewers never do, so it is the one nobody tests.
        def link_round_trips():
            wait_settled(page)
            page.wait_for_function("location.hash !== ''", timeout=10_000)
            shared = page.evaluate("location.hash")
            selection = read_card(page)["name"]
            position = page.evaluate("window.__atlas.rig.positionMetres")
            origin = page.evaluate("window.__atlas.origin.originMetres")
            check("the link carries a view", bool(shared), shared or "empty hash")
            cold_context = browser.new_context(
                viewport={"width": 1280, "height": 800})
            cold = cold_context.new_page()
            cold.on("pageerror",
                    lambda err: report["page_errors"].append(str(err)))
            cold.on("console", lambda msg: report["console_errors"].append(msg.text)
                    if msg.type == "error" else None)
            cold.goto(url + shared, wait_until="load")
            cold.wait_for_function(
                "window.__atlas && window.__atlas.stats.points > 0",
                timeout=90_000)
            cold.wait_for_function(
                "!document.querySelector('[data-hud=factcard]').hidden",
                timeout=15_000)
            card = read_card(cold)
            cold_position = cold.evaluate("window.__atlas.rig.positionMetres")
            cold_origin = cold.evaluate("window.__atlas.origin.originMetres")
            step("link opened cold", name=card["name"], hash=shared,
                 origin=origin, cold_origin=cold_origin)
            check("the selection survives the link",
                  card["name"] == selection,
                  f"{card['name']!r} vs {selection!r}")
            # The rig speaks world space; the floating origin is
            # render-space bookkeeping that differs page to page
            # without changing what the viewer sees.
            drift = max(abs(a - b) for a, b in zip(position, cold_position))
            check("the place survives the link", drift < 10.0,
                  f"{drift:.3g} m apart")
            cold_context.close()
        attempt("the link round-trips cold", link_round_trips)

        # 10. Fly out toward the modelled tier, and record what the
        #     flight found. The tier is optional: the frame budget may
        #     defer it — on the software profile it always does — and
        #     the route itself needs minutes to reach the fade-in. The
        #     harness must not fail silently or pass blindly; it says
        #     which of the three states it saw.
        def tier_reported():
            page.keyboard.press("r")
            tier_at = time.time()
            try:
                page.wait_for_function(
                    "window.__atlas.stats.lssVisible === true", timeout=150_000)
            except Exception:
                receipt = page.evaluate("""() => {
                  const a = window.__atlas;
                  const p = a.rig.positionMetres, o = a.origin.originMetres;
                  const r = Math.hypot(p[0]+o[0], p[1]+o[1], p[2]+o[2]);
                  return {
                    deferred: a.stats.lssDeferred, visible: a.stats.lssVisible,
                    fade: a.stats.lssFade, level: a.stats.lssLevel,
                    fps: Math.round(a.stats.fps * 10) / 10,
                    points: a.stats.points,
                    radius_pc: Math.round(r / 3.0856775814913673e16 * 100) / 100,
                  };
                }""")
                waited = round(time.time() - tier_at, 1)
                if receipt["deferred"]:
                    step("the tier is deferred by the frame budget",
                         seconds_waited=waited, tier_budget_ms=TIER_BUDGET_MS,
                         **receipt)
                    check("a deferred tier is recorded, not hidden", True,
                          f"frames at {receipt['fps']} fps against the "
                          f"{TIER_BUDGET_MS} ms tier budget")
                    return
                if receipt["radius_pc"] < 0.9 * MPC_IN_PC:
                    step("the route has not reached the tier",
                         seconds_waited=waited, fade_starts_pc=MPC_IN_PC,
                         **receipt)
                    check("the tier waits for the route to arrive", True,
                          f"{receipt['radius_pc']:.3g} pc flown of the "
                          f"{MPC_IN_PC:.3g} pc fade-in")
                    return
                check("the modelled tier appears", False,
                      f"in range but neither visible nor deferred: {receipt}")
                return
            seconds_to_tier = time.time() - tier_at
            step("modelled tier on screen",
                 seconds_from_search_to_tier=round(seconds_to_tier, 1),
                 level=page.evaluate("window.__atlas.stats.lssLevel"))
            badge = page.locator("[data-hud=badge]").inner_text()
            check("the badge says SIMULATED with the tier on screen",
                  "SIMULATED" in badge.upper(), badge)
            cell = page.evaluate(FIND_ON_SCREEN, "cell")
            if not cell:
                check("a modelled cell is on screen", False,
                      "none projected")
                return
            before = page.evaluate("window.__atlas.stats.picked")
            page.mouse.click(cell["x"], cell["y"])
            page.wait_for_function(
                "(id) => window.__atlas.stats.picked !== null && "
                "window.__atlas.stats.picked !== id",
                arg=before, timeout=10_000)
            card = read_card(page)
            step("cell clicked", **card)
            check("a cell pick names an object", bool(card["name"]))
        attempt("the tier is reported", tier_reported)

        browser.close()

    report["passed"] = (
        all(c["ok"] for c in report["checks"])
        and not report["console_errors"]
        and not report["page_errors"]
    )
    print(json.dumps(report, indent=2))
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nwrote {out}", file=sys.stderr)
    for key in ("console_errors", "page_errors"):
        for line in report[key]:
            print(f"{key}: {line}", file=sys.stderr)
    return 0 if report["passed"] else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=None,
                        help="write the JSON report here")
    parser.add_argument("--url", default="http://127.0.0.1:4038/web/index.html",
                        help="the page to drive")
    args = parser.parse_args()
    return run(args.url, args.out)


if __name__ == "__main__":
    raise SystemExit(main())
