"""Binary tiles: the format the renderer actually loads.

A tile is a JSON header followed by a struct-of-arrays payload. Positions are
quantized to 16 bits per axis inside the tile bounds, magnitude to milli-
magnitudes, colour to 8 bits per channel: ~11 bytes per star, with a
quantization error far below the catalog's own astrometric error.

Layout:

    magic   b"U3DTILE1"
    u32     header length
    header  UTF-8 JSON (tile id, unit, count, origin, extent, provenance)
    payload pos_q[3*n] u16 | mag[n] i16 | rgb[3*n] u8

Positions are quantized in the tile's own unit: parsecs for stars (Gaia's reach)
or astronomical units for small bodies. Ceres sits 2e-5 pc away, so quantizing
the solar system in parsecs would collapse the whole tier into one point.
"""

from __future__ import annotations

import json
import struct
from array import array
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable

from ingest.astro.coordinates import ra_dec_to_vector
from ingest.astro.photometry import color_to_rgb
from ingest.schema import CatalogObject

MAGIC = b"U3DTILE1"
HEADER_SIZE = len(MAGIC) + 4
MILLI_MAGS_PER_MAG = 1000
MAX_POSITION_U16 = 65535
PARSEC_PER_AU = 206264.806247
SMALL_BODY_UNIT = "au"
STAR_UNIT = "pc"


class TileError(RuntimeError):
    """A tile file is missing, truncated or not a tile."""


@dataclass(slots=True)
class TileHeader:
    tile_id: str
    unit: str
    count: int
    origin: list[float]
    extent: list[float]
    provenance: dict[str, Any]
    first_source_id: str
    last_source_id: str
    extra: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> bytes:
        return json.dumps(asdict(self), separators=(",", ":")).encode("utf-8")

    @classmethod
    def from_json(cls, raw: bytes) -> "TileHeader":
        return cls(**json.loads(raw.decode("utf-8")))


@dataclass(slots=True)
class Tile:
    header: TileHeader
    pos_q: array
    mag: array
    rgb: array

    def __len__(self) -> int:
        return self.header.count


def unit_for(records: Iterable[CatalogObject]) -> str:
    """Small bodies need AU; everything else is catalogued in parsecs."""
    for record in records:
        return SMALL_BODY_UNIT if record.kind == "small_body" else STAR_UNIT
    return STAR_UNIT


def build_tile(tile_id: str, records: Iterable[CatalogObject]) -> Tile:
    """Quantize catalog records into a tile. Records without a distance are skipped."""
    kept = [r for r in records if r.distance_pc is not None]
    if not kept:
        raise TileError("no record carries a distance; nothing to bake")

    unit = unit_for(kept)
    scale = PARSEC_PER_AU if unit == SMALL_BODY_UNIT else 1.0
    positions = []
    for record in kept:
        ux, uy, uz = ra_dec_to_vector(record.ra_deg, record.dec_deg)
        distance = float(record.distance_pc) * scale
        positions.append((ux * distance, uy * distance, uz * distance))

    mins = [min(p[axis] for p in positions) for axis in range(3)]
    maxs = [max(p[axis] for p in positions) for axis in range(3)]
    extent = [max(maxs[axis] - mins[axis], 1e-12) for axis in range(3)]

    pos_q = array("H", bytes(6 * len(kept)))
    mag = array("h", bytes(2 * len(kept)))
    rgb = array("B", bytes(3 * len(kept)))

    for index, record in enumerate(kept):
        px, py, pz = positions[index]
        pos_q[3 * index : 3 * index + 3] = array(
            "H",
            [
                _quantize(px, mins[0], extent[0]),
                _quantize(py, mins[1], extent[1]),
                _quantize(pz, mins[2], extent[2]),
            ],
        )
        mag[index] = _quantize_mag(record.mag)
        r, g, b = color_to_rgb(record.color_index)
        rgb[3 * index : 3 * index + 3] = array("B", [int(r * 255), int(g * 255), int(b * 255)])

    header = TileHeader(
        tile_id=tile_id,
        unit=unit,
        count=len(kept),
        origin=mins,
        extent=extent,
        provenance=_provenance_of(kept[0]),
        first_source_id=kept[0].source_id,
        last_source_id=kept[-1].source_id,
    )
    return Tile(header=header, pos_q=pos_q, mag=mag, rgb=rgb)


def write_tile(path: str | Path, tile: Tile) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    header = tile.header.to_json()
    with target.open("wb") as fh:
        fh.write(MAGIC)
        fh.write(struct.pack("<I", len(header)))
        fh.write(header)
        fh.write(tile.pos_q.tobytes())
        fh.write(tile.mag.tobytes())
        fh.write(tile.rgb.tobytes())
    return target


def read_tile(path: str | Path) -> Tile:
    raw = Path(path).read_bytes()
    if len(raw) < HEADER_SIZE or not raw.startswith(MAGIC):
        raise TileError(f"{path}: not a tile")
    (header_len,) = struct.unpack("<I", raw[len(MAGIC) : HEADER_SIZE])
    start = HEADER_SIZE + header_len
    header = TileHeader.from_json(raw[HEADER_SIZE:start])

    count = header.count
    pos_bytes = raw[start : start + 6 * count]
    if len(pos_bytes) != 6 * count:
        raise TileError(f"{path}: truncated payload")

    return Tile(
        header=header,
        pos_q=array("H", pos_bytes),
        mag=array("h", raw[start + 6 * count : start + 8 * count]),
        rgb=array("B", raw[start + 8 * count : start + 11 * count]),
    )


def decode_position(tile: Tile, index: int) -> tuple[float, float, float]:
    """Recover a position in the tile's unit, accurate to one quantization step."""
    header = tile.header
    out = [
        header.origin[axis] + tile.pos_q[3 * index + axis] * header.extent[axis] / MAX_POSITION_U16
        for axis in range(3)
    ]
    return (out[0], out[1], out[2])


def quantization_error(tile: Tile) -> float:
    """Worst-case position error along one axis, in the tile's unit."""
    return max(tile.header.extent) / MAX_POSITION_U16 * 0.5


def _provenance_of(record: CatalogObject) -> dict[str, Any]:
    prov = record.provenance
    return {
        "catalog": prov.catalog,
        "release": prov.release,
        "flag": prov.flag,
        "query": prov.query,
        "source_url": prov.source_url,
        "fetched_at": prov.fetched_at,
    }


def _quantize(value: float, origin: float, extent: float) -> int:
    scaled = (value - origin) / extent * MAX_POSITION_U16
    return int(min(max(round(scaled), 0), MAX_POSITION_U16))


def _quantize_mag(magnitude: float | None) -> int:
    if magnitude is None:
        return 0
    scaled = round(magnitude * MILLI_MAGS_PER_MAG)
    limit = 32767
    return int(min(max(scaled, -limit), limit))