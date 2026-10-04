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
```

Records carry `ra_deg`, `dec_deg`, `distance_pc`, `mag`, `color_index` and a provenance block naming
the catalog, release, exact query and fetch time. A star without a usable parallax gets
`distance_pc: null` and is dropped from the star tier — distances are never invented.

Tiles are `U3DTILE1`: a JSON header plus `pos_q u16 | mag i16 | rgb u8`, about 11 bytes per star.
Each tile carries its own unit (parsecs for stars, AU for small bodies) plus the provenance block, so
a tile is self-citing.

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

Phase 1, sub-plan 01 (data foundation): the `ingest/` package exists and runs against live sources.
Tiles and the web renderer are next.