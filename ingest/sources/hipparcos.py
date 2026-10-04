"""Naked-eye Hipparcos stars: the stars the constellation figures are drawn from.

d3-celestial gives each figure point as a bare RA/Dec pair. Measured against this
catalogue, 874 of the 893 vertices land within 10 arcseconds of a star here, with
a median of 0.58 — the figure points were always catalogue rows. What was
missing was the catalogue.

Every star carries its Hipparcos parallax, so a figure endpoint gets a measured
position rather than a position borrowed from whatever star happened to be
nearest. Stars without a usable parallax are dropped: an endpoint with no
distance is an endpoint at an invented place.

Run directly: `python3 -m ingest.sources.hipparcos [out.json]`.
"""

from __future__ import annotations

import csv
import json
import sys
import urllib.parse
import urllib.request
from io import StringIO
from pathlib import Path

TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"
MAGNITUDE_LIMIT = 6.5

CITATION = {
    "dataset": "Hipparcos, via the VizieR mirror at CDS",
    "catalogue": "I/239/hip_main",
    "authors": "ESA (1997), The Hipparcos and Tycho catalogues",
    "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239",
}


def query(magnitude_limit: float = MAGNITUDE_LIMIT, limit: int = 20000) -> str:
    """Naked-eye Hipparcos rows, brightest first."""
    adql = (
        f"SELECT TOP {limit} HIP,RAICRS,DEICRS,Plx,Vmag FROM \"I/239/hip_main\" "
        f"WHERE Vmag < {magnitude_limit}"
    )
    url = f"{TAP_URL}?{urllib.parse.urlencode({'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': adql})}"
    with urllib.request.urlopen(url, timeout=180) as response:
        return response.read().decode("utf-8")


def to_payload(csv_text: str) -> dict:
    """Parse rows, dropping any star that cannot be placed."""
    stars = []
    skipped = 0
    for row in csv.DictReader(StringIO(csv_text)):
        try:
            hip = int(row["HIP"])
            ra = float(row["RAICRS"])
            dec = float(row["DEICRS"])
            parallax = float(row["Plx"])
        except (TypeError, ValueError):
            skipped += 1
            continue
        if parallax <= 0:
            skipped += 1  # no distance: an invented place
            continue
        stars.append({
            "hip": hip,
            "ra": ra,
            "dec": dec,
            "parallax_mas": parallax,
            "distance_pc": round(1000.0 / parallax, 4),
            "v_mag": float(row["Vmag"]) if row.get("Vmag") else None,
        })
    stars.sort(key=lambda star: star["distance_pc"])
    return {
        "citation": CITATION,
        "count": len(stars),
        "skipped": skipped,
        "magnitude_limit": MAGNITUDE_LIMIT,
        "stars": stars,
    }


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    target = Path(args[0]) if args else Path("assets/relations/figure-stars.json")

    payload = to_payload(query())
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload), encoding="utf-8")

    nearest = payload["stars"][0]
    print(f"wrote {target}: {payload['count']} naked-eye stars, {payload['skipped']} skipped")
    print(f"  nearest: HIP {nearest['hip']} at {nearest['distance_pc']:.2f} pc, V={nearest['v_mag']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
