# PRD — 3D Universe Atlas

Status: draft v0 (post-research, pre-grill).

- Research: [`docs/deep-research/universe-data.md`](../deep-research/universe-data.md)
- Visual references: [`docs/references.md`](../references.md)
- Art direction contract: [`docs/prd/art-direction.md`](art-direction.md)
- Build plan: [`plans/phase-1.md`](../../plans/phase-1.md) · follow-ups: [`plans/next-enhancements.md`](../../plans/next-enhancements.md)

## Vision

A real-time, explorable three-dimensional atlas of the observable universe: cinematic enough to feel
like flying through a deep field, honest enough that every measured object traces back to a catalog
row, and legible enough that a non-astronomer can read the structure of the cosmos from it.

Art direction, taken directly from the two reference pieces:

- **Medium** — the `@_cosmicearth` volumetric deep-field fly-through: dense, photoreal, no chrome.
- **Information layer** — the `@RuiHuang_art` "Encyclopedia Cosmologica" luminous filament network:
  knowledge drawn as glowing connections between nodes, thin orbital HUD rings, near-black palette.
- **Spirit** — Lomberg's honesty about scale and Sagan's wonder. Never fake a measurement.

## Problem

Every existing option chooses one side:

- SpaceEngine / Celestia / Stellarium: beautiful and navigable, but the far universe is invented.
- Aladin Lite / web sky atlases: real data, real positions, but strictly 2D.
- DESI-style data portals: real 3D structure, but as plots — no place, no scale, no wonder.

There is no place where *the real 3D map of the universe* is the thing you fly through.

## Users

1. **Explorer** — flies, looks, marvels. No astronomy knowledge assumed.
2. **Student** — clicks a star and learns what it is, how far, what telescopes saw it.
3. **Scientist-adjacent** — checks that positions and provenance are correct, and can download the slice.

## Scope — tiers (from the research)

| Tier | Content | v1? |
|---|---|---|
| T0 | Solar system + small bodies (JPL SBDB/Horizons) | yes |
| T1 | Stellar neighborhood, real 3D from parallax (Gaia DR3 → DR4) | yes |
| T2 | Galactic structure: dust, HI, Milky Way morphology | phase 1 |
| T3 | Large-scale structure out to ~500 Mpc (DESI) | yes, statistical tier |
| T4 | Deep-field imagery planes (Hubble/JWST/Euclid/Rubin) | yes, as backdrop |
| T5 | Simulated fill beyond measurement | yes, always badged SIMULATED |

## Core features

1. **Scale-spanning flight** — continuous navigation from 1 m to ~500 Mpc without float catastrophe.
   Nested scene graphs with floating origin, plus a logarithmic depth buffer.
2. **Measured stars as points of light** — magnitude → size/brightness, B−V color → RGB,
   parallax → distance, all from baked catalog tiles. Progressive LOD by octree.
3. **Provenance on every object** — source catalog, release, and row identifier survive the bake and
   are visible on selection. Anything synthetic is visibly marked as such.
4. **The knowledge graph** — luminous links between objects that have a real relation:
   constellation lines, exoplanet host → planet, binary pair, galaxy → cluster membership.
   No arbitrary decorative spaghetti: every edge is a cited relation.
5. **Deep-field backdrop** — public-domain telescope imagery (NASA/ESA/ESO) as layered backdrops
   at the correct distance and orientation, giving the photoreal medium.
6. **Time** — scrub light-travel time, so the sky at redshift z is the sky at that epoch.
7. **Search & selection** — type a name, get a flight path; every selection shows a fact card.

## Non-goals for v1

- Not a science tool: no reduction pipelines, no uncertainty propagation, no publication-grade
  photometry.
- No Rubin alert firehose consumption.
- No user accounts, no cloud rendering, no VR.

## Architecture sketch

```
ingest/          offline, Python — TAP/ADQL → normalized tables → tiles
  bricks/          per source: schema, extraction query, provenance
  bake/            parquet → binary tile (quantized pos, mag, color) + manifest
web/src/
  core/            renderer, camera rig, floating origin, LOD/octree
  layers/          stars, deep fields, graph, HUD (one module per layer)
  data/            tile loader, tile cache, provenance lookup
assets/tiles/     baked artifacts + manifest.json (gitignored, reproducible)
```

Hard constraints that follow from research:

- The browser never queries TAP directly: measured latency was ~36 s for a trivial Gaia query and a
  parallax-filtered query over the full DR3 table exceeded a 90 s timeout. **Bake everything.**
- Every tier is a separate asset set with its own provenance flag; the renderer must be able to
  answer "measured or synthesized?" for any object in O(1).

## Success criteria

- 100 000+ real stars navigable at 60 fps on a mid-range laptop GPU.
- Every star on screen resolves to a catalog row; every synthetic object is marked.
- A cold start loads the local-neighborhood tier in under 5 s.
- A user can fly from the Sun to 100 kpc in under 60 s without a loading stall.
- The atlas reaches ~500 Mpc: real measured stars near home, statistical large-scale structure
  beyond, simulated fill everywhere measurement ends and always visibly badged.

## Decisions (locked by grill, 2026-10-04)

1. **Beyond the measured sky** — simulated/procedural fill is allowed and **always badged
   SIMULATED**, with a distinct dashed-magenta treatment. Honesty is enforced in the UI, not
   abandoned for aesthetics.
2. **Outer boundary** — ~500 Mpc, the DESI large-scale-structure reach. T3 is in scope, understood
   as a statistical tier, not as individually identifiable galaxies.
3. **Platform** — public web app, shareable URLs, no install.
4. **Engine** — three.js `WebGPURenderer`, automatic WebGL 2 fallback for older hardware.
5. **v1 shape** — interactive atlas (free flight, search, fact cards) *plus* an optional cinematic
   auto-fly mode.

These are no longer open questions. If any must be reversed, sub-plans 03 and 05 absorb the change;
01 and 02 do not.