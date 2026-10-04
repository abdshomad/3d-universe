"""Transient and steady-bright event sources, with citations.

Pulsars come from the ATNF Pulsar Catalogue via VizieR (B/psr). What is
recorded is only what the catalogue measures: position always, flux at 400 MHz
when known, period, age, and a distance labelled by how it was derived —
parallax, or dispersion measure. A DM distance is a model output, not a
measurement, and the flag travels with it all the way to the fact card.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ingest.http import build_url, fetch_text, now_iso

VIZIER_URL = "https://vizier.cds.unistra.fr/viz-bin/asu-tsv"
SOURCE = "B/psr"
# The asu-tsv endpoint wants dashed parameters: `out.max` without the dash
# silently returns an empty table.
COLUMNS = "Name,RAJ2000,DEJ2000,P0,S400,Plx,Dist,Age"

CITATION = {
    "dataset": "ATNF Pulsar Catalogue (Manchester et al.), VizieR B/psr",
    "url": f"{VIZIER_URL}?source={SOURCE}",
    "retrieved": now_iso(),
    "licence": "See CSIRO ATNF terms",
}

KIND = "pulsar"


def fetch_pulsars(limit: int | None = None) -> list[dict[str, Any]]:
    """Pulsars as events, brightest first."""
    # asu-tsv rejects percent-encoded separators: commas and slashes stay literal.
    # `-sort.dirs=-` empties the table; sorting by flux happens here instead.
    url = f"{VIZIER_URL}?-source={SOURCE}&-out={COLUMNS}&-sort=S400"
    if limit:
        url += f"&-out.max={limit}"

    events: list[dict[str, Any]] = []
    for row in parse_tsv(fetch_text(url)):
        name = (row.get("PSJR") or row.get("Name") or "").strip()
        if not name or name in {"Name", "PSJR"}:
            continue
        ra = _ra_to_degrees(row.get("RAJ2000"))
        dec = _dec_to_degrees(row.get("DEJ2000"))
        if ra is None or dec is None:
            continue
        events.append({
            "id": f"{KIND}:{name}",
            "kind": KIND,
            "name": name,
            "ra_deg": round(ra, 5),
            "dec_deg": round(dec, 5),
            "flux_mjy": _number(row.get("S400")),
            "period_s": _number(row.get("P0")),
            "distance_kpc": _number(row.get("Dist")),
            "age_yr": _number(row.get("Age")),
            "position_source": "measured",
            "distance_source": "parallax" if _number(row.get("Plx")) else "dispersion-measure",
            "citation": CITATION,
        })
    events.sort(key=lambda event: -(event["flux_mjy"] or 0))
    return events


def parse_tsv(text: str) -> list[dict[str, str]]:
    """VizieR TSV: comments, header, units, a rule, then rows."""
    lines = [line for line in text.splitlines() if not line.startswith("#")]
    # The body starts with a blank line, then the header; taking line 0 as the
    # header yields a single empty column and every row parses to {}.
    while lines and not lines[0].strip():
        lines.pop(0)
    if not lines:
        return []
    header = lines[0].split("\t")
    start = 1
    for index, line in enumerate(lines):
        if line.startswith("---"):
            start = index + 1
            break
    return [dict(zip(header, line.split("\t"))) for line in lines[start:] if line.strip()]


def write_events(destination: str | Path, limit: int | None = None) -> Path:
    """Fetch the events and write them with their citation."""
    events = fetch_pulsars(limit=limit)
    if not events:
        raise RuntimeError("no pulsars were returned")
    payload = {"citation": CITATION, "count": len(events), "events": events}
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


def _split_sexagesimal(value: str | None) -> tuple[float, float, float] | None:
    if not value:
        return None
    parts = str(value).split()
    if len(parts) != 3:
        return None
    try:
        return float(parts[0]), float(parts[1]), float(parts[2])
    except ValueError:
        return None


def _ra_to_degrees(value: str | None) -> float | None:
    """'00 06 04.80' in hours to degrees."""
    parts = _split_sexagesimal(value)
    if parts is None:
        return None
    hours, minutes, seconds = parts
    sign = -1 if hours < 0 else 1
    return sign * (abs(hours) * 15 + minutes / 4 + seconds / 240)


def _dec_to_degrees(value: str | None) -> float | None:
    """'+18 34 59.0' in degrees to degrees: declination is not in hours."""
    parts = _split_sexagesimal(value)
    if parts is None:
        return None
    degrees, minutes, seconds = parts
    sign = -1 if degrees < 0 or str(value).strip().startswith("-") else 1
    return sign * (abs(degrees) + minutes / 60 + seconds / 3600)