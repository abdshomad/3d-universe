# Phase 1 — Atlas Core

Parent plan. Split into sub-plans because the full plan does not fit one readable file — see the
`AGENTS.md` planning rule. Each sub-plan stands on its own and is built in order.

**Goal:** a real-time, provenance-honest 3D atlas of the measured universe, art-directed to
[`docs/prd/art-direction.md`](../docs/prd/art-direction.md), seeded with Gaia DR3 + JPL small bodies
+ deep-field imagery.

**PRD:** [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) · **Research:**
[`docs/deep-research/universe-data.md`](../docs/deep-research/universe-data.md)

## Sub-plans

| # | Sub-plan | Depends on | Ships |
|---|---|---|---|
| 01 | [`01-data-foundation.md`](phase-1/01-data-foundation.md) | — | **done** — baked, provenance-carrying catalog tiles |
| 02 | [`02-atlas-engine.md`](phase-1/02-atlas-engine.md) | 01 | **done** — scale-spanning renderer, LOD, post chain, routes, perf harness |
| 03 | [`03-visual-language.md`](phase-1/03-visual-language.md) | 02 | **done** — deep field, nebulosity, dust, measured stars, relations, reticles, sparks, HUD |
| 04 | [`04-experience.md`](phase-1/04-experience.md) | 03 | **done** — free flight, journeys, search, fact cards, epoch scrubber, onboarding, a11y, deep links |
| 05 | [`05-large-scale.md`](phase-1/05-large-scale.md) | 02 | **done** — statistical structure out to 500 Mpc, generated and badged `SIMULATED` |

## Decisions (locked by grill, 2026-10-04)

1. Simulated fill is allowed and always badged SIMULATED, with a dashed-magenta treatment.
2. Outer boundary ~500 Mpc — DESI large-scale structure, understood as a statistical tier.
3. Public web app, shareable URLs, no install.
4. Engine: three.js `WebGPURenderer` with automatic WebGL 2 fallback.
5. v1 = interactive atlas (free flight, search, fact cards) + optional cinematic auto-fly mode.

The synthesis policy lives in 03 and the 500 Mpc tier in 05; reversing either leaves 01–04 intact.

## Exit criteria for Phase 1

- Fly from Earth orbit to 100 kpc continuously, 60 fps, no stall. 60 fps is the GPU-host
  criterion: re-measured 2026-10-07 under SwiftShader (`docs/perf/remeasure.json`), the route's
  near segment runs 3.3 fps median with no stall (worst frame 1.1 s), and the software renderer
  drops to ~0.3 fps beyond ~30 kpc — the far-field scene, not the route logic, is the limit.
- Every rendered measured object resolves to a catalog row via the manifest.
- Cold start to local-neighborhood tier under 5 s. Re-measured 2026-10-07: 0.5 s.
- HUD honours the anti-goals in the art direction (no chrome over ~8 % of frame).
- The 500 Mpc tier renders as statistical structure, never as individually identifiable galaxies.