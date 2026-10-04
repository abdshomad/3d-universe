"""Offline ingestion: public catalogs -> normalized records.

Every source module fetches through `ingest.http`, normalizes into
`ingest.schema.CatalogObject`, and keeps its provenance. Nothing here runs in
the browser.
"""

__all__ = ["schema", "http", "astro", "sources"]