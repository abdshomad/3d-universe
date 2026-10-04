"""Provenance round-trip: does every id in a tile resolve back to its catalog row?

A tile is only worth loading if its objects can be traced. This re-runs the
query recorded in the tile header against the same service, matches rows by
catalog id, and compares the position actually stored in the tile against the
position the catalog reports now.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ingest.astro.coordinates import ra_dec_to_vector
from ingest.schema import CatalogObject, Provenance
from ingest.sources import gaia, sbdb
from ingest.tiles import (
    PARSEC_PER_AU,
    SMALL_BODY_UNIT,
    Tile,
    decode_position,
    quantization_error,
    read_tile,
)

MAGNITUDE_TOLERANCE = 0.001


@dataclass(frozen=True, slots=True)
class VerificationReport:
    tile_id: str
    catalog: str
    release: str
    checked: int
    missing: int
    max_position_delta: float
    max_magnitude_delta: float
    position_tolerance: float
    ok: bool

    def summary(self) -> str:
        verdict = "OK" if self.ok else "FAILED"
        return (
            f"{self.tile_id}: {verdict} — {self.checked}/{self.checked + self.missing} "
            f"ids resolved against {self.catalog} {self.release}; "
            f"max position delta {self.max_position_delta:.6f} "
            f"(tolerance {self.position_tolerance:.6f}), "
            f"max magnitude delta {self.max_magnitude_delta:.5f}"
        )


def refetch(tile: Tile) -> list[CatalogObject]:
    """Re-run the query stored in the tile header against the same endpoint."""
    prov = Provenance.from_dict(tile.header.provenance)
    endpoint = prov.source_url.split("?")[0] or gaia.AIP_ENDPOINT

    if prov.catalog == "esa.gaia":
        fields, rows = gaia.run(prov.query, endpoint=endpoint)
        return gaia.normalize(fields, rows, prov)
    if prov.catalog == "nasa.jpl.sbdb":
        return sbdb.run_url(prov.source_url)
    raise ValueError(f"no verifier for catalog {prov.catalog!r}")


def verify_tile(path: str | Path) -> VerificationReport:
    """Match a tile against its catalog, id by id."""
    tile = read_tile(path)
    header = tile.header
    fresh = {}
    for record in refetch(tile):
        try:
            fresh[int(record.source_id)] = record
        except ValueError:
            continue

    unit_scale = PARSEC_PER_AU if header.unit == SMALL_BODY_UNIT else 1.0
    checked = 0
    missing = 0
    max_position = 0.0
    max_magnitude = 0.0

    for index in range(len(tile)):
        record = fresh.get(tile.id_at(index))
        if record is None or record.distance_pc is None:
            missing += 1
            continue
        checked += 1
        ux, uy, uz = ra_dec_to_vector(record.ra_deg, record.dec_deg)
        distance = float(record.distance_pc) * unit_scale
        dx, dy, dz = decode_position(tile, index)
        max_position = max(max_position, abs(ux * distance - dx), abs(uy * distance - dy), abs(uz * distance - dz))
        if record.mag is not None:
            max_magnitude = max(max_magnitude, abs(record.mag - tile.mag[index] / 1000.0))

    tolerance = quantization_error(tile)
    ok = missing == 0 and max_position <= tolerance * 1.001 and max_magnitude <= MAGNITUDE_TOLERANCE
    prov = header.provenance
    return VerificationReport(
        tile_id=header.tile_id,
        catalog=prov.get("catalog", "unknown"),
        release=prov.get("release", "unknown"),
        checked=checked,
        missing=missing,
        max_position_delta=max_position,
        max_magnitude_delta=max_magnitude,
        position_tolerance=tolerance,
        ok=ok,
    )


def verify_dir(tile_dir: str | Path) -> list[VerificationReport]:
    """Verify every tile in a directory, ordered by tile id."""
    root = Path(tile_dir)
    return [verify_tile(path) for path in sorted(root.glob("*.u3dtile")) if path.is_file()]