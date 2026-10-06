"""Normalized record schema shared by every source module.

One shape for everything that ends up in a tile: a catalog object with a
provenance record that survives all the way to the fact card.
"""

from __future__ import annotations
from dataclasses import asdict, dataclass, field
from typing import Any

# Provenance flags. The renderer must be able to answer "measured or not?" in O(1).
MEASURED = "MEASURED"
SURVEY_STATISTICAL = "SURVEY_STATISTICAL"
SIMULATED = "SIMULATED"


@dataclass(frozen=True, slots=True)
class Provenance:
    """Where a record came from, in enough detail to cite it."""

    catalog: str
    release: str
    query: str
    source_url: str
    fetched_at: str
    flag: str = MEASURED

    def citation(self) -> str:
        return f"{self.catalog} {self.release}"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Provenance":
        """Rebuild from a tile header, so a card can cite with the catalog offline."""
        known = {"catalog", "release", "query", "source_url", "fetched_at", "flag"}
        return cls(**{key: value for key, value in data.items() if key in known})


@dataclass(frozen=True, slots=True)
class CatalogObject:
    """A single object with a measured 3D position.

    `distance_pc` is None when no usable parallax exists: such an object has no
    position in 3D and must never enter the star tier.
    """

    source_id: str
    kind: str
    ra_deg: float
    dec_deg: float
    distance_pc: float | None
    mag: float | None
    color_index: float | None
    provenance: Provenance
    # Source rows carry more than the normalized fields a tile can
    # store: a small body's name, diameter and the epoch its
    # position is valid for. Only the source that has them sets it.
    extra: dict[str, Any] = field(default_factory=dict)

    def as_row(self) -> dict[str, Any]:
        row = asdict(self)
        row["flag"] = self.provenance.flag
        return row


@dataclass(frozen=True, slots=True)
class ImageAsset:
    """A public-domain telescope image usable as a deep-field backdrop."""

    asset_id: str
    title: str
    asset_url: str
    page_url: str
    credit: str
    provenance: Provenance

    def as_row(self) -> dict[str, Any]:
        return asdict(self)