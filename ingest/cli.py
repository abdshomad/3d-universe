"""Command line entry point for ingestion.

    python -m ingest.cli gaia --limit 200 --min-parallax 10
    python -m ingest.cli sbdb --limit 50
    python -m ingest.cli imagery --query "webb deep field" --out assets/imagery.json
    python -m ingest.cli bake --source gaia --limit 5000
    python -m ingest.cli manifest --dir assets/tiles
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from ingest import manifest as manifest_module
from ingest.catalogs import gaia_catalog
from ingest.bake import DEFAULT_DIR, bake_gaia, bake_sbdb
from ingest.sources import gaia, imagery, sbdb
from ingest.verify import verify_dir


def _run_relations(args: argparse.Namespace) -> int:
    from ingest.sources.relations import write_relations

    path = write_relations(args.out)
    payload = json.loads(path.read_text(encoding="utf-8"))
    citation = payload["citation"]
    print(f"{payload['count']} relations -> {path}")
    print(f"source: {citation['dataset']} ({citation['url']})")
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


def _run_imagery(args: argparse.Namespace) -> int:
    assets = imagery.fetch_images(query=args.query, limit=args.limit)
    _emit([asdict(a) for a in assets], args.out)
    return 0


def _run_bake(args: argparse.Namespace) -> int:
    if args.source == "gaia":
        result = bake_gaia(
            limit=args.limit,
            min_parallax_mas=args.min_parallax,
            out_dir=args.out_dir,
            tile_id=args.tile_id,
            catalog=gaia_catalog(args.release),
            endpoint=gaia.ESA_ENDPOINT if args.endpoint == "esa" else None,
        )
    else:
        result = bake_sbdb(
            limit=args.limit, out_dir=args.out_dir, tile_id=args.tile_id
        )
    print(result.summary())
    print(f"manifest: {result.manifest_path}")
    return 0


def _run_manifest(args: argparse.Namespace) -> int:
    path = manifest_module.write(args.dir)
    index = manifest_module.load(args.dir)
    print(f"{path} — {len(index.tiles)} tiles, generated {index.generated_at}")
    for tile in index.tiles:
        print(
            f"  {tile.tile_id}: {tile.count} {tile.unit} "
            f"[{tile.catalog} {tile.release}] {tile.bytes} B "
            f"sha256={tile.sha256[:12]}"
        )
    return 0


def _run_verify(args: argparse.Namespace) -> int:
    reports = verify_dir(args.dir)
    if not reports:
        print(f"no tiles in {args.dir}", file=sys.stderr)
        return 1
    for report in reports:
        print(report.summary())
    return 0 if all(report.ok for report in reports) else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ingest", description="Catalog ingestion")
    sub = parser.add_subparsers(dest="command", required=True)

    gaia_parser = sub.add_parser("gaia", help="nearby stars with measured parallaxes")
    gaia_parser.add_argument("--limit", type=int, default=100)
    gaia_parser.add_argument("--min-parallax", type=float, default=10.0, help="mas")
    gaia_parser.add_argument("--max-mag", type=float, default=12.0)
    gaia_parser.add_argument("--cone", default=None, help="ra,dec,radius in degrees")
    gaia_parser.add_argument("--endpoint", choices=["aip", "esa"], default="aip")
    gaia_parser.add_argument("--release", default=gaia.DEFAULT_RELEASE)
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
    bake_parser.add_argument("--out-dir", default=DEFAULT_DIR)
    bake_parser.add_argument("--release", default=gaia.DEFAULT_RELEASE)
    bake_parser.add_argument("--endpoint", choices=["aip", "esa"], default="aip")
    bake_parser.add_argument("--tile-id", default=None)
    bake_parser.set_defaults(func=_run_bake)

    manifest_parser = sub.add_parser("manifest", help="index a directory of tiles")
    manifest_parser.add_argument("--dir", default=DEFAULT_DIR)
    manifest_parser.set_defaults(func=_run_manifest)

    verify_parser = sub.add_parser("verify", help="check tiles against their catalog")
    verify_parser.add_argument("--dir", default=DEFAULT_DIR)
    verify_parser.set_defaults(func=_run_verify)

    relations_parser = sub.add_parser("relations", help="constellation figures with citations")
    relations_parser.add_argument(
        "--out", default="assets/relations/constellations.json"
    )
    relations_parser.set_defaults(func=_run_relations)

    landmarks_parser = sub.add_parser("landmarks", help="verified landmarks with measured distances")
    landmarks_parser.add_argument("--out", default="assets/landmarks/landmarks.json")
    landmarks_parser.add_argument("--cache", default=None, help="reuse a downloaded Hipparcos TSV")
    landmarks_parser.set_defaults(func=_run_landmarks)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:  # noqa: BLE001 - CLI boundary
        print(f"ingest failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())