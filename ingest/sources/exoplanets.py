"""Confirmed exoplanets inside the atlas's reach, with the archive's own numbers.

Queried from the NASA Exoplanet Archive, the public catalogue this project has
cited since the research stage. Every row carries the archive's distance and
coordinates; the renderer places a planet along its host's direction at that
distance.

That position is **derived**, not astrometric: no parallax exists for an
exoplanet, so the 3D point is the archive's distance applied to a measured
direction. The payload says so in `flag`, and the card repeats it. Anything
that exports these rows must carry that flag rather than passing them off as
measured astrometry.

Run directly: `python3 -m ingest.sources.exoplanets [out.json]`.
"""

from __future__ import annotations

import csv
import json
import sys
import urllib.parse
import urllib.request
from io import StringIO
from pathlib import Path

TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"

COLUMNS = [
    "pl_name", "hostname", "ra", "dec", "sy_dist", "disc_year", "st_teff",
    "sy_snum", "sy_pnum", "discoverymethod",
]

CITATION = {
    "dataset": "NASA Exoplanet Archive Planetary Systems Composite Parameters",
    "table": "pscomppars",
    "url": "https://exoplanetarchive.ipac.caltech.edu/",
    "note": "distances are the archive's sy_dist; exoplanet positions are derived, "
            "not astrometric",
}


def query(max_distance_pc: float, limit: int | None = None) -> str:
    """The archive's rows for planets inside `max_distance_pc`, nearest first."""
    top = f"TOP {limit} " if limit else ""
    adql = (
        f"SELECT {top}{', '.join(COLUMNS)} FROM pscomppars "
        f"WHERE sy_dist IS NOT NULL AND sy_dist < {max_distance_pc} "
        f"AND ra IS NOT NULL AND dec IS NOT NULL AND hostname IS NOT NULL "
        "ORDER BY sy_dist"
    )
    url = f"{TAP_URL}?{urllib.parse.urlencode({'request': 'doQuery', 'lang': 'adql', 'format': 'csv', 'query': adql})}"
    with urllib.request.urlopen(url, timeout=180) as response:
        return response.read().decode("utf-8")


def to_payload(csv_text: str) -> dict:
    """Parse the archive's CSV into the shape the renderer loads."""
    planets = []
    for row in csv.DictReader(StringIO(csv_text)):
        name = (row.get("pl_name") or "").strip()
        host = (row.get("hostname") or "").strip()
        if not name or not host:
            continue
        planets.append({
            "pl_name": name,
            "hostname": host,
            "ra": float(row["ra"]),
            "dec": float(row["dec"]),
            "distance_pc": float(row["sy_dist"]),
            "disc_year": int(row["disc_year"]) if row.get("disc_year") else None,
            "st_teff": float(row["st_teff"]) if row.get("st_teff") else None,
            "stars_in_system": int(row["sy_snum"]) if row.get("sy_snum") else None,
            "planets_in_system": int(row["sy_pnum"]) if row.get("sy_pnum") else None,
            "discovery_method": (row.get("discoverymethod") or "").strip() or None,
        })
    systems = sorted({planet["hostname"] for planet in planets})
    return {
        "flag": "DERIVED",
        "citation": CITATION,
        "count": len(planets),
        "systems": len(systems),
        "planets": planets,
    }


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    target = Path(args[0]) if args else Path("assets/relations/exoplanets.json")
    max_distance = float(args[1]) if len(args) > 1 else 200.0

    payload = to_payload(query(max_distance))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=1), encoding="utf-8")

    nearest = payload["planets"][0] if payload["planets"] else None
    print(f"wrote {target}: {payload['count']} planets across {payload['systems']} systems "
          f"within {max_distance:g} pc")
    if nearest:
        print(f"  nearest: {nearest['pl_name']} ({nearest['hostname']}) at {nearest['distance_pc']:.2f} pc")
    print(f"  flag: {payload['flag']} — positions derived, not astrometric")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
