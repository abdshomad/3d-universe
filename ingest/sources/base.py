"""The contracts every source module implements."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ingest.schema import CatalogObject, ImageAsset, Provenance


@runtime_checkable
class Source(Protocol):
    """A remote catalog that normalizes into CatalogObject records."""

    name: str
    release: str

    def fetch(self, **options) -> list[CatalogObject]:
        """Fetch records. Implementations raise on failure; never return fakes."""
        ...


@runtime_checkable
class ImageSource(Protocol):
    """A source that yields imagery rather than catalog objects."""

    name: str
    release: str

    def fetch_images(self, **options) -> list[ImageAsset]:
        """Fetch image assets. Implementations raise on failure."""
        ...


def provenance(
    catalog: str,
    release: str,
    query: str,
    source_url: str,
    fetched_at: str,
    flag: str,
) -> Provenance:
    return Provenance(
        catalog=catalog,
        release=release,
        query=query,
        source_url=source_url,
        fetched_at=fetched_at,
        flag=flag,
    )