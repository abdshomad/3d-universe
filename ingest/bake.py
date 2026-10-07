"""Bake: fetch a source, quantize it into a tile, and refresh the manifest."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from ingest.catalogs import Catalog
from ingest.schema import CatalogObject
from ingest.sources import black_holes, galaxies, gaia, horizons, sbdb
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
    sidecar_path: Path | None = None

    def summary(self) -> str:
        header = self.tile.header
        catalog = header.provenance["catalog"]
        release = header.provenance["release"]
        extent = [round(e, 3) for e in header.extent]
        base = (
            f"{header.tile_id}: {header.count} objects in {header.unit} "
            f"[{catalog} {release}] extent={extent}"
        )
        if self.sidecar_path is not None:
            base += f" + {self.sidecar_path.name}"
        return base


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
    return _write(
        records, out_dir, tile_id or f"gaia-{catalog.release.lower()}",
        extra={"dataset_kind": "star"},
    )


def bake_sbdb(
    limit: int = 500,
    kind: str = "a",
    out_dir: str = DEFAULT_DIR,
    tile_id: str | None = None,
) -> BakeResult:
    """Bake asteroids ('a') or comets ('c').

    Comets are bound orbits only: a parabolic or
    hyperbolic comet has no place in a solar-system
    atlas, and the dataset's count says so.
    """
    records = sbdb.fetch(limit=limit, kind=kind)
    if kind == "c":
        records = [
            record for record in records
            if (record.extra.get("e") or 0.0) < 1.0
        ]
    dataset_kind = "comet" if kind == "c" else "small_body"
    tile_id = tile_id or SBDB_TILE
    result = _write(records, out_dir, tile_id,
                    extra={"dataset_kind": dataset_kind})
    sidecar = write_sidecar(
        records, Path(out_dir) / f"{tile_id}.json",
        id_key="spkid", rows_name="bodies",
        dataset_kind=dataset_kind,
    )
    return _with_sidecar(result, sidecar)


def bake_horizons(
    kind: str = "planet",
    out_dir: str = DEFAULT_DIR,
    tile_id: str | None = None,
    timeout: float = 60.0,
) -> BakeResult:
    """The solar-system majors or their satellites."""
    records = horizons.fetch(kind=kind, timeout=timeout)
    tile_id = tile_id or f"horizons-{kind}s"
    result = _write(records, out_dir, tile_id,
                    extra={"dataset_kind": kind})
    sidecar = write_sidecar(
        records, Path(out_dir) / f"{tile_id}.json",
        id_key="code", rows_name="bodies",
        dataset_kind=kind,
    )
    return _with_sidecar(result, sidecar)


def bake_galaxies(
    out_dir: str = DEFAULT_DIR,
    tile_id: str | None = None,
    timeout: float = 240.0,
) -> BakeResult:
    """Bright galaxies with a measured redshift."""
    tile_id = tile_id or "galaxies-rc3"
    records = galaxies.fetch(timeout=timeout)
    result = _write(records, out_dir, tile_id,
                    extra={"dataset_kind": "galaxy"})
    sidecar = write_sidecar(
        records, Path(out_dir) / f"{tile_id}.json",
        id_key="pgc", rows_name="galaxies",
        dataset_kind="galaxy",
    )
    return _with_sidecar(result, sidecar)


def bake_black_holes(
    out_dir: str = DEFAULT_DIR,
    tile_id: str | None = None,
    timeout: float = 240.0,
) -> BakeResult:
    """Black-hole transients with a measured distance."""
    tile_id = tile_id or "black-holes"
    records = black_holes.fetch(timeout=timeout)
    result = _write(records, out_dir, tile_id,
                    extra={"dataset_kind": "black_hole"})
    sidecar = write_sidecar(
        records, Path(out_dir) / f"{tile_id}.json",
        id_key="recno", rows_name="black_holes",
        dataset_kind="black_hole",
    )
    return _with_sidecar(result, sidecar)


def _write(
    records: list[CatalogObject],
    out_dir: str,
    tile_id: str,
    extra: dict[str, str] | None = None,
) -> BakeResult:
    tile = build_tile(tile_id, records, extra=extra)
    path = write_tile(Path(out_dir) / f"{tile_id}.u3dtile", tile)
    manifest_path = manifest_module.write(out_dir)
    return BakeResult(
        path=path,
        manifest_path=manifest_path,
        count=len(tile),
        tile=read_tile(path),
    )


def _with_sidecar(result: BakeResult, sidecar: Path) -> BakeResult:
    return BakeResult(
        path=result.path,
        manifest_path=result.manifest_path,
        count=result.count,
        tile=result.tile,
        sidecar_path=sidecar,
    )


def write_sidecar(
    records: list[CatalogObject],
    path: Path,
    id_key: str,
    rows_name: str = "bodies",
    dataset_kind: str | None = None,
) -> Path:
    """The rows a fact card needs that a tile cannot carry.

    A tile stores ids, positions, magnitudes and colours -- enough to
    draw and to cite. A card also names the body, its diameter and the
    orbital epoch its position is valid for, so those rows travel
    beside the tile as their own cited asset.
    """
    if not records:
        raise ValueError("no records to write")
    prov = records[0].provenance
    payload = {
        "citation": {
            "catalog": prov.catalog,
            "release": prov.release,
            "source_url": prov.source_url,
            "retrieved": prov.fetched_at,
        },
        "count": len(records),
        rows_name: [
            {id_key: record.source_id, **record.extra}
            for record in records
        ],
    }
    if dataset_kind is not None:
        payload["dataset_kind"] = dataset_kind
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def write_sbdb_sidecar(records: list[CatalogObject], path: Path) -> Path:
    """The small-body sidecar, keyed by spkid."""
    return write_sidecar(records, path, id_key="spkid")


def load(tile_id: str, out_dir: str = DEFAULT_DIR) -> Tile:
    return read_tile(Path(out_dir) / f"{tile_id}.u3dtile")