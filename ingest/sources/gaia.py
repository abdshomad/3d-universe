"""ESA Gaia star catalog over TAP/ADQL.

Verified from the build host on 2026-10-04:

- `AIP_ENDPOINT` (Gaia@AIP mirror) is the default. A parallax-filtered query
  returns VOTable rows in about a second.
- `ESA_ENDPOINT` (the official archive) is not usable as-is for this query: it
  answers 10-42 s later with an async `JOBID` and a VOTable that carries no
  `TABLEDATA`. Supporting it properly means polling the job, which is separate
  work — so it stays opt-in and fails loudly instead of returning empty results.

Queries are ordered by `parallax DESC, source_id` so the same query always
returns rows in the same order: tile rows can then be matched positionally
against a fresh query during provenance verification.
"""

from __future__ import annotations

from ingest.astro.distance import distance_pc
from ingest.http import FetchError, build_url, fetch_text, now_iso
from ingest.schema import MEASURED, CatalogObject, Provenance
from ingest.sources.base import provenance
from ingest.votable import as_dicts, parse_table, to_float

name = "gaia"
release = "DR3"

AIP_ENDPOINT = "https://gaia.aip.de/tap/sync"
ESA_ENDPOINT = "https://gea.esac.esa.int/tap-server/tap/sync"
TABLE = "gaiadr3.gaia_source"
COLUMNS = "source_id,ra,dec,parallax,phot_g_mean_mag,bp_rp"


def build_query(
    limit: int,
    min_parallax_mas: float,
    max_mag: float | None = None,
    cone: tuple[float, float, float] | None = None,
    table: str = TABLE,
) -> str:
    """ADQL for the nearest, brightest stars; parallax filter is the product."""
    conditions = [f"parallax > {min_parallax_mas}"]
    if max_mag is not None:
        conditions.append(f"phot_g_mean_mag < {max_mag}")
    if cone is not None:
        ra, dec, radius = cone
        conditions.append(
            f"1 = CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra}, {dec}, {radius}))"
        )
    where = " AND ".join(conditions)
    order = "ORDER BY parallax DESC, source_id"
    return f"SELECT TOP {limit} {COLUMNS} FROM {table} WHERE {where} {order}"


def run(
    query: str, endpoint: str = AIP_ENDPOINT, timeout: float = 120.0
) -> tuple[list[str], list[list[str]]]:
    """Execute ADQL and return (fields, rows). Raises when the service returns nothing."""
    url = build_url(endpoint, {"REQUEST": "doQuery", "LANG": "ADQL", "QUERY": query})
    fields, rows = parse_table(fetch_text(url, timeout=timeout))
    if not rows:
        raise FetchError(
            f"{endpoint} returned no rows. The ESA archive answers with an async "
            "job; use the AIP mirror (the default) until job polling exists."
        )
    return fields, rows


def normalize(fields: list[str], rows: list[list[str]], prov: Provenance) -> list[CatalogObject]:
    """Turn query rows into records; a row without a parallax never gets a distance."""
    records: list[CatalogObject] = []
    for row in as_dicts(fields, rows):
        dist = distance_pc(to_float(row.get("parallax")))
        if dist is None:
            continue
        records.append(
            CatalogObject(
                source_id=row["source_id"],
                kind="star",
                ra_deg=to_float(row["ra"]) or 0.0,
                dec_deg=to_float(row["dec"]) or 0.0,
                distance_pc=dist,
                mag=to_float(row.get("phot_g_mean_mag")),
                color_index=to_float(row.get("bp_rp")),
                provenance=prov,
            )
        )
    return records


def fetch(
    limit: int = 100,
    min_parallax_mas: float = 10.0,
    max_mag: float | None = 12.0,
    cone: tuple[float, float, float] | None = None,
    endpoint: str = AIP_ENDPOINT,
    timeout: float = 120.0,
) -> list[CatalogObject]:
    """Fetch stars with a usable parallax and normalize them."""
    query = build_query(limit, min_parallax_mas, max_mag, cone)
    fields, rows = run(query, endpoint, timeout)
    prov = provenance(
        catalog="esa.gaia",
        release=release,
        query=query,
        source_url=build_url(endpoint, {"REQUEST": "doQuery", "LANG": "ADQL", "QUERY": query}),
        fetched_at=now_iso(),
        flag=MEASURED,
    )
    return normalize(fields, rows, prov)