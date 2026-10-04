"""Bake: fetch a source, quantize it into a tile, and refresh the manifest."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ingest.catalogs import Catalog
from ingest.schema import CatalogObject
from ingest.sources import gaia, sbdb
from ingest.tiles import Tile, build_tile, read_tile, write_tile
from ingest import manifest as manifest_module

DEFAULT_DIR = "assets/tiles"
SBDB_TILE = "sbdb-small-bodies"


@dataclass(frozen=True, slots=True)
class BakeResult:
    path: Path
    manifest_path: Path
    count: int
    tile: Tile

    def summary(self) -> str:
        header = self.tile.header
        catalog = header.provenance["catalog"]
        release = header.provenance["release"]
        extent = [round(e, 3) for e in header.extent]
        return (
            f"{header.tile_id}: {header.count} objects in {header.unit} "
            f"[{catalog} {release}] extent={extent}"
        )


def bake_gaia(
    limit: int = 5000,
    min_parallax_mas: float = 10.0,
    max_mag: float | None = 12.0,
    out_dir: str = DEFAULT_DIR,
    tile_id: str | None = None,
    catalog: Catalog | None = None,
    endpoint: str | None = None,
) -> BakeResult:
    catalog = catalog or gaia.default_catalog()
    records: list[CatalogObject] = gaia.fetch(
        limit=limit,
        min_parallax_mas=min_parallax_mas,
        max_mag=max_mag,
        catalog=catalog,
        endpoint=endpoint,
    )
    return _write(records, out_dir, tile_id or f"gaia-{catalog.release.lower()}")


def bake_sbdb(
    limit: int = 500,
    kind: str = "a",
    out_dir: str = DEFAULT_DIR,
    tile_id: str | None = None,
) -> BakeResult:
    records = sbdb.fetch(limit=limit, kind=kind)
    return _write(records, out_dir, tile_id or SBDB_TILE)


def _write(records: list[CatalogObject], out_dir: str, tile_id: str) -> BakeResult:
    tile = build_tile(tile_id, records)
    path = write_tile(Path(out_dir) / f"{tile_id}.u3dtile", tile)
    manifest_path = manifest_module.write(out_dir)
    return BakeResult(
        path=path,
        manifest_path=manifest_path,
        count=len(tile),
        tile=read_tile(path),
    )


def load(tile_id: str, out_dir: str = DEFAULT_DIR) -> Tile:
    return read_tile(Path(out_dir) / f"{tile_id}.u3dtile")