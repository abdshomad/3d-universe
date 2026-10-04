"""JPL Small-Body Database: solar-system objects in real 3D positions.

Orbital elements come from the SBDB Query API; positions are computed from
those elements at the catalog epoch, so every record carries the epoch it is
valid for rather than pretending it is current forever. The record id is the
numeric `spkid`, which is what the tile format stores.
"""

from __future__ import annotations

import math

from ingest.astro.orbits import (
    AU_KM,
    OrbitalElements,
    apparent_magnitude,
    distance_pc_from_km,
    ecliptic_to_equatorial,
    earth_heliocentric_au,
    heliocentric_ecliptic_km,
)
from ingest.http import build_url, fetch_json, now_iso
from ingest.schema import MEASURED, CatalogObject, Provenance
from ingest.sources.base import provenance

name = "sbdb"
release = "live"

ENDPOINT = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
FIELDS = "spkid,pdes,full_name,H,a,e,i,om,w,ma,epoch,diameter"


def fetch(
    limit: int = 50,
    kind: str = "a",
    endpoint: str = ENDPOINT,
    timeout: float = 60.0,
) -> list[CatalogObject]:
    """Fetch small bodies and place them geocentrically at the catalog epoch."""
    url = build_url(endpoint, {"fields": FIELDS, "sb-kind": kind, "limit": str(limit)})
    return run_url(url, timeout=timeout)


def run_url(url: str, timeout: float = 60.0) -> list[CatalogObject]:
    """Re-run a stored SBDB query URL and normalize it (used by verification)."""
    payload = fetch_json(url, timeout=timeout)
    prov = provenance(
        catalog="nasa.jpl.sbdb",
        release=release,
        query=url,
        source_url=url,
        fetched_at=now_iso(),
        flag=MEASURED,
    )
    records: list[CatalogObject] = []
    for values in payload.get("data", []):
        record = _to_object(dict(zip(payload.get("fields", []), values)), prov)
        if record is not None:
            records.append(record)
    return records


def _to_object(row: dict, prov: Provenance) -> CatalogObject | None:
    elements = _elements(row)
    if elements is None or not row.get("spkid"):
        return None

    x_km, y_km, z_km = heliocentric_ecliptic_km(elements)
    r_au = math.sqrt(x_km**2 + y_km**2 + z_km**2) / AU_KM
    ra, dec = ecliptic_to_equatorial(x_km, y_km, z_km)

    earth = earth_heliocentric_au(elements.epoch_jd)
    delta_au = math.sqrt(
        sum((a / AU_KM - e_au) ** 2 for a, e_au in zip((x_km, y_km, z_km), earth))
    )

    abs_mag = _number(row.get("H"))
    mag = apparent_magnitude(abs_mag, r_au, delta_au) if abs_mag is not None else None

    return CatalogObject(
        source_id=str(row["spkid"]).strip(),
        kind="small_body",
        ra_deg=math.degrees(ra),
        dec_deg=math.degrees(dec),
        distance_pc=distance_pc_from_km(delta_au * AU_KM),
        mag=mag,
        color_index=None,
        provenance=prov,
    )


def _elements(row: dict) -> OrbitalElements | None:
    semi_major = _number(row.get("a"))
    eccentricity = _number(row.get("e"))
    epoch = _number(row.get("epoch"))
    if semi_major is None or eccentricity is None or epoch is None:
        return None
    return OrbitalElements(
        a_au=semi_major,
        e=eccentricity,
        i_deg=_number(row.get("i")) or 0.0,
        om_deg=_number(row.get("om")) or 0.0,
        w_deg=_number(row.get("w")) or 0.0,
        ma_deg=_number(row.get("ma")) or 0.0,
        epoch_jd=epoch,
    )


def _number(value: str | None) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None