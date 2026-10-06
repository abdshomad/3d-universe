"""Do the shipped JSON assets still resolve to their sources?

`ingest verify` proves the baked tiles against their archives,
and `verify_events` proves the pulsars against ATNF. The rest
of the atlas rests on seven JSON assets that had no such proof:
the landmarks, the search index, the constellation figures,
the figure stars, the double stars, the exoplanets, and the
small-body sidecar a fact card reads. Every one of them is
somebody's flight path, a line on screen, or a fact card, and
a row that no longer resolves is a claim the atlas can no
longer back.

This re-runs each asset's own source query and resolves every
row back to it. Two answers are possible and both are wanted:
a row that no longer resolves (the asset is wrong), and a
value that moved (the source is live and the asset is a
snapshot of it -- reported, not failed). Where a source is
unreachable from this host, the receipt says so instead of
passing silently.

Exit codes: 0 every asset verified; 1 defects found;
2 no defects, but some assets could not be verified.

Run directly: `python3 -m ingest.verify_assets [root]`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from ingest.http import FetchError, fetch_text
from ingest.sources.landmarks import fetch_hipparcos, parse_hipparcos
from ingest.sources import sbdb
from ingest.tiles import TileError, read_tile
from ingest.verify_hipparcos import (
    check_binaries,
    check_figure_stars,
    check_landmarks,
    check_nearby,
)
from ingest.verify_relations import (
    EXOPLANET_MAX_DISTANCE_PC,
    check_constellations,
    check_exoplanets,
)

ROOT = Path(__file__).resolve().parent.parent
GAIA_TILE = ROOT / "assets/tiles/gaia-60k.u3dtile"

ASSETS = {
    "landmarks": "assets/landmarks/landmarks.json",
    "nearby": "assets/search/nearby.json",
    "constellations": "assets/relations/constellations.json",
    "figure-stars": "assets/relations/figure-stars.json",
    "binaries": "assets/relations/binaries.json",
    "exoplanets": "assets/relations/exoplanets.json",
    "small-bodies": "assets/tiles/sbdb-small-bodies.json",
}
HIPPARCOS_ASSETS = ("landmarks", "nearby", "figure-stars", "binaries")


def _load(root: Path, relative: str) -> dict:
    return json.loads((root / relative).read_text(encoding="utf-8"))


def _load_gaia_ids() -> tuple[Any, str | None]:
    """The Gaia tile's id array, or the receipt for its absence."""
    try:
        return read_tile(GAIA_TILE).ids, None
    except FileNotFoundError:
        return None, (f"{GAIA_TILE} is absent (gitignored; `ingest bake` "
                      "regenerates it) -- Gaia secondaries unverified")
    except (TileError, OSError) as exc:
        return None, f"{GAIA_TILE} is unreadable: {exc}"


def _print_report(reports: dict[str, dict], receipts: list[str]) -> None:
    for name, report in reports.items():
        print(f"{name} ({ASSETS[name]})")
        if report.get("unreachable"):
            print("  source unreachable from this host -- receipt recorded")
            continue
        resolved = f"{report['resolved']}/{report['total']}"
        if name == "landmarks":
            print(f"  {resolved} landmarks resolve against {report['source']}; "
                  "parallax, position and distance agree")
        elif name == "nearby":
            print(f"  {resolved} stars resolve against {report['source']}; every "
                  "parallax is at least 1 mas, as the builder requires")
        elif name == "figure-stars":
            print(f"  {resolved} stars resolve against {report['source']}; every star "
                  "has a parallax and is brighter than V=6.5, as the builder "
                  f"requires ({report['skipped_by_builder']} rows were skipped at build)")
        elif name == "binaries":
            print(f"  {resolved} pairs resolve: primaries "
                  f"{report['hipparcos_primaries']} in Hipparcos, "
                  f"{report['gaia_primaries']} in the Gaia tile; "
                  f"secondaries {report['hipparcos_secondaries']} in "
                  f"Hipparcos, {report['gaia_secondaries']} in the Gaia tile")
            if report.get("gaia_unverified"):
                print(f"  {report['gaia_unverified']} Gaia components "
                      "unverified: the tile is not on this host")
            wds = report.get("wds_ids")
            if wds is not None:
                print(f"  {wds['distinct'] - len(wds['missing'])}/{wds['distinct']} distinct "
                      "WDS designations resolve against B/wds/wds")
            elif report.get("wds_receipt"):
                print(f"  WDS designations unverified: {report['wds_receipt']}")
        elif name == "constellations":
            print(f"  {resolved} figures resolve against {report['source']}; names, "
                  "segment counts and coordinates agree")
        elif name == "exoplanets":
            print(f"  {resolved} planets resolve against {report['source']} within "
                  f"{EXOPLANET_MAX_DISTANCE_PC:g} pc")
            revised = report["revised"]
            if revised:
                largest = max(revised, key=lambda row: abs(row["delta_pc"]))
                print(f"  the archive moved since the asset was written: {len(revised)} "
                      f"distances revised (largest {largest['pl_name']}: "
                      f"{largest['delta_pc']:+.2f} pc)")
            new_in_archive = report["new_in_archive"]
            if new_in_archive:
                print(f"  {len(new_in_archive)} planets confirmed since the asset was "
                      f"written: {', '.join(new_in_archive[:3])}")
        elif name == "small-bodies":
            print(f"  {resolved} bodies resolve against {report['source']}; "
                  "names, diameters and magnitudes agree")
            revised = report.get("revised") or []
            if revised:
                print(f"  the archive moved since the asset was written: "
                      f"{len(revised)} orbital epochs revised (newest "
                      f"{revised[0]['epoch']})")
        problems = report.get("problems") or []
        if problems:
            print(f"  PROBLEMS ({len(problems)}):")
            for problem in problems[:5]:
                print(f"    {problem['id']}: {problem['problem']} "
                      f"(asset {problem['asset']}, source {problem['source']})")
            if len(problems) > 5:
                print(f"    ... and {len(problems) - 5} more")
    if receipts:
        print("receipts")
        for receipt in receipts:
            print(f"  {receipt}")


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    root = Path(args[0]) if args else ROOT

    receipts: list[str] = []
    reports: dict[str, dict] = {}

    try:
        hipparcos = parse_hipparcos(fetch_hipparcos())
    except FetchError as exc:
        hipparcos = None
        receipts.append(f"I/239/hip_main is unreachable from this host ({exc}) -- "
                        "landmarks, nearby, figure-stars and binaries are unverified")

    if hipparcos is None:
        for name in HIPPARCOS_ASSETS:
            reports[name] = {"unreachable": True}
    else:
        gaia_ids, gaia_receipt = _load_gaia_ids()
        if gaia_receipt:
            receipts.append(gaia_receipt)
        reports["landmarks"] = check_landmarks(_load(root, ASSETS["landmarks"]), hipparcos)
        reports["nearby"] = check_nearby(_load(root, ASSETS["nearby"]), hipparcos)
        reports["figure-stars"] = check_figure_stars(_load(root, ASSETS["figure-stars"]), hipparcos)
        reports["binaries"] = check_binaries(_load(root, ASSETS["binaries"]), hipparcos, gaia_ids)

    for name, check in (("constellations", check_constellations),
                        ("exoplanets", check_exoplanets),
                        ("small-bodies", check_small_bodies)):
        try:
            reports[name] = check(_load(root, ASSETS[name]))
        except (FetchError, OSError, ValueError) as exc:
            receipts.append(f"{name}: source unreachable from this host ({exc})")
            reports[name] = {"unreachable": True}

    _print_report(reports, receipts)

    failed = [name for name, report in reports.items() if report.get("problems")]
    unverified = [name for name, report in reports.items() if report.get("unreachable")]
    if failed:
        print(f"DEFECTS: {', '.join(failed)} no longer resolve -- see the problems above")
    verified = len(reports) - len(failed) - len(unverified)
    print(f"{verified}/{len(reports)} assets resolve against their sources"
          + (f"; {len(unverified)} unverifiable" if unverified else ""))
    if failed:
        return 1
    return 2 if unverified else 0


def check_small_bodies(payload: dict) -> dict:
    """Every sidecar row resolves against a fresh SBDB query.

    A small body's name, diameter and magnitude do not move;
    its orbital epoch does, whenever JPL publishes new
    elements. A moved epoch is the archive being live --
    reported, not failed -- because the tile is a snapshot
    of the epoch it cites, and the card says which.
    """
    source_url = payload["citation"]["source_url"]
    fresh = {record.source_id: record for record in sbdb.run_url(source_url)}
    problems: list[dict] = []
    revised: list[dict] = []
    for body in payload["bodies"]:
        spkid = str(body["spkid"])
        record = fresh.get(spkid)
        if record is None:
            problems.append({"id": spkid,
                             "problem": "spkid no longer in the SBDB query",
                             "asset": "small-bodies",
                             "source": "nasa.jpl.sbdb"})
            continue
        extra = record.extra
        for field in ("name", "H", "diameter_km"):
            if body.get(field) != extra.get(field):
                problems.append({
                    "id": spkid,
                    "problem": f"{field} is {extra.get(field)!r} in the "
                               f"source, {body.get(field)!r} in the asset",
                    "asset": "small-bodies",
                    "source": "nasa.jpl.sbdb",
                })
        if body.get("epoch") != extra.get("epoch"):
            revised.append({"id": spkid, "epoch": extra.get("epoch")})
    matched = len(payload["bodies"]) - len({p["id"] for p in problems})
    return {
        "resolved": matched,
        "total": len(payload["bodies"]),
        "source": "nasa.jpl.sbdb live",
        "problems": problems,
        "revised": revised,
    }


if __name__ == "__main__":
    raise SystemExit(main())
