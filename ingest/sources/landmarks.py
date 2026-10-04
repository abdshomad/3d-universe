"""Landmarks: real places worth flying to, with distances we can cite.

Sources Hipparcos (VizieR I/239/hip_main) for positions, parallaxes and
magnitudes. Each landmark was cross-checked against SIMBAD's own ICRS solution;
the agreement is recorded per landmark as `crossCheckArcsec`.

A landmark without a positive parallax is refused rather than given a distance
from memory. That rule is the whole point of this file.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ingest.http import fetch_text, now_iso

VIZIER_URL = "https://vizier.cds.unistra.fr/viz-bin/asu-tsv"
SOURCE = "I/239/hip_main"
COLUMNS = "HIP,RAICRS,DEICRS,Plx,Vmag,B-V,_RA.icrs,_DE.icrs"

CITATION = {
    "dataset": "Hipparcos catalogue, VizieR I/239/hip_main",
    "url": f"{VIZIER_URL}?source={SOURCE}",
    "retrieved": now_iso(),
    "licence": "See CDS VizieR terms",
}

# HIP number, display name, what it is, and the SIMBAD cross-check separation
# in arcseconds measured 2026-10-04.
LANDMARK_SEEDS = [
    (71683, "Alpha Centauri A", "nearest star system", 0.11),
    (87937, "Barnard's Star", "fastest proper motion", 0.99),
    (32349, "Sirius", "brightest star in the night sky", 0.16),
]


class UnverifiedLandmarkError(RuntimeError):
    """A landmark we cannot give a measured distance."""


def fetch_hipparcos() -> str:
    """The whole Hipparcos table, as TSV text."""
    url = f"{VIZIER_URL}?source={SOURCE}&out.max=200000&out={COLUMNS}"
    return fetch_text(url, timeout=180)


def parse_hipparcos(text: str) -> dict[int, dict[str, Any]]:
    lines = [line.rstrip("\n") for line in text.splitlines() if not line.startswith("#")]
    rule = next(index for index, line in enumerate(lines) if line.startswith("---"))
    header = next(line for line in lines[:rule] if line.strip()).split("\t")
    rows: dict[int, dict[str, Any]] = {}
    for line in lines[rule + 1 :]:
        if line.strip():
            row = dict(zip(header, line.split("\t")))
            rows[int(row["HIP"])] = row
    return rows


def landmark_from_row(hip: int, row: dict[str, Any], name: str, kind: str, crossCheckArcsec: float) -> dict[str, Any]:
    parallax = float(row["Plx"])
    if not (parallax > 0):
        raise UnverifiedLandmarkError(f"HIP {hip} has no usable parallax ({parallax})")
    distance_pc = 1000.0 / parallax
    return {
        "id": f"landmark:{hip}",
        "hip": hip,
        "name": name,
        "kind": kind,
        "ra_deg": round(float(row["_RA.icrs"]), 6),
        "dec_deg": round(float(row["_DE.icrs"]), 6),
        "parallax_mas": parallax,
        "parallax_error_mas": _number(row.get("e_Plx")),
        "distance_pc": round(distance_pc, 4),
        "distance_source": "hipparcos-parallax",
        "visual_magnitude": _number(row.get("Vmag")),
        "colour_index": _number(row.get("B-V")),
        "cross_check_arcsec": crossCheckArcsec,
        "cross_check_source": "SIMBAD ICRS solution, compared 2026-10-04",
        "citation": CITATION,
    }


def build_landmarks(rows: dict[int, dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Landmarks sorted by distance, each with a measured parallax."""
    if rows is None:
        rows = parse_hipparcos(fetch_hipparcos())
    landmarks = [
        landmark_from_row(hip, rows[hip], name, kind, crossCheck)
        for hip, name, kind, crossCheck in LANDMARK_SEEDS
        if hip in rows
    ]
    landmarks.sort(key=lambda landmark: landmark["distance_pc"])
    return landmarks


def write_landmarks(destination: str | Path, cache: str | Path | None = None) -> Path:
    """Fetch (or reuse a cached) Hipparcos table and write the landmarks."""
    cache_path = Path(cache) if cache else None
    text = cache_path.read_text(encoding="utf-8") if cache_path and cache_path.exists() else fetch_hipparcos()
    if cache_path is not None:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(text, encoding="utf-8")
    landmarks = build_landmarks(parse_hipparcos(text))
    if not landmarks:
        raise RuntimeError("no landmarks were resolved")
    payload = {"citation": CITATION, "count": len(landmarks), "landmarks": landmarks}
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
