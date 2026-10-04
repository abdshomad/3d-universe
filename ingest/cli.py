"""Command line entry point for ingestion.

    python -m ingest.cli gaia --limit 200 --min-parallax 10
    python -m ingest.cli sbdb --limit 50
    python -m ingest.cli imagery --query "webb deep field" --out assets/imagery.json
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from ingest.bake import bake_gaia, bake_sbdb
from ingest.sources import gaia, imagery, sbdb


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


def _run_gaia(args: argparse.Namespace) -> int:
    records = gaia.fetch(
        limit=args.limit,
        min_parallax_mas=args.min_parallax,
        max_mag=args.max_mag,
        cone=_parse_cone(args.cone),
        endpoint=gaia.ESA_ENDPOINT if args.endpoint == "esa" else gaia.AIP_ENDPOINT,
    )
    _emit([r.as_row() for r in records], args.out)
    return 0


def _run_sbdb(args: argparse.Namespace) -> int:
    records = sbdb.fetch(limit=args.limit, kind=args.kind)
    _emit([r.as_row() for r in records], args.out)
    return 0


def _run_imagery(args: argparse.Namespace) -> int:
    assets = imagery.fetch_images(query=args.query, limit=args.limit)
    _emit([asdict(a) for a in assets], args.out)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ingest", description="Catalog ingestion")
    sub = parser.add_subparsers(dest="command", required=True)

    gaia_parser = sub.add_parser("gaia", help="nearby stars with measured parallaxes")
    gaia_parser.add_argument("--limit", type=int, default=100)
    gaia_parser.add_argument("--min-parallax", type=float, default=10.0, help="mas")
    gaia_parser.add_argument("--max-mag", type=float, default=12.0)
    gaia_parser.add_argument("--cone", default=None, help="ra,dec,radius in degrees")
    gaia_parser.add_argument("--endpoint", choices=["aip", "esa"], default="aip")
    gaia_parser.add_argument("--out", default=None)
    gaia_parser.set_defaults(func=_run_gaia)

    sbdb_parser = sub.add_parser("sbdb", help="solar-system small bodies")
    sbdb_parser.add_argument("--limit", type=int, default=50)
    sbdb_parser.add_argument("--kind", default="a", choices=["a", "c", "p"])
    sbdb_parser.add_argument("--out", default=None)
    sbdb_parser.set_defaults(func=_run_sbdb)

    imagery_parser = sub.add_parser("imagery", help="public-domain deep-field imagery")
    imagery_parser.add_argument("--query", default="webb deep field")
    imagery_parser.add_argument("--limit", type=int, default=12)
    imagery_parser.add_argument("--out", default=None)
    imagery_parser.set_defaults(func=_run_imagery)

    bake_parser = sub.add_parser("bake", help="fetch a source and write a tile")
    bake_parser.add_argument("--source", choices=["gaia", "sbdb"], default="gaia")
    bake_parser.add_argument("--limit", type=int, default=5000)
    bake_parser.add_argument("--min-parallax", type=float, default=10.0)
    bake_parser.add_argument("--out-dir", default="assets/tiles")
    bake_parser.add_argument("--tile-id", default=None)
    bake_parser.set_defaults(func=_run_bake)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:  # noqa: BLE001 - CLI boundary
        print(f"ingest failed: {exc}", file=sys.stderr)
        return 1


def _run_bake(args: argparse.Namespace) -> int:
    if args.source == "gaia":
        result = bake_gaia(
            limit=args.limit,
            min_parallax_mas=args.min_parallax,
            out_dir=args.out_dir,
            tile_id=args.tile_id,
        )
    else:
        result = bake_sbdb(
            limit=args.limit, out_dir=args.out_dir, tile_id=args.tile_id
        )
    print(result.summary())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())