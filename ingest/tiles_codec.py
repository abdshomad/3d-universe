"""The quantization helpers the tile builder uses.

Positions, magnitudes and colours are quantized to
the tile format's fixed widths here; the errors the
quantization introduces are what the verifier proves
a tile round-trips within.
"""

from __future__ import annotations

from typing import Any

from ingest.schema import CatalogObject

# The tile format's fixed widths: a position
# component is a 16-bit unsigned fraction of the
# tile's extent, a magnitude a 16-bit signed count
# of milli-mags.
MAX_POSITION_U16 = 65535
MILLI_MAGS_PER_MAG = 1000


def provenance_of(record: CatalogObject) -> dict[str, Any]:
    """The provenance a tile header carries, from its
    first record -- every record in a tile comes from
    one query against one catalogue."""
    prov = record.provenance
    return {
        "catalog": prov.catalog,
        "release": prov.release,
        "flag": prov.flag,
        "query": prov.query,
        "source_url": prov.source_url,
        "fetched_at": prov.fetched_at,
    }


def quantize(value: float, origin: float, extent: float) -> int:
    """One position component, as a 16-bit fraction
    of the tile's extent."""
    scaled = (value - origin) / extent * MAX_POSITION_U16
    return int(min(max(round(scaled), 0), MAX_POSITION_U16))


def magnitude_range(records: list[CatalogObject]) -> list[float]:
    """Brightest and faintest magnitude baked into a tile, for LOD decisions."""
    values = [record.mag for record in records if record.mag is not None]
    if not values:
        return []
    return [round(min(values), 3), round(max(values), 3)]


def quantize_mag(magnitude: float | None) -> int:
    """A magnitude as 16-bit signed milli-mags.

    A magnitude beyond +-32.767 -- Pluto, at 35.4 --
    is clamped: the format cannot carry it, and the
    sidecar carries the true value instead.
    """
    if magnitude is None:
        return 0
    scaled = round(magnitude * MILLI_MAGS_PER_MAG)
    limit = 32767
    return int(min(max(scaled, -limit), limit))
