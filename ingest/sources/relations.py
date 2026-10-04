"""Constellation figures as citable relations.

Every edge on screen has to point at something published. The constellation
stick figures come from d3-celestial, which derives them from Stellarium; that
is recorded here verbatim, with the URL and the retrieval date, so a fact card
can cite the source of a line rather than inventing one.

Output: a relations JSON file the renderer reads at load.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ingest.http import fetch_text, now_iso

LINES_URL = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json"
NAMES_URL = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json"

CITATION = {
    "dataset": "d3-celestial constellation figures",
    "authors": "ofrohn/d3-celestial, derived from Stellarium",
    "url": LINES_URL,
    "retrieved": now_iso(),
    "licence": "BSD-3-Clause (repository)",
}

RELATION_TYPE = "constellation"


def fetch_constellations() -> list[dict[str, Any]]:
    """Constellation figures as [{id, name, segments}] in RA/Dec degrees."""
    lines = json.loads(fetch_text(LINES_URL))
    names = _names_by_abbreviation()

    relations: list[dict[str, Any]] = []
    for feature in lines.get("features", []):
        abbreviation = feature.get("id", "")
        geometry = feature.get("geometry") or {}
        segments = []
        for line in geometry.get("coordinates", []):
            cleaned = [[round(float(ra), 5), round(float(dec), 5)] for ra, dec in line]
            if len(cleaned) >= 2:
                segments.append(cleaned)
        if segments:
            relations.append({
                "id": f"{RELATION_TYPE}:{abbreviation}",
                "type": RELATION_TYPE,
                "abbreviation": abbreviation,
                "name": names.get(abbreviation, abbreviation),
                "segments": segments,
            })
    relations.sort(key=lambda relation: relation["id"])
    return relations


def _names_by_abbreviation() -> dict[str, str]:
    payload = json.loads(fetch_text(NAMES_URL))


    names = {}
    for feature in payload.get("features", []):
        properties = feature.get("properties") or {}
        # The abbreviation is the designation ("And"), not the rank ("1").
        abbreviation = properties.get("desig") or feature.get("id", "")
        name = properties.get("name") or properties.get("en") or abbreviation
        names[str(abbreviation).strip()] = str(name).strip()
    return names


def write_relations(destination: str | Path) -> Path:
    """Fetch the figures and write them with their citation."""
    relations = fetch_constellations()
    if not relations:
        raise RuntimeError("no constellation figures were returned")
    payload = {
        "citation": CITATION,
        "count": len(relations),
        "relations": relations,
    }
    target = Path(destination)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload), encoding="utf-8")
    return target