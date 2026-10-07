"""The source fetch subcommands: each emits its
records as JSON, to a file or stdout.

    python -m ingest.cli gaia --limit 200
    python -m ingest.cli horizons --kind satellite
    python -m ingest.cli black-holes --out holes.json
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from ingest.catalogs import gaia_catalog
from ingest.sources import (
    black_holes,
    galaxies,
    gaia,
    horizons,
    imagery,
    sbdb,
)


def _parse_cone(value: str | None) -> tuple[float, float, float] | None:
    if not value:
        return None
    parts = value.split(",")
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("cone must be ra,dec,radius in degrees")
    return (float(parts[0]), float(parts[1]), float(parts[2]))


def _emit(records: list[dict], out: str | None) -> None:
    payload = json.dumps(records, indent=2)
    if out:
        path = Path(out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload, encoding="utf-8")
        print(f"wrote {len(records)} records to {path}", file=sys.stderr)
    else:
        print(payload)


def _run_relations(args: argparse.Namespace) -> int:
    from ingest.sources.relations import write_relations

    path = write_relations(args.out)
    payload = json.loads(path.read_text(encoding="utf-8"))
    citation = payload["citation"]
    print(f"{payload['count']} relations -> {path}")
    print(f"source: {citation['dataset']} ({citation['url']})")
    return 0


def _run_field(args: argparse.Namespace) -> int:
    from ingest.sources.lss_field import write_field

    path = write_field(args.out, grid=args.grid, radius_mpc=args.radius_mpc)
    header = json.loads(path.read_text(encoding="utf-8"))
    dataset = header["dataset"]
    print(f"{header['grid']}^3 field over {header['radius_mpc']} Mpc -> {path}")
    print(f"flag: {dataset['flag']} | seed: {dataset['seed']} | checksum: {header['checksum'][:16]}")
    print(f"reference: {dataset['science_reference']}")
    return 0


def _run_landmarks(args: argparse.Namespace) -> int:
    from ingest.sources.landmarks import write_landmarks

    path = write_landmarks(args.out, cache=args.cache)
    payload = json.loads(path.read_text(encoding="utf-8"))
    citation = payload["citation"]
    print(f"{payload['count']} landmarks -> {path}")
    for landmark in payload["landmarks"]:
        print(
            f"  {landmark['name']:20s} HIP {landmark['hip']:<7d}"
            f" {landmark['distance_pc']:9.3f} pc"
            f"  plx={landmark['parallax_mas']:.2f} mas"
            f"  cross-check {landmark['cross_check_arcsec']}\""
        )
    print(f"source: {citation['dataset']} ({citation['url']})")
    return 0


def _run_gaia(args: argparse.Namespace) -> int:
    catalog = gaia_catalog(args.release)
    endpoint = gaia.ESA_ENDPOINT if args.endpoint == "esa" else None
    records = gaia.fetch(
        limit=args.limit,
        min_parallax_mas=args.min_parallax,
        max_mag=args.max_mag,
        cone=_parse_cone(args.cone),
        catalog=catalog,
        endpoint=endpoint,
    )
    _emit([r.as_row() for r in records], args.out)
    return 0


def _run_sbdb(args: argparse.Namespace) -> int:
    records = sbdb.fetch(limit=args.limit, kind=args.kind)
    _emit([r.as_row() for r in records], args.out)
    return 0


def _run_horizons(args: argparse.Namespace) -> int:
    records = horizons.fetch(kind=args.kind)
    _emit([r.as_row() for r in records], args.out)
    return 0


def _run_galaxies(args: argparse.Namespace) -> int:
    records = galaxies.fetch()
    _emit([r.as_row() for r in records], args.out)
    return 0


def _run_black_holes(args: argparse.Namespace) -> int:
    records = black_holes.fetch()
    _emit([r.as_row() for r in records], args.out)
    return 0


def _run_imagery(args: argparse.Namespace) -> int:
    assets = imagery.fetch_images(query=args.query, limit=args.limit)
    _emit([asdict(a) for a in assets], args.out)
    return 0
