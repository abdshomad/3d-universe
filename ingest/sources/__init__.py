"""One module per public source. Each owns its access path and its schema."""

from ingest.sources import gaia, imagery, sbdb

SOURCES = {
    gaia.name: gaia,
    sbdb.name: sbdb,
    imagery.name: imagery,
}

__all__ = ["SOURCES", "gaia", "sbdb", "imagery"]