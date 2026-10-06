"""Resolve the Hipparcos-backed assets back to I/239/hip_main.

Four shipped assets are rows of the Hipparcos catalogue: the
landmarks, the search index, the figure stars, and the
double-star pairs (whose primaries, and 153 secondaries,
are Hipparcos stars). Hipparcos is a frozen 1997 catalogue
-- it cannot move -- so any disagreement between an asset
and the live table is a defect in the asset, not a revised
source.

The double-star pairs also carry WDS designations, checked
against B/wds/wds, and Gaia secondaries, checked against
the baked Gaia tile (the tile itself is verified against
Gaia by `ingest verify`). A tile absent from this host is
a receipt, not a failure.
"""

from __future__ import annotations

import csv
import urllib.parse
from io import StringIO
from typing import Any

from ingest.http import FetchError, fetch_text
from ingest.sources.hipparcos import MAGNITUDE_LIMIT
from ingest.sources.search_index import MIN_PARALLAX_MAS

PLX_TOLERANCE_MAS = 0.05
POSITION_TOLERANCE_DEG = 1e-5
DISTANCE_TOLERANCE_PC = 1e-3
WDS_TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"

HIPPARCOS_FIELDS = (
    ("parallax_mas", "Plx", PLX_TOLERANCE_MAS),
    ("ra_deg", "_RA_icrs", POSITION_TOLERANCE_DEG),
    ("dec_deg", "_DE_icrs", POSITION_TOLERANCE_DEG),
    ("distance_pc", None, DISTANCE_TOLERANCE_PC),
)
FIGURE_STAR_FIELDS = (
    ("ra", "RAICRS", POSITION_TOLERANCE_DEG),
    ("dec", "DEICRS", POSITION_TOLERANCE_DEG),
    ("parallax_mas", "Plx", PLX_TOLERANCE_MAS),
    ("distance_pc", None, DISTANCE_TOLERANCE_PC),
)


def _cell(row: dict, column: str) -> float | None:
    """A catalogue cell as a float, or None when the catalogue has no value."""
    value = row.get(column)
    return None if value is None or value == "" else float(value)


def _problem(asset_id: str, problem: str, asset: Any, source: Any) -> dict:
    return {"id": asset_id, "problem": problem, "asset": asset, "source": source}


def _field_problems(identifier: str, asset: dict, row: dict,
                    fields: tuple) -> list[dict]:
    """Compare the asset's fields against the catalogue row, one by one."""
    problems = []
    parallax = _cell(row, "Plx")
    for field, column, tolerance in fields:
        if column is None:
            source = None if parallax is None else 1000.0 / parallax
        else:
            source = _cell(row, column)
        if source is None or abs(asset[field] - source) > tolerance:
            problems.append(_problem(identifier, field, asset[field], source))
    return problems


def check_landmarks(payload: dict, hipparcos: dict[int, dict[str, str]]) -> dict:
    """Every landmark resolves, with the parallax and position it shipped."""
    problems: list[dict] = []
    for landmark in payload["landmarks"]:
        row = hipparcos.get(landmark["hip"])
        if row is None:
            problems.append(_problem(landmark["id"], "no Hipparcos row", "present", "absent"))
            continue
        problems.extend(_field_problems(landmark["id"], landmark, row, HIPPARCOS_FIELDS))
    return _report(payload["count"], problems, "I/239/hip_main")


def check_nearby(payload: dict, hipparcos: dict[int, dict[str, str]]) -> dict:
    """Every nearby star resolves, and still obeys the builder's parallax rule."""
    problems: list[dict] = []
    for star in payload["entries"]:
        row = hipparcos.get(star["hip"])
        if row is None:
            problems.append(_problem(f"hip:{star['hip']}", "no Hipparcos row", "present", "absent"))
            continue
        identifier = f"hip:{star['hip']}"
        problems.extend(_field_problems(identifier, star, row, HIPPARCOS_FIELDS))
        parallax = _cell(row, "Plx")
        if parallax is None or parallax < MIN_PARALLAX_MAS:
            problems.append(_problem(identifier, "parallax below the 1 mas rule",
                                     star["parallax_mas"], parallax))
    return _report(payload["count"], problems, "I/239/hip_main")


def check_figure_stars(payload: dict, hipparcos: dict[int, dict[str, str]]) -> dict:
    """Every figure star resolves, and still obeys the builder's rules."""
    problems: list[dict] = []
    for star in payload["stars"]:
        row = hipparcos.get(star["hip"])
        if row is None:
            problems.append(_problem(f"hip:{star['hip']}", "no Hipparcos row", "present", "absent"))
            continue
        identifier = f"hip:{star['hip']}"
        problems.extend(_field_problems(identifier, star, row, FIGURE_STAR_FIELDS))
        parallax = _cell(row, "Plx")
        if parallax is None or parallax <= 0:
            problems.append(_problem(identifier, "no parallax: an invented place",
                                     star["parallax_mas"], parallax))
        v_mag = _cell(row, "Vmag")
        if v_mag is not None and v_mag >= MAGNITUDE_LIMIT:
            problems.append(_problem(identifier, "fainter than the magnitude limit",
                                     star.get("v_mag"), v_mag))
    return {
        "total": payload["count"],
        "skipped_by_builder": payload.get("skipped"),
        "resolved": payload["count"] - len(problems),
        "problems": problems,
        "source": "I/239/hip_main",
    }


def check_wds_ids(payload: dict) -> dict:
    """Every distinct WDS designation is a row in B/wds/wds."""
    adql = 'SELECT WDS FROM "B/wds/wds"'
    url = f"{WDS_TAP_URL}?{urllib.parse.urlencode({'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': adql})}"
    text = fetch_text(url, timeout=240)
    known = {(row.get("WDS") or "").replace(" ", "").strip()
             for row in csv.DictReader(StringIO(text))}
    known.discard("")
    designations = {pair["wds"] for pair in payload["pairs"]}
    missing = sorted(d for d in designations if d.replace(" ", "") not in known)
    return {"distinct": len(designations), "missing": missing, "source": "B/wds/wds"}


# Count keys: a component is a primary or a secondary.
PLURAL = {"primary": "primaries", "secondary": "secondaries"}


def _resolve_component(reference: Any, hipparcos: dict[int, dict[str, str]],
                       gaia_ids: Any) -> tuple[str, str | None]:
    """Resolve one double-star component to the catalogue it names.

    Returns the catalogue ('hipparcos', 'gaia', or 'gaia-absent'
    when the tile is not on this host) and the problem, if any.
    A component is either a Hipparcos number or a reference into
    the baked Gaia tile; the builder matched each WDS component
    to whichever catalogue held it.
    """
    if isinstance(reference, str) and reference.startswith("gaia:"):
        if gaia_ids is None:
            return "gaia-absent", None
        index = int(reference.rsplit(":", 1)[1])
        if 0 <= index < len(gaia_ids):
            return "gaia", None
        return "gaia", f"Gaia tile index {index} out of range"
    if hipparcos.get(int(reference)) is None:
        return "hipparcos", "no Hipparcos row"
    return "hipparcos", None


def check_binaries(payload: dict, hipparcos: dict[int, dict[str, str]],
                   gaia_ids: Any = None) -> dict:
    """Both ends of every pair resolve to a catalogue row."""
    problems: list[dict] = []
    counts: dict[str, int] = {}
    for pair in payload["pairs"]:
        for end, reference in (("primary", pair["primary_hip"]),
                               ("secondary", pair["secondary_hip"])):
            catalogue, problem = _resolve_component(reference, hipparcos, gaia_ids)
            key = f"{catalogue}_{PLURAL[end]}"
            counts[key] = counts.get(key, 0) + 1
            if problem:
                problems.append(_problem(f"{pair['wds']} ({end})", problem,
                                         "present", "absent"))
    report = {
        "total": payload["count"],
        "resolved": payload["count"] - len(problems),
        "problems": problems,
        "hipparcos_primaries": counts.get("hipparcos_primaries", 0),
        "gaia_primaries": counts.get("gaia_primaries", 0),
        "hipparcos_secondaries": counts.get("hipparcos_secondaries", 0),
        "gaia_secondaries": counts.get("gaia_secondaries", 0),
        "gaia_unverified": counts.get("gaia-absent_primaries", 0)
        + counts.get("gaia-absent_secondaries", 0),
        "source": "I/239/hip_main and B/wds/wds",
    }
    try:
        report["wds_ids"] = check_wds_ids(payload)
    except FetchError as exc:
        report["wds_receipt"] = f"B/wds/wds is unreachable from this host: {exc}"
    return report


def _report(total: int, problems: list[dict], source: str) -> dict:
    return {"total": total, "resolved": total - len(problems),
            "problems": problems, "source": source}
