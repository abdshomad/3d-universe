"""Resolve the relations assets back to their living sources.

Two shipped assets point at sources that can move: the
constellation figures (d3-celestial on GitHub, derived
from Stellarium) and the exoplanets (the NASA Exoplanet
Archive, which confirms and revises). d3-celestial is
effectively frozen -- a disagreement is a defect. The
exoplanet archive is live: a planet the asset lacks is a
new confirmation, and a distance that differs is a
revision; both are reported, never failed.
"""

from __future__ import annotations

import csv
from io import StringIO
from typing import Any

from ingest.sources.exoplanets import query
from ingest.sources.relations import fetch_constellations

FIGURE_TOLERANCE_DEG = 1e-4  # the writer rounds to 5 decimals
EXOPLANET_MAX_DISTANCE_PC = 200.0  # the snapshot's own bound
EXOPLANET_TOLERANCE_PC = 1e-3
EXOPLANET_TOLERANCE_DEG = 1e-6


def _problem(asset_id: str, problem: str, asset: Any, source: Any) -> dict:
    return {"id": asset_id, "problem": problem, "asset": asset, "source": source}


def _segments_differ(asset_segments: list, source_segments: list) -> bool:
    """True when two figures' polylines disagree beyond the rounding tolerance."""
    if len(asset_segments) != len(source_segments):
        return True
    for asset_segment, source_segment in zip(asset_segments, source_segments):
        if len(asset_segment) != len(source_segment):
            return True
        for (ra, dec), (source_ra, source_dec) in zip(asset_segment, source_segment):
            if (abs(ra - source_ra) > FIGURE_TOLERANCE_DEG
                    or abs(dec - source_dec) > FIGURE_TOLERANCE_DEG):
                return True
    return False


def check_constellations(payload: dict) -> dict:
    """Every figure still exists in d3-celestial, unchanged.

    Serpens is two figures under one abbreviation (Caput
    and Cauda), so the source is a pool: each asset
    figure takes its own match, and a figure may match
    only once.
    """
    pool: dict[str, list[dict]] = {}
    for relation in fetch_constellations():
        pool.setdefault(relation["abbreviation"], []).append(relation)
    problems: list[dict] = []
    for relation in payload["relations"]:
        candidates = pool.get(relation["abbreviation"], [])
        match = next((candidate for candidate in candidates
                      if candidate["name"] == relation["name"]
                      and not _segments_differ(relation["segments"],
                                               candidate["segments"])),
                     None)
        if match is None:
            same_name = [candidate for candidate in candidates
                         if candidate["name"] == relation["name"]]
            if same_name:
                problems.append(_problem(relation["id"], "segments",
                                         len(relation["segments"]),
                                         len(same_name[0]["segments"])))
            elif candidates:
                problems.append(_problem(relation["id"], "name",
                                         relation["name"], candidates[0]["name"]))
            else:
                problems.append(_problem(relation["id"],
                                         "figure no longer in d3-celestial",
                                         "present", "absent"))
            continue
        candidates.remove(match)
    return {
        "total": payload["count"],
        "resolved": payload["count"] - len(problems),
        "problems": problems,
        "source": "d3-celestial (ofrohn), derived from Stellarium",
    }


def check_exoplanets(payload: dict) -> dict:
    """Every planet resolves, and the archive's own movement is reported."""
    archive: dict[str, dict] = {}
    for row in csv.DictReader(StringIO(query(EXOPLANET_MAX_DISTANCE_PC))):
        name = (row.get("pl_name") or "").strip()
        if name:
            archive[name] = row
    problems: list[dict] = []
    revised: list[dict] = []
    for planet in payload["planets"]:
        row = archive.get(planet["pl_name"])
        if row is None:
            problems.append(_problem(planet["pl_name"], "planet no longer in the archive",
                                     "present", "absent"))
            continue
        if (row.get("hostname") or "").strip() != planet["hostname"]:
            problems.append(_problem(planet["pl_name"], "hostname",
                                     planet["hostname"], row.get("hostname")))
            continue
        delta_pc = float(row["sy_dist"]) - planet["distance_pc"]
        if (abs(delta_pc) > EXOPLANET_TOLERANCE_PC
                or abs(float(row["ra"]) - planet["ra"]) > EXOPLANET_TOLERANCE_DEG
                or abs(float(row["dec"]) - planet["dec"]) > EXOPLANET_TOLERANCE_DEG):
            revised.append({
                "pl_name": planet["pl_name"],
                "archive_pc": round(float(row["sy_dist"]), 4),
                "asset_pc": planet["distance_pc"],
                "delta_pc": round(delta_pc, 4),
            })
    new_in_archive = sorted(set(archive) - {planet["pl_name"] for planet in payload["planets"]})
    return {
        "total": payload["count"],
        "resolved": payload["count"] - len(problems),
        "problems": problems,
        "revised": revised,
        "new_in_archive": new_in_archive,
        "archive_count": len(archive),
        "source": "NASA Exoplanet Archive, pscomppars",
    }
