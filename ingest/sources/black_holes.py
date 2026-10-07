"""The black-hole transient catalogue (Corral-Santana et
al. 2016, A&A 587, A61), via VizieR's TAP service.

Table a1 lists the transients with positions; table a4
lists the dynamical black holes with masses. A row
measures a position always, a distance for 33 of 57, a
mass for 17 -- and the card says which, because a row
that carries only a position is not given a distance.

Distances are catalogue kiloparsecs, converted to parsecs
for the tile; the card quotes kpc. Distance limits
(<, >, ~) ride on the record: an upper limit is not a
measurement.
"""

from __future__ import annotations

import csv
import io
import urllib.parse

from ingest.http import fetch_text, now_iso
from ingest.schema import MEASURED, CatalogObject, Provenance
from ingest.sources.base import provenance

name = "black_holes"
release = "2016"

TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"
TABLE_A1 = '"J/A+A/587/A61/tablea1"'
TABLE_A4 = '"J/A+A/587/A61/tablea4"'
SOURCE_URL = "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/587/A61"

# Only rows with a measured distance are placed in 3D; the
# 24 without one are sky positions, and the dataset count
# says so.
A1_QUERY = (
    f"SELECT recno, Name, RAJ2000, DEJ2000, l_Dist, Dist, e_Dist, Refs "
    f"FROM {TABLE_A1} WHERE Dist > 0"
)
# The mass columns are quoted identifiers: the TAP
# layer rejects 'e_M1' bare, and the table carries
# both an upper (E_M1) and a lower (e_M1) error --
# GS 2023+338 is +0.2/-0.6, so the asymmetry is
# part of the measurement. l_M1 flags a limit.
A4_QUERY = (
    f'SELECT Name, l_M1, M1, "E_M1", "e_M1", Ref '
    f"FROM {TABLE_A4}"
)


def fetch(
    endpoint: str = TAP_URL,
    timeout: float = 240.0,
) -> list[CatalogObject]:
    """Fetch every transient with a measured distance, joined
    to the dynamical masses by name."""
    prov = provenance(
        catalog="cds.vizier.a61",
        release=release,
        query=f"{A1_QUERY} ; {A4_QUERY}",
        source_url=SOURCE_URL,
        fetched_at=now_iso(),
        flag=MEASURED,
    )
    masses = {
        (row.get("Name") or "").strip(): row
        for row in _query(endpoint, A4_QUERY, timeout)
    }
    records: list[CatalogObject] = []
    for row in _query(endpoint, A1_QUERY, timeout):
        record = _to_object(row, masses.get((row.get("Name") or "").strip()), prov)
        if record is not None:
            records.append(record)
    return records


def _to_object(
    row: dict, mass_row: dict | None, prov: Provenance
) -> CatalogObject | None:
    recno = (row.get("recno") or "").strip()
    name = (row.get("Name") or "").strip()
    ra = _float(row.get("RAJ2000"))
    dec = _float(row.get("DEJ2000"))
    dist_kpc = _float(row.get("Dist"))
    if not recno or not name or ra is None or dec is None or dist_kpc is None:
        return None
    limit = (row.get("l_Dist") or "").strip() or None
    mass = _float(mass_row.get("M1")) if mass_row else None
    mass_limit = (
        (mass_row.get("l_M1") or "").strip() or None
        if mass_row
        else None
    )
    mass_upper = (
        _float(mass_row.get("E_M1")) if mass_row else None
    )
    mass_lower = (
        _float(mass_row.get("e_M1")) if mass_row else None
    )
    return CatalogObject(
        source_id=recno,
        kind="black_hole",
        ra_deg=ra,
        dec_deg=dec,
        distance_pc=dist_kpc * 1000.0,
        mag=None,
        color_index=None,
        provenance=prov,
        extra={
            "name": name,
            "distance_kpc": dist_kpc,
            "distance_limit": limit,
            "e_distance_kpc": _float(row.get("e_Dist")),
            "mass_sun": mass,
            "mass_limit": mass_limit,
            "mass_upper_sun": mass_upper,
            "mass_lower_sun": mass_lower,
            "distance_source": "corral-santana-tablea1" + (
                "-limit" if limit else ""
            ),
            "mass_source": "corral-santana-tablea4" if mass is not None else None,
            "references": (row.get("Refs") or "").strip() or None,
            "mass_references": (
                (mass_row.get("Ref") or "").strip() if mass_row else None
            ),
        },
    )


def _query(endpoint: str, query: str, timeout: float) -> list[dict]:
    url = f"{endpoint}?{urllib.parse.urlencode({
        'REQUEST': 'doQuery', 'LANG': 'ADQL',
        'FORMAT': 'csv', 'QUERY': query,
    })}"
    return [
        row for row in csv.DictReader(
            io.StringIO(fetch_text(url, timeout=timeout))
        )
    ]


def _float(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None
