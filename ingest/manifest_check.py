"""Manifest round-trip: does the manifest still describe the bytes on disk?

`ingest.verify` answers the harder question — does every id in a tile resolve
back to its catalogue row, by re-running the query the tile recorded. That
needs the network, and takes minutes across two tiles.

This answers the cheap one, in under a second and with no network: is the
manifest telling the truth about the files it names? A manifest can go stale
while the tiles stay valid — a re-bake, a partial copy, a tile replaced by an
older one — and a stale manifest sends the browser to bytes nobody vouched for.
Neither check replaces the other; this is the one that can run on every commit.

Run it directly: `python3 -m ingest.manifest_check [tiles_dir]`.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ALLOWED_FLAGS = {"MEASURED", "SIMULATED"}


def check_manifest(tiles_dir: Path) -> list[str]:
    """Every disagreement between the manifest and the files, in manifest order."""
    manifest_path = tiles_dir / "manifest.json"
    if not manifest_path.exists():
        return [f"no manifest at {manifest_path}"]

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("tiles", [])
    if not entries:
        return ["manifest lists no tiles"]

    problems: list[str] = []
    for entry in entries:
        problems.extend(_check_entry(entry, tiles_dir))
    return problems


def _check_entry(entry: dict, tiles_dir: Path) -> list[str]:
    tile_id = entry.get("tile_id", "?")
    path = tiles_dir / entry["file"]
    if not path.exists():
        return [f"{tile_id}: {entry['file']} is named by the manifest but not on disk"]

    problems: list[str] = []
    blob = path.read_bytes()

    digest = hashlib.sha256(blob).hexdigest()
    if digest != entry.get("sha256"):
        problems.append(
            f"{tile_id}: sha256 {digest[:16]}… does not match the manifest's "
            f"{str(entry.get('sha256'))[:16]}… — the tile changed after the manifest was written"
        )

    if len(blob) != entry.get("bytes"):
        problems.append(f"{tile_id}: {len(blob)} bytes on disk, manifest says {entry.get('bytes')}")

    flag = entry.get("flag")
    if flag not in ALLOWED_FLAGS:
        problems.append(f"{tile_id}: flag {flag!r} is not one of {sorted(ALLOWED_FLAGS)}")
    elif flag == "MEASURED" and not (entry.get("catalog") and entry.get("release")):
        problems.append(f"{tile_id}: flagged MEASURED but names no catalog and release to cite")

    return problems


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    tiles_dir = Path(args[0] if args else "assets/tiles")
    problems = check_manifest(tiles_dir)
    if problems:
        for problem in problems:
            print(f"  FAIL {problem}")
        print(f"{len(problems)} manifest problem(s) in {tiles_dir}")
        return 1

    manifest = json.loads((tiles_dir / "manifest.json").read_text(encoding="utf-8"))
    rows = sum(entry["count"] for entry in manifest["tiles"])
    print(f"manifest ok: {len(manifest['tiles'])} tiles, {rows:,} rows described truthfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
