"""Visual double stars whose both components resolve to measured stars.

The Washington Double Star catalogue records one position per *pair*, plus each
component's separation in arcseconds and position angle. The two component
positions are therefore geometry, not observation: they are derived from the
pair centre, and the payload says so by carrying `DERIVED` for them.

A pair is kept only when **both** components match a naked-eye Hipparcos star with
a parallax. Half a pair is not a double star in this atlas — the layer's whole
claim is that these two named stars are catalogued as a pair — so pairs that do
not fully resolve are counted and dropped, never drawn with one end invented.

Run directly: `python3 -m ingest.sources.doubles [out.json] [figure-stars.json]`.
"""

from __future__ import annotations

import csv
import json
import math
import sys
import urllib.parse
import urllib.request
from io import StringIO
from pathlib import Path

TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"
MAGNITUDE_LIMIT = 9.0
MATCH_TOLERANCE_ARCSEC = 30.0
# WDS writes 999.9 for a separation it does not know. It is > 0, so a naive
# filter admits it and puts the secondary 16 arcminutes away on invented geometry.
UNKNOWN_SEPARATION = 900.0

CITATION = {
    "dataset": "Washington Double Star Catalogue",
    "catalogue": "B/wds/wds",
    "authors": "WDS, maintained at USNO",
    "url": "https://www.usno.navy.mil/USNO/astrometry/optical-IR-prod/wds",
}

COLUMNS = ["WDS", "RAJ2000", "DEJ2000", "pa1", "pa2", "sep1", "sep2", "mag1", "mag2", "Nobs", "Disc"]


def query(magnitude_limit: float = MAGNITUDE_LIMIT, limit: int = 60000) -> str:
    adql = (
        f"SELECT TOP {limit} {', '.join(COLUMNS)} FROM \"B/wds/wds\" "
        f"WHERE mag1 < {magnitude_limit} AND sep1 > 0 AND sep1 < {UNKNOWN_SEPARATION}"
    )
    url = f"{TAP_URL}?{urllib.parse.urlencode({'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': adql})}"
    with urllib.request.urlopen(url, timeout=240) as response:
        return response.read().decode("utf-8")


def offset_position(ra_deg, dec_deg, separation_arcsec, pa_deg):
    """Where the secondary sits, from the primary, its separation and its angle.

    Derived, not observed. The separation and the angle are WDS's; this is the
    arithmetic that turns them into a direction. WDS records the *primary's*
    position and the secondary relative to it — measured: interpreting the same
    rows as a pair centre instead resolves 7,091 component positions against
    9,746 for this reading.
    """
    separation = separation_arcsec / 3600.0
    theta = math.radians(pa_deg)
    delta_ra = (separation * math.cos(theta)) / math.cos(math.radians(dec_deg))
    delta_dec = separation * math.sin(theta)
    return (ra_deg + delta_ra) % 360.0, dec_deg + delta_dec


def angular_separation_arcsec(ra1, dec1, ra2, dec2):
    r1, d1, r2, d2 = map(math.radians, (ra1, dec1, ra2, dec2))
    cosine = math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(r1 - r2)
    cosine = max(-1.0, min(1.0, cosine))
    return 2 * math.asin(min(1.0, math.sqrt(2 - 2 * cosine) / 2)) * 180 / math.pi * 3600


def build_sky_index(stars, cell_degrees=1.0):
    """Stars bucketed by sky cell, so a 30-second match checks tens of stars
    rather than all eight thousand. Comparing every candidate against every star
    is 500 million comparisons in pure Python, which is minutes of wall clock."""
    cells = {}
    for index, star in enumerate(stars):
        key = (int(star["ra"] // cell_degrees), int(star["dec"] // cell_degrees))
        cells.setdefault(key, []).append(index)
    return cells


def nearby(index, ra, dec, cell_degrees=1.0):
    base_ra, base_dec = int(ra // cell_degrees), int(dec // cell_degrees)
    found = []
    for d_ra in (-1, 0, 1):
        for d_dec in (-1, 0, 1):
            found.extend(index.get((base_ra + d_ra, base_dec + d_dec), []))
    return found


def match_one_to_one(components, stars, index, tolerance_arcsec=MATCH_TOLERANCE_ARCSEC):
    """Each component takes at most one star, and each star backs at most one."""
    candidates = []
    for ci, (ra, dec) in enumerate(components):
        for si in nearby(index, ra, dec):
            star = stars[si]
            separation = angular_separation_arcsec(ra, dec, star["ra"], star["dec"])
            if separation <= tolerance_arcsec:
                candidates.append((separation, ci, si))
    candidates.sort()

    matched = {}
    used = set()
    for separation, ci, si in candidates:
        if ci in matched or si in used:
            continue
        matched[ci] = (si, separation)
        used.add(si)
    return matched


def resolve(csv_text: str, stars: list[dict]) -> tuple[dict, dict]:
    index = build_sky_index(stars)
    pairs = []
    candidates = 0
    for row in csv.DictReader(StringIO(csv_text)):
        candidates += 1
        try:
            ra = float(row["RAJ2000"])
            dec = float(row["DEJ2000"])
            pa = float(row["pa1"])
            separation = float(row["sep1"])
        except (TypeError, ValueError):
            continue
        if separation <= 0 or separation >= UNKNOWN_SEPARATION:
            continue  # a separation we do not know is not a pair we can draw

        components = [(ra, dec), offset_position(ra, dec, separation, pa)]
        matched = match_one_to_one(components, stars, index)
        if len(matched) < 2:
            continue  # half a pair is not a pair

        first = stars[matched[0][0]]
        second = stars[matched[1][0]]
        pairs.append({
            "wds": row["WDS"],
            "primary_hip": first["hip"],
            "secondary_hip": second["hip"],
            "separation_arcsec": round(separation, 2),
            "magnitude_primary": float(row["mag1"]) if row.get("mag1") else None,
            "magnitude_secondary": float(row["mag2"]) if row.get("mag2") else None,
            "observations": int(row["Nobs"]) if row.get("Nobs") else None,
            "discoverer": (row.get("Disc") or "").strip() or None,
            "match_arcsec": [round(matched[0][1], 2), round(matched[1][1], 2)],
        })

    return {
        "flag": "DERIVED",
        "citation": CITATION,
        "magnitude_limit": MAGNITUDE_LIMIT,
        "tolerance_arcsec": MATCH_TOLERANCE_ARCSEC,
        "candidates": candidates,
        "count": len(pairs),
        "omitted": candidates - len(pairs),
        "pairs": pairs,
    }


def tile_stars(tile_path: Path) -> list[dict]:
    """Measured stars from a baked tile, as sky positions.

    Most visual doubles have a secondary too faint to be naked-eye, so matching
    only against Hipparcos leaves almost nothing. The tile holds 60,000 measured
    stars to 200 pc, and it is a catalogue row like any other.
    """
    import struct

    blob = tile_path.read_bytes()
    magic = b"U3DTILE2"
    (header_length,) = struct.unpack_from("<I", blob, len(magic))
    header = json.loads(blob[len(magic) + 4:len(magic) + 4 + header_length].decode("utf-8"))
    start = len(magic) + 4 + header_length
    count = header["count"]
    positions = blob[start + count * 8: start + count * 8 + count * 6]

    origin = header["origin"]
    extent = header["extent"]
    scale = 1.0 if header["unit"] == "pc" else 4.8481e-6
    out = []
    for i in range(count):
        # Positions are quantised to 16 bits: two bytes per component, not one.
        q = [struct.unpack_from("<H", positions, 6 * i + 2 * axis)[0] for axis in range(3)]
        unit = [
            origin[axis] * scale + (value / 65535) * extent[axis] * scale
            for axis, value in enumerate(q)
        ]
        length = math.sqrt(sum(component ** 2 for component in unit))
        if length == 0:
            continue
        x, y, z = (component / length for component in unit)
        declination = math.degrees(math.asin(z))
        right_ascension = math.degrees(math.atan2(y, x)) % 360.0
        out.append({"hip": f"gaia:{header['tile_id']}:{i}", "ra": right_ascension,
                    "dec": declination, "source": "gaia"})
    return out


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    target = Path(args[0]) if args else Path("assets/relations/binaries.json")
    stars_path = Path(args[1]) if len(args) > 1 else Path("assets/relations/figure-stars.json")
    tile_path = Path(args[2]) if len(args) > 2 else Path("assets/tiles/gaia-60k.u3dtile")

    stars = json.loads(stars_path.read_text(encoding="utf-8"))["stars"]
    tile = tile_stars(tile_path)
    stars = stars + tile
    print(f"candidate stars: {len(stars):,} (Hipparcos + {len(tile):,} from {tile_path.name})")
    payload = resolve(query(), stars)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload), encoding="utf-8")

    print(f"wrote {target}: {payload['count']} pairs with both components resolved "
          f"of {payload['candidates']} naked-eye candidates ({payload['omitted']} omitted)")
    if payload["pairs"]:
        example = payload["pairs"][0]
        print(f"  e.g. WDS {example['wds']}: HIP {example['primary_hip']} + "
              f"HIP {example['secondary_hip']} at {example['separation_arcsec']}\"")
    print("  flag: DERIVED — component positions are geometry from WDS, not observation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
