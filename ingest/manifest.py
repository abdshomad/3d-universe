"""The tile manifest: the index the renderer loads before it loads anything else.

Every tile in a directory is described here — bounds, unit, provenance and a
checksum — so a load can verify what it received and a fact card can cite a row
without the catalog being online.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ingest.tiles import read_tile

MANIFEST_NAME = "manifest.json"
MANIFEST_VERSION = 1
TILE_SUFFIX = ".u3dtile"


@dataclass(frozen=True, slots=True)
class TileEntry:
    tile_id: str
    file: str
    unit: str
    count: int
    origin: list[float]
    extent: list[float]
    bytes: int
    sha256: str
    flag: str
    catalog: str
    release: str
    first_source_id: str
    last_source_id: str
    mag_range: list[float] = field(default_factory=list)
    # The dataset kind the tile carries, lifted from the
    # tile header's extra -- what the renderer and the
    # celestial menu dispatch on.
    kind: str = ""


@dataclass(slots=True)
class Manifest:
    version: int
    generated_at: str
    tiles: list[TileEntry] = field(default_factory=list)

    def tile_ids(self) -> list[str]:
        return [tile.tile_id for tile in self.tiles]

    def entry(self, tile_id: str) -> TileEntry:
        for tile in self.tiles:
            if tile.tile_id == tile_id:
                return tile
        raise KeyError(f"no such tile in manifest: {tile_id}")

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)


def checksum(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def entry_for(path: str | Path) -> TileEntry:
    """Describe one tile by reading its header and hashing its bytes."""
    file_path = Path(path)
    header = read_tile(file_path).header
    prov: dict[str, Any] = header.provenance
    return TileEntry(
        tile_id=header.tile_id,
        file=file_path.name,
        unit=header.unit,
        count=header.count,
        origin=[round(value, 9) for value in header.origin],
        extent=[round(value, 9) for value in header.extent],
        bytes=file_path.stat().st_size,
        sha256=checksum(file_path),
        flag=prov.get("flag", "UNKNOWN"),
        catalog=prov.get("catalog", "unknown"),
        release=prov.get("release", "unknown"),
        first_source_id=header.first_source_id,
        last_source_id=header.last_source_id,
        mag_range=list(header.mag_range),
        kind=header.extra.get("dataset_kind", ""),
    )


def build(tile_dir: str | Path) -> Manifest:
    """Scan a directory of tiles into a manifest, ordered by tile id."""
    root = Path(tile_dir)
    entries = [
        entry_for(path)
        for path in sorted(root.glob(f"*{TILE_SUFFIX}"))
        if path.is_file()
    ]
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return Manifest(version=MANIFEST_VERSION, generated_at=generated, tiles=entries)


def write(tile_dir: str | Path) -> Path:
    root = Path(tile_dir)
    root.mkdir(parents=True, exist_ok=True)
    manifest = build(root)
    target = root / MANIFEST_NAME
    target.write_text(manifest.to_json(), encoding="utf-8")
    return target


def load(tile_dir: str | Path) -> Manifest:
    raw = json.loads((Path(tile_dir) / MANIFEST_NAME).read_text(encoding="utf-8"))
    return Manifest(
        version=raw["version"],
        generated_at=raw["generated_at"],
        tiles=[TileEntry(**tile) for tile in raw["tiles"]],
    )