"""The search index: the nearest Hipparcos stars, with distances we can stand behind.

Hipparcos is complete and small, so it is the right source for "fly me to the
500th nearest star". Only positive parallaxes are kept — a star without a
measured distance has no place in a three-dimensional index, and inventing one
is exactly the failure this project refuses.

Landmark names from `assets/landmarks/landmarks.json` are merged in by HIP, so
searching "Sirius" and searching "32349" find the same star. Small bodies
from JPL SBDB are merged in the same way, so searching "Ceres" and
searching "sbdb:20000001" find the same body.
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
            # "kind" belongs to the card dispatch, not to the star: a landmark
            # description like "brightest star in the night sky" is not a kind.
            entry["description"] = landmark["kind"]
            entry["cross_check_arcsec"] = landmark["cross_check_arcsec"]
            entry["parallax_error_mas"] = landmark["parallax_error_mas"]
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


def build_sbdb_entries(records: list[Any]) -> list[dict[str, Any]]:
    """Small bodies as search entries: a name or an spkid, a flight out.

    A small body's distance is an epoch-bound number, not a parallax,
    so the entry says which is which -- the same honesty the cards
    carry.
    """
    entries: list[dict[str, Any]] = []
    for record in records:
        extra = record.extra
        entries.append({
            "id": f"sbdb:{record.source_id}",
            "name": extra.get("name"),
            "ra_deg": round(record.ra_deg, 6),
            "dec_deg": round(record.dec_deg, 6),
            "distance_pc": round(record.distance_pc, 9),
            "distance_au": round(extra.get("distance_au"), 4),
            "visual_magnitude": extra.get("H"),
            "distance_source": "sbdb-orbital-elements",
            "kind": "small_body",
            "diameter_km": extra.get("diameter_km"),
            "epoch": extra.get("epoch"),
            "epoch_jd": extra.get("epoch_jd"),
        })
    return entries


def merge_sbdb(index_path: str | Path, records: list[Any]) -> int:
    """Append small bodies to a written index, replacing any prior pass.

    Idempotent: re-running with the same catalogue writes the same
    index, and re-baking the tile re-merges without duplicating.
    """
    target = Path(index_path)
    payload = json.loads(target.read_text(encoding="utf-8"))
    entries = payload.get("entries", [])
    kept = [
        entry for entry in entries
        if not str(entry.get("id", "")).startswith("sbdb:")
    ]
    fresh = build_sbdb_entries(records)
    payload["entries"] = kept + fresh
    payload["count"] = len(payload["entries"])
    payload["small_bodies"] = len(fresh)
    payload["small_body_source"] = records[0].provenance.source_url if fresh else None
    target.write_text(json.dumps(payload), encoding="utf-8")
    return len(fresh)


def _number(value: str | None) -> float | None:
    if value is None or not str(value).strip():
        return None
    try:
        return float(value)
    except ValueError:
        return None
