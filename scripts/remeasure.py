#!/usr/bin/env python3
"""Re-measurement: the numbers the plans record, on this machine.

    python3 scripts/remeasure.py [--route-seconds 25] [--park-seconds 20]

The plans record performance figures -- frame rate, the cost of
the modelled tier, the cost of parsing the field tile, cold start
-- and a figure without its machine is a story. This command
re-measures all four, with their conditions, where a person reads them.

- cold start: navigation to the first frame with points on screen.
- frame rate: the fixed route's median, p95 and worst frame times,
  judged against the software profile's budget.
- tier cost: a control window parks at 1 AU, where this machine's
  software renderer sustains the scene; the measured windows park
  5 Mpc out, inside the tier's fade band, with the tier in the
  scene and then removed. The band starves the software renderer
  (the far-field scene takes seconds per frame beyond ~1 Mpc), so
  an honest run reports not measured rather than inventing a cost.
- parse cost: the modelled field's baked tile -- fetch, parse and
  both LOD builds, timed in the page with the app's own functions.
"""

from __future__ import annotations

import argparse
import json
import platform
import socket
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from remeasure_probe import PARSE_COST, TIER_OFF, TIER_ON

ROOT = Path(__file__).resolve().parent.parent
CHROMIUM_ARGS = [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--no-sandbox",
]

PARSEC_TO_METRES = 3.0856775814913673e16
MPC_METRES = 1e6 * PARSEC_TO_METRES
AU_METRES = 1.496e11

# 5 Mpc: inside the tier's fade band (1 to 8 Mpc), where
# the fine level draws and the tier is on screen.
PARK_RADIUS_MPC = 5.0
PARK_FRAGMENT = f"#p={PARK_RADIUS_MPC * MPC_METRES},0,0&y=0.00&t=0.00"
# 1 AU: the control view, where the software renderer sustains the
# scene -- a starved window below is the renderer's limit, not the
# harness's.
CONTROL_FRAGMENT = f"#p={AU_METRES},0,0&y=0.00&t=0.00"

# Fewer frames than this is the renderer grinding, not a measurement.
MIN_FRAMES = 10


def load_budgets() -> dict:
    return json.loads(
        (ROOT / "config" / "perf-budgets.json").read_text(encoding="utf-8"))


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


def frame_summary(report: dict) -> dict:
    keys = ("count", "medianSeconds", "p95Seconds", "p99Seconds",
            "worstSeconds", "fpsFromMedian", "overBudget", "stalls")
    return {key: report[key] for key in keys}


def window(page, seconds: float, options: dict) -> dict:
    """Frame times for one window of the parked camera."""
    page.evaluate("window.__atlas.perf.start()")
    page.wait_for_timeout(int(seconds * 1000))
    return page.evaluate(
        "(options) => window.__atlas.perf.report(options)", options)


def parked_page(browser, url: str, fragment: str, errors: list[str]):
    """A page to itself, motion reduced, at the fragment's view."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        reduced_motion="reduce")
    page = context.new_page()
    page.bring_to_front()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url + fragment, wait_until="load")
    return context, page


def run(route_seconds: float, park_seconds: float, out: Path | None) -> dict:
    from playwright.sync_api import sync_playwright

    env = load_env()
    host = env.get("HOST", "127.0.0.1")
    port = env.get("PORT", "8123")
    url = f"http://{host}:{port}/web/index.html"
    errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=CHROMIUM_ARGS)
        budget = load_budgets()["software"]
        options = {"budgetFrameSeconds": budget["budgetFrameSeconds"],
                   "stallSeconds": budget["stallSeconds"]}

        # Cold start and the route's frame rate, on the first load.
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        started = time.time()
        page.goto(url, wait_until="load")
        page.wait_for_function(
            "window.__atlas && window.__atlas.stats.points > 0",
            timeout=90_000)
        cold_start = time.time() - started
        backend = page.evaluate("window.__atlas.stats.backend")
        page.evaluate("window.__atlas.perf.start()")
        page.wait_for_timeout(int(route_seconds * 1000))
        route = frame_summary(page.evaluate(
            "(options) => window.__atlas.perf.report(options)", options))
        parse_cost = page.evaluate(PARSE_COST)
        # One page renders at a time: a second page's frames
        # are starved. Every parked window gets a browser to itself.
        context.close()

        # Control: the same parked-window method at 1 AU, where
        # this machine's software renderer sustains the scene.
        control_context, control_page = parked_page(
            browser, url, CONTROL_FRAGMENT, errors)
        control_page.wait_for_function(
            "window.__atlas && window.__atlas.stats.points > 0",
            timeout=90_000)
        control_page.wait_for_timeout(2_000)
        control = frame_summary(
            window(control_page, park_seconds, options))
        control_context.close()

        # Tier cost: parked in the tier's band, toggled by membership.
        parked_context, park_page = parked_page(
            browser, url, PARK_FRAGMENT, errors)
        park_page.wait_for_function(
            "window.__atlas && window.__atlas.stats.lssVisible === true",
            timeout=90_000)
        park_page.wait_for_timeout(2_000)
        radius_mpc = park_page.evaluate(
            "Math.hypot(...window.__atlas.rig.positionMetres) / "
            f"{MPC_METRES}")
        with_tier = frame_summary(
            window(park_page, park_seconds, options))
        park_page.evaluate(TIER_OFF)
        without_tier = frame_summary(
            window(park_page, park_seconds, options))
        park_page.evaluate(TIER_ON)
        parked_context.close()
        browser.close()
    enough_frames = min(with_tier["count"], without_tier["count"]) >= MIN_FRAMES
    cost = (with_tier["medianSeconds"] - without_tier["medianSeconds"]
            if enough_frames else None)
    reason = None if enough_frames else (
        f"the software renderer sustained {control['count']} frames "
        f"at 1 AU but only {with_tier['count']} and {without_tier['count']} "
        f"in {park_seconds} s windows parked in the tier's visibility "
        f"band ({round(radius_mpc, 2)} Mpc): the far-field scene beyond "
        "about 1 Mpc takes seconds per frame under SwiftShader, so the "
        "tier's per-frame cost is not measurable on this machine"
    )
    report = {
        "url": url,
        "measured": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "machine": {
            "host": socket.gethostname(),
            "platform": platform.platform(),
            "backend": backend,
            "profile": "software (SwiftShader)",
            "viewport": "1280x800",
            "budget": budget,
        },
        "coldStartSeconds": round(cold_start, 1),
        "route": {"windowSeconds": route_seconds, **route},
        "tierCost": {
            "parkedAtMpc": round(radius_mpc, 2),
            "windowSeconds": park_seconds,
            "controlAtAU": control,
            "withTier": with_tier,
            "withoutTier": without_tier,
            "costSeconds": round(cost, 4) if cost is not None else None,
            "costPercent": round(
                100 * cost / with_tier["medianSeconds"], 1)
            if cost is not None else None,
            "valid": enough_frames,
            "reason": reason,
        },
        "parseCost": parse_cost,
        "pageErrors": errors,
    }

    print(f"cold start (navigation to first points): {report['coldStartSeconds']} s")
    print(f"frame rate on the route ({route_seconds} s): "
          f"{route['fpsFromMedian']:.1f} fps median, "
          f"p95 {1 / route['p95Seconds']:.1f} fps, "
          f"worst {1 / route['worstSeconds']:.1f} fps")
    print(f"control at 1 AU ({park_seconds} s): {control['count']} "
          f"frames, {control['fpsFromMedian']:.1f} fps median")
    tier = report["tierCost"]
    if tier["valid"]:
        print(f"tier cost at {tier['parkedAtMpc']} Mpc "
              f"({park_seconds} s windows): "
              f"{with_tier['medianSeconds'] * 1000:.1f} ms/frame with "
              f"the tier, {without_tier['medianSeconds'] * 1000:.1f} "
              f"without -- {cost * 1000:.1f} ms/frame, "
              f"{tier['costPercent']}% of the frame")
    else:
        print(f"tier cost at {tier['parkedAtMpc']} Mpc: NOT MEASURED "
              f"-- {reason}", file=sys.stderr)
    parse_ = report["parseCost"]
    print(f"parse cost ({parse_['bytes']:,} bytes): "
          f"fetch {parse_['fetchMs']} ms, parse {parse_['parseMs']} ms, "
          f"build both levels {parse_['buildMs']} ms "
          f"({parse_['points'][0]:,} + {parse_['points'][1]:,} points)")
    if errors:
        print(f"page errors: {len(errors)}", file=sys.stderr)
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nwrote {out}", file=sys.stderr)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--route-seconds", type=float, default=25.0)
    parser.add_argument("--park-seconds", type=float, default=20.0)
    parser.add_argument("--out", type=Path,
                        default=ROOT / "docs" / "perf" / "remeasure.json")
    args = parser.parse_args()
    report = run(args.route_seconds, args.park_seconds, args.out)
    return 1 if report["pageErrors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
