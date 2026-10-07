"""The Third Reference Catalogue of Bright Galaxies (RC3),
via VizieR's TAP service.

Positions are J2000 from the catalogue. Distances are
derived: the measured redshift cz, converted by the Hubble
law with a stated H0. Redshift is not parallax, and every
record says so -- a galaxy card without a distance method
is a number with no provenance.

The 12,393 catalogue rows without a measured redshift have
sky positions but no distance; they are not placed in 3D
and the dataset's count says both numbers.
"""

from __future__ import annotations

import csv
import io
import urllib.parse

from ingest.http import fetch_text, now_iso
from ingest.schema import MEASURED, CatalogObject, Provenance
from ingest.sources.base import provenance

name = "galaxies"
release = "RC3"

TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"
CATALOGUE = "VII/155/rc3"
SOURCE_URL = "https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/155"
# The Hubble law the distance rides on, stated everywhere
# the distance is used: d = cz / H0.
H0_KM_S_MPC = 70.0

QUERY = (
    f'SELECT PGC, RA2000, DE2000, altname, desig, type, D25, BT, '
    f'"B-VT", cz, e_cz FROM "{CATALOGUE}" WHERE cz > 0'
)


def fetch(
    endpoint: str = TAP_URL,
    timeout: float = 240.0,
) -> list[CatalogObject]:
    """Fetch every galaxy with a measured redshift."""
    url = f"{endpoint}?{urllib.parse.urlencode({
        'REQUEST': 'doQuery', 'LANG': 'ADQL',
        'FORMAT': 'csv', 'QUERY': QUERY,
    })}"
    prov = provenance(
        catalog="cds.vizier.rc3",
        release=release,
        query=QUERY,
        source_url=SOURCE_URL,
        fetched_at=now_iso(),
        flag=MEASURED,
    )
    records: list[CatalogObject] = []
    for row in csv.DictReader(io.StringIO(fetch_text(url, timeout=timeout))):
        record = _to_object(row, prov)
        if record is not None:
            records.append(record)
    return records


def _to_object(row: dict, prov: Provenance) -> CatalogObject | None:
    # The VizieR column carries the designation
    # with its prefix, in two forms: 'PGC11752'
    # and, quoted for its space, 'PGC 9735'.
    # The tile's id array holds the number, so
    # the prefix and the space are stripped here,
    # once.
    pgc = (
        (row.get("PGC") or "")
        .strip()
        .removeprefix("PGC")
        .strip()
    )
    ra = _float(row.get("RA2000"))
    dec = _float(row.get("DE2000"))
    cz = _float(row.get("cz"))
    if not pgc or ra is None or dec is None or cz is None:
        return None
    # The Hubble law: d[Mpc] = cz / H0, so d[pc] = cz / H0 * 1e6.
    distance_pc = cz / H0_KM_S_MPC * 1_000_000.0
    name = (row.get("altname") or "").strip() or f"PGC {pgc}"
    return CatalogObject(
        source_id=pgc,
        kind="galaxy",
        ra_deg=ra,
        dec_deg=dec,
        distance_pc=distance_pc,
        mag=_float(row.get("BT")),
        color_index=_float(row.get("B-VT")),
        provenance=prov,
        extra={
            "name": name,
            "pgc": int(pgc),
            "desig": (row.get("desig") or "").strip() or None,
            "type": (row.get("type") or "").strip() or None,
            "d25_arcmin": _float(row.get("D25")),
            "bt_mag": _float(row.get("BT")),
            "cz_km_s": cz,
            "e_cz_km_s": _float(row.get("e_cz")),
            "distance_mpc": round(distance_pc / 1_000_000.0, 4),
            "distance_method": f"redshift, Hubble law with H0 = {H0_KM_S_MPC:g} km/s/Mpc",
        },
    )


def _float(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None
