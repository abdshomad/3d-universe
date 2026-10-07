"""The human-readable asset-verification report.

Each asset prints one block: what resolved against
what, and the defects that fail the run.
"""

from __future__ import annotations

from ingest.verify_relations import EXOPLANET_MAX_DISTANCE_PC


def print_report(
    reports: dict[str, dict],
    receipts: list[str],
    assets: dict[str, str],
) -> None:
    for name, report in reports.items():
        print(f"{name} ({assets[name]})")
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
        elif name in ("comets", "planets", "satellites",
                      "galaxies", "black-holes"):
            print(f"  {resolved} rows resolve against {report['source']}; "
                  "names and measured values agree")
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
