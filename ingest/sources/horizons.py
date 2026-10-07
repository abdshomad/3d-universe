"""JPL Horizons API: the solar-system majors and their
satellites.

Positions are geocentric apparent (ICRF) at a stated
epoch -- where the body actually is in the observer's
sky -- with the apparent visual magnitude the same
ephemeris serves. A body's position is an ephemeris,
not a fact: every record carries the epoch it is valid
for.

Earth is the observer's vantage, not a body the atlas
flies to: it holds no geocentric position and is not in
the list. The body codes are the ones the live API
returned on 2026-10-07, not codes from memory -- 607 is
Hyperion and 608 Iapetus (swapped in many lists), and
the Uranian moons run Ariel, Umbriel, Titania, Oberon,
Miranda, not by distance from Uranus.
"""

from __future__ import annotations

import re

from ingest.astro.orbits import ARCSEC_PER_RAD
from ingest.http import build_url, fetch_json, now_iso
from ingest.schema import MEASURED, CatalogObject, Provenance
from ingest.sources.base import provenance

name = "horizons"
# The release is the ephemeris epoch: every position is
# valid for it, and the card says so.
release = "2026-01-01"

ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api"
SOURCE_URL = "https://ssd.jpl.nasa.gov/horizons/"
EPOCH = "2026-01-01"
STOP = "2026-01-02"

# The parameter set every record came from, with the body
# code the one variable. The verifier re-runs it.
PARAMETERS = {
    "format": "json",
    "OBJ_DATA": "'YES'",
    "MAKE_EPHEM": "'YES'",
    "EPHEM_TYPE": "'OBSERVER'",
    "CENTER": "'500@399'",
    "START_TIME": f"'{EPOCH}'",
    "STOP_TIME": f"'{STOP}'",
    "STEP_SIZE": "'1 d'",
    "QUANTITIES": "'1,19,20'",
    "ANG_FORMAT": "'DEG'",
    "RANGE_UNITS": "'AU'",
    "SUPPRESS_RANGE_RATE": "'YES'",
}

MAJORS = [
    ("Mercury", "199"), ("Venus", "299"), ("Mars", "499"),
    ("Jupiter", "599"), ("Saturn", "699"), ("Uranus", "799"),
    ("Neptune", "899"), ("Pluto", "999"),
]
MOONS = [
    ("Moon", "301"),
    ("Io", "501"), ("Europa", "502"), ("Ganymede", "503"),
    ("Callisto", "504"),
    ("Mimas", "601"), ("Enceladus", "602"), ("Tethys", "603"),
    ("Dione", "604"), ("Rhea", "605"), ("Titan", "606"),
    ("Hyperion", "607"), ("Iapetus", "608"), ("Phoebe", "609"),
    ("Ariel", "701"), ("Umbriel", "702"), ("Titania", "703"),
    ("Oberon", "704"), ("Miranda", "705"),
    ("Triton", "801"), ("Charon", "901"),
]


def body_list(kind: str) -> list[tuple[str, str]]:
    """The bodies a dataset holds, by its kind."""
    if kind == "planet":
        return MAJORS
    if kind == "satellite":
        return MOONS
    raise ValueError(f"no Horizons body list for kind {kind!r}")


def query_template() -> str:
    """The parameter set with the body code as the variable."""
    return build_url(ENDPOINT, {**PARAMETERS, "COMMAND": "'<body>'"})


def query_url(code: str) -> str:
    """One body's exact query -- what its card cites."""
    return build_url(ENDPOINT, {**PARAMETERS, "COMMAND": f"'{code}'"})


def fetch(
    kind: str = "planet",
    endpoint: str = ENDPOINT,
    timeout: float = 60.0,
) -> list[CatalogObject]:
    """Fetch every body of a kind, geocentric at the epoch."""
    prov = provenance(
        catalog="nasa.jpl.horizons",
        release=release,
        query=query_template(),
        source_url=SOURCE_URL,
        fetched_at=now_iso(),
        flag=MEASURED,
    )
    records: list[CatalogObject] = []
    for body_name, code in body_list(kind):
        record = _to_object(
            _ephemeris(code, endpoint, timeout), body_name, code, kind, prov
        )
        if record is not None:
            records.append(record)
    return records


def run_url(url: str, timeout: float = 60.0) -> str:
    """Re-run one stored body query (used by verification)."""
    payload = fetch_json(url, timeout=timeout)
    return payload.get("result", "")


def _ephemeris(code: str, endpoint: str, timeout: float) -> str:
    """One body's observer ephemeris, as the API's text."""
    payload = fetch_json(query_url(code), timeout=timeout)
    return payload.get("result", "")


def _to_object(
    text: str, body_name: str, code: str, kind: str, prov: Provenance
) -> CatalogObject | None:
    observed = _observed(text)
    if observed is None:
        return None
    ra_deg, dec_deg, apmag, delta_au = observed
    return CatalogObject(
        source_id=code,
        kind=kind,
        ra_deg=ra_deg,
        dec_deg=dec_deg,
        # A parsec is 206264.8 AU, so a body delta
        # AU away is delta / 206264.8 pc -- the same
        # conversion the astro helpers apply to
        # kilometres. Multiplying instead would put
        # the planets 4e10 times too far.
        distance_pc=delta_au / ARCSEC_PER_RAD,
        mag=apmag,
        color_index=None,
        provenance=prov,
        extra={
            "name": body_name,
            "horizons_code": int(code),
            "epoch": EPOCH,
            "ephemeris_source": _ephemeris_source(text),
            "apmag": apmag,
            "delta_au": round(delta_au, 7),
            "radius_km": _number(
                text, r"(?:Vol\. )?[Mm]ean radius.*?=\s*([0-9.]+)"
            ),
            "v_zero": _number(text, r"V\(1,0\)\s*=\s*([+\-0-9.]+)"),
            "albedo": _number(text, r"Geometric Albedo\s*=\s*([0-9.]+)"),
            "mass_kg": _mass_kg(text),
            "query": query_url(code),
        },
    )


def _observed(text: str) -> tuple[float, float, float, float] | None:
    """The first ephemeris row: RA and DEC in degrees, the
    apparent visual magnitude, and the observer range in AU."""
    match = re.search(
        r"\$\$SOE\n\s*\S+\s+\S+\s+(-?[\d.]+)\s+(-?[\d.]+)"
        r"\s+(-?[\d.]+)\s+(-?[\d.]+)",
        text,
    )
    if match is None:
        return None
    ra, dec, apmag, delta = (float(value) for value in match.groups())
    return (ra, dec, apmag, delta)


def _ephemeris_source(text: str) -> str | None:
    """The ephemeris the target block names, e.g. DE441."""
    match = re.search(r"\{source: ([^}]+)\}", text)
    return match.group(1).strip() if match else None


def _number(text: str, pattern: str) -> float | None:
    match = re.search(pattern, text)
    if match is None:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _mass_kg(text: str) -> float | None:
    """The mass, in kg, from either block format.

    The Moon's block reads 'Mass, x10^22 kg = 7.349';
    a planet's reads 'Mass x10^23 (kg) = 6.4171'. The
    exponent is part of the measurement, so the value
    is normalized to kg here rather than left in a
    per-body unit.
    """
    match = re.search(
        r"Mass[,\s]*x10\^(\d+)\s*(?:\(kg\)|kg)?\s*=\s*([0-9.]+)",
        text,
    )
    if match is None:
        return None
    try:
        return float(match.group(2)) * 10.0 ** int(match.group(1))
    except ValueError:
        return None
