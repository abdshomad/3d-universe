"""The search index: the nearest Hipparcos stars, with distances we can stand behind.

Hipparcos is complete and small, so it is the right source for "fly me to the
500th nearest star". Only positive parallaxes are kept — a star without a
measured distance has no place in a three-dimensional index, and inventing one
is exactly the failure this project refuses.

Landmark names from `assets/landmarks/landmarks.json` are merged in by HIP, so
searching "Sirius" and searching "32349" find the same star.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ingest.http import now_iso
from ingest.sources.landmarks import CITATION, parse_hipparcos

DEFAULT_LIMIT = 2000
MIN_PARALLAX_MAS = 1.0


def build_index(rows: dict[int, dict[str, Any]], limit: int = DEFAULT_LIMIT) -> list[dict[str, Any]]:
    """The nearest `limit` stars with a usable parallax, brightest first per distance."""
    entries: list[dict[str, Any]] = []
    for hip, row in rows.items():
        parallax = _number(row.get("Plx"))
        if parallax is None or parallax < MIN_PARALLAX_MAS:
            continue
        entries.append({
            "id": f"hip:{hip}",
            "hip": hip,
            "ra_deg": round(float(row["_RA.icrs"]), 6),
            "dec_deg": round(float(row["_DE.icrs"]), 6),
            "parallax_mas": parallax,
            "distance_pc": round(1000.0 / parallax, 5),
            "visual_magnitude": _number(row.get("Vmag")),
            "colour_index": _number(row.get("B-V")),
            "distance_source": "hipparcos-parallax",
            "name": None,
        })
    entries.sort(key=lambda entry: entry["distance_pc"])
    return entries[:limit]


def attach_names(entries: list[dict[str, Any]], landmarks: dict[str, Any]) -> list[dict[str, Any]]:
    """Give the landmark stars their proper names."""
    by_hip = {landmark["hip"]: landmark for landmark in landmarks}
    for entry in entries:
        landmark = by_hip.get(entry["hip"])
        if landmark:
            entry["name"] = landmark["name"]
            entry["kind"] = landmark["kind"]
    return entries


def write_index(
    destination: str | Path,
    cache: str | Path | None = None,
    landmarks_path: str | Path | None = None,
    limit: int = DEFAULT_LIMIT,
) -> Path:
    if cache is None:
        raise ValueError("a cached Hipparcos TSV is required; download it first")
    text = Path(cache).read_text(encoding="utf-8")
    entries = build_index(parse_hipparcos(text), limit=limit)

    if landmarks_path and Path(landmarks_path).exists():
        payload = json.loads(Path(landmarks_path).read_text(encoding="utf-8"))
        entries = attach_names(entries, payload.get("landmarks", []))

    payload = {
        "citation": {**CITATION, "retrieved": now_iso()},
        "count": len(entries),
        "named": sum(1 for entry in entries if entry["name"]),
        "entries": entries,
    }
    target = Path(destination)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload), encoding="utf-8")
    return target


def _number(value: str | None) -> float | None:
    if value is None or not str(value).strip():
        return None
    try:
        return float(value)
    except ValueError:
        return None
