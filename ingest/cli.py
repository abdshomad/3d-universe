"""Command line entry point for ingestion.

    python -m ingest.cli gaia --limit 200 --min-parallax 10
    python -m ingest.cli sbdb --limit 50
    python -m ingest.cli imagery --query "webb deep field" --out assets/imagery.json
    python -m ingest.cli bake --source gaia --limit 5000
    python -m ingest.cli manifest --dir assets/tiles
"""

from __future__ import annotations

import argparse
import sys

from ingest import manifest as manifest_module
from ingest.catalogs import gaia_catalog
from ingest.bake import (
    DEFAULT_DIR,
    bake_black_holes,
    bake_galaxies,
    bake_gaia,
    bake_horizons,
    bake_sbdb,
)
from ingest.cli_fetch import (
    _run_black_holes,
    _run_field,
    _run_gaia,
    _run_galaxies,
    _run_horizons,
    _run_imagery,
    _run_landmarks,
    _run_relations,
    _run_sbdb,
)
from ingest.sources import gaia
from ingest.verify import verify_dir


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
    elif args.source == "sbdb":
        result = bake_sbdb(
            limit=args.limit, out_dir=args.out_dir, tile_id=args.tile_id
        )
    elif args.source == "comets":
        result = bake_sbdb(
            limit=args.limit, kind="c", out_dir=args.out_dir,
            tile_id=args.tile_id or "sbdb-comets",
        )
    elif args.source == "planets":
        result = bake_horizons(
            "planet", out_dir=args.out_dir, tile_id=args.tile_id
        )
    elif args.source == "satellites":
        result = bake_horizons(
            "satellite", out_dir=args.out_dir, tile_id=args.tile_id
        )
    elif args.source == "galaxies":
        result = bake_galaxies(
            out_dir=args.out_dir, tile_id=args.tile_id
        )
    else:
        result = bake_black_holes(
            out_dir=args.out_dir, tile_id=args.tile_id
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


    horizons_parser = sub.add_parser(
        "horizons", help="the solar-system majors and satellites"
    )
    horizons_parser.add_argument(
        "--kind", default="planet", choices=["planet", "satellite"]
    )
    horizons_parser.add_argument("--out", default=None)
    horizons_parser.set_defaults(func=_run_horizons)

    galaxies_parser = sub.add_parser(
        "galaxies", help="bright galaxies with measured redshifts"
    )
    galaxies_parser.add_argument("--out", default=None)
    galaxies_parser.set_defaults(func=_run_galaxies)

    black_holes_parser = sub.add_parser(
        "black-holes", help="black-hole transients with measured distances"
    )
    black_holes_parser.add_argument("--out", default=None)
    black_holes_parser.set_defaults(func=_run_black_holes)

    imagery_parser = sub.add_parser("imagery", help="public-domain deep-field imagery")
    imagery_parser.add_argument("--query", default="webb deep field")
    imagery_parser.add_argument("--limit", type=int, default=12)
    imagery_parser.add_argument("--out", default=None)
    imagery_parser.set_defaults(func=_run_imagery)

    bake_parser = sub.add_parser("bake", help="fetch a source and write a tile")
    bake_parser.add_argument(
        "--source",
        choices=[
            "gaia", "sbdb", "comets", "planets",
            "satellites", "galaxies", "black-holes",
        ],
        default="gaia",
    )
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

    field_parser = sub.add_parser("field", help="regenerate the modelled large-scale field")
    field_parser.add_argument("--out", default="assets/tiles/lss-field.json")
    field_parser.add_argument("--grid", type=int, default=96)
    field_parser.add_argument("--radius-mpc", type=float, default=500.0)
    field_parser.set_defaults(func=_run_field)

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