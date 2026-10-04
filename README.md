# 3D Universe

A real-time, explorable 3D atlas of the observable universe — cinematic enough to feel like flying
through a deep field, honest enough that every measured object traces back to a catalog row.

Scope: real stars from ~1 pc out to Gaia's parallax reach, the Milky Way's dust structure, large-scale
structure out to ~500 Mpc (DESI), and public-domain deep-field imagery as the medium. Simulated fill is
used only where measurement ends, and is always badged.

## Docs

| | |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Agent rules: file size, planning, commit/push protocol |
| [`docs/prd/universe-3d.md`](docs/prd/universe-3d.md) | Product requirements and locked decisions |
| [`docs/prd/art-direction.md`](docs/prd/art-direction.md) | Visual contract |
| [`docs/references.md`](docs/references.md) | The reference videos, analyzed frame by frame |
| [`docs/deep-research/universe-data.md`](docs/deep-research/universe-data.md) | Data landscape, access probes, rendering stack |
| [`plans/phase-1.md`](plans/phase-1.md) | Current build, split into sub-plans |
| [`plans/next-enhancements.md`](plans/next-enhancements.md) | Queued follow-ups by module |

## Ingest

Offline Python. Fetches public catalogs, normalizes them, keeps provenance. Standard library only.

```bash
python -m ingest.cli gaia --limit 200 --min-parallax 10        # nearest measured stars
python -m ingest.cli gaia --limit 50 --cone 101.28,-16.71,1.0  # a cone of sky
python -m ingest.cli sbdb --limit 50 --kind a                  # asteroids, real orbits
python -m ingest.cli imagery --out assets/imagery.json         # NASA deep-field imagery
python -m ingest.cli bake --source gaia --limit 5000           # fetch -> quantize -> tile file
python -m ingest.cli manifest --dir assets/tiles            # index tiles, with checksums
python -m ingest.cli verify --dir assets/tiles             # ids still resolve to their catalog
```

Records carry `ra_deg`, `dec_deg`, `distance_pc`, `mag`, `color_index` and a provenance block naming
the catalog, release, exact query and fetch time. A star without a usable parallax gets
`distance_pc: null` and is dropped from the star tier — distances are never invented.

Tiles are `U3DTILE2`: a JSON header plus `ids u64 | pos_q u16 | mag i16 | rgb u8`, 19 bytes per star.
Each tile carries its own unit (parsecs for stars, AU for small bodies), the provenance block and every
catalog id, so a selected object resolves to its row and a tile is self-citing.

Catalog releases are data. `ingest/catalogs.json` names the table, columns and endpoint per release;
`--release DR2` or `DR3` switches with no code change. A release that has not been published is
refused with its reason — Gaia DR4 is scheduled for 2026-12-02, so flipping `available` in that file
is the entire activation.

## Web engine

```bash
npm install
npm test              # node --test: 33 checks over the engine, LOD and tile reader
npm run bake          # fetch Gaia, quantize, write assets/tiles
npm run serve         # http://127.0.0.1:$PORT/web/index.html  (port from .env)
pm2 start ecosystem.config.cjs && pm2 save    # keep it running across reboots
python3 scripts/perf-check.py --seconds 25    # headless frame timings, exits non-zero on budget miss
```

`.env` holds `PORT` and `HOST`. pm2 watches that one file, so changing the port restarts the
service on the new address without touching anything else.

- `web/src/data/tile-reader.js` — reads `U3DTILE2`; ids stay in a `BigUint64Array` because Gaia
  ids reach 5.8e18 and a float64 would round them to a different star.
- `web/src/render/star-layer.js` — additive points sized and brightened from magnitude. Uses a node
  material: three's WebGPU renderer rejects `ShaderMaterial` outright.
- `web/src/render/scene.js` — renderer, camera rig, floating origin, frame loop, fps meter.

- `web/src/core/camera-rig.js` — exponential travel (distance interpolated geometrically, direction
  as unit vectors) and rotation at a scale-independent angular rate.
- `web/src/core/floating-origin.js` — the world moves in float64, render space stays under 1e7 m so
  float32 keeps its integral part.
- `web/src/core/depth-model.js` — contiguous scale bands. One buffer over 29 decades would leave
  595 km per depth step at 1 AU; the bands leave 41 km, and 1.2 mm at 1 km.
- `web/src/core/lod-tree.js` — octree over tile bounds. Cull by view pyramid, forward test and
  distance; spend the point budget on the tiles covering the most sky, striding the rest.
- `web/src/core/box.js`, `web/src/core/frustum.js` — boxes and camera-relative side planes, built at
  the origin because a projection evaluated at 1e20 m returns the same answer for every direction.

## Verified access paths

Measured from the build host, 2026-10-04:

| Source | Endpoint | Result |
|---|---|---|
| Gaia DR3 | `gaia.aip.de/tap/sync` | ~1 s for a parallax-filtered query — **default** |
| Gaia DR3 | `gea.esac.esa.int` | correct but slow (~36 s for `TOP 1`; filtered query > 90 s) |
| JPL SBDB | `ssd-api.jpl.nasa.gov` | works, orbital elements for small bodies |
| NASA images | `images-api.nasa.gov` | works, public-domain deep-field imagery |
| HEASARC | TAP/Xamin | **unreachable** from this host — re-probe before use |

## Rules

- Every source file stays under 256 LOC; split along real seams.
- Plans live in `plans/`; a plan too big for one file becomes sub-plans.
- Update `AGENTS.md`, commit, and push after every completed task.

## Status

Sub-plan 01 (data foundation) is complete: every tile verifies against its live catalog. Sub-plan 02
(engine) has its spatial core done — camera rig, floating origin, depth bands. Next: octree LOD and
the first rendered frame.