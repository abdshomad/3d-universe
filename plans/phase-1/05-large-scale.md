# Sub-plan 05 — Large-Scale Structure (500 Mpc)

**Goal:** the atlas reaches ~500 Mpc — the DESI large-scale-structure reach — as a *statistical*
tier, seamlessly continuous with the measured-star zone inside it.

Depends on 02 (engine) and 01 (bake conventions). 03 supplies the rendering language used here.

## Honesty note — revised 2026-10-04

This plan originally assumed we would ingest DESI galaxies and badge the tier `SURVEY ·
STATISTICAL`. **The probe showed we cannot.** A single region's ELG catalogue is 16.25 GB and the
LRG 5.48 GB, the DR1 set runs to hundreds of gigabytes, and the usual pre-aggregated alternative
(CosmoDC2 density cubes) is unreachable from this host.

So the tier is **generated**, not ingested. That changes its badge from `SURVEY · STATISTICAL` to
`SIMULATED`, and the citation from "DESI DR1" (the source of the pixels) to "DESI DR1, arXiv:
2503.14745" (the *science reference* for what real structure looks like). If a bulk DESI mirror
ever becomes reachable, the badge changes back — and nothing else about the tier does.

## Data

Nothing is ingested. The density field is generated from a fixed seed, and the fact card for the
tier says exactly that: it is a model of large-scale structure, not a survey map.

## Tasks

- [x] Probe and document the DESI public data path — done, 2026-10-04. Reachable at
  `data.desi.lbl.gov/public/dr1/`; CC BY 4.0 with a required citation to arXiv:2503.14745; but one
  region is 16.25 GB (ELG) and 5.48 GB (LRG), and CosmoDC2 is unreachable from here. The tier is
  therefore generated and badged `SIMULATED`. Recorded in the research doc.
- [x] Generate the density field — `ingest/sources/lss_field.py` plus `ingest field`. A Gaussian
  random field with a ΛCDM-like linear power spectrum, 96³ over a 500 Mpc radius (10.4 Mpc cells),
  quantised to bytes with a floor of 0.35 and ceiling of 4.5. Generated in 1.7 s, byte-identical for
  a given seed. Measured: neighbour difference 0.855 against 0.855 for random pairs — a genuinely
  correlated field, not noise.
- [x] Rendering layer — `web/src/render/lss-layer.js`. One additive point per occupied cell,
  brightness ∝ density excess², so filaments and sheets glow and voids stay empty; nothing is drawn
  on top to fake structure. Cells outside the declared radius are skipped: the tier is a ball, not the
  cube it is stored in. 49,410 points at the default threshold, flagged `SIMULATED`, and `parseField`
  **refuses** a cube that is not flagged simulated.
- [x] Radial LOD — `levelForView` switches on the *angular* size of a cell, not a magic distance:
  fine (49,410 points) while a cell is worth resolving, coarse (6,163, one cell in eight) once it
  is a speck. Verified live: fine at 2 and 200 Mpc, coarse at 5000 Mpc.
- [x] Seam continuity — `fadeForView` smoothsteps opacity over 1–8 Mpc, so the measured-star zone
  hands over to modelled structure with no ring and no density pop. Verified live: invisible at
  0.2 Mpc (badge `UNRESOLVED`), 5.5 % opacity at 2 Mpc, full by 20 Mpc, badge `SIMULATED`. Same
  additive language and same tonemap throughout — the fade moves opacity, never the density.
- [x] `SIMULATED` badge and fact card — the badge reads `SIMULATED` whenever the tier is on screen
  and `UNRESOLVED` when it is not. The card leads with what the tier **is not**: *a survey map — no
  galaxy here is measured*, with the seed, grid and cell count alongside. It reaches the card
  without a click, because when nothing else is selected and the tier is on screen the tier *is*
  what you are looking at. Verified live at 200 Mpc (49,410 cells) and 5000 Mpc (6,163) — the card
  reports the level actually drawn.
- [x] Frame-budget check — measured, not assumed. The star zone and the tier **never overlap**:
  stars count 72,219 at 10 pc and 6,918 at 10 kpc, but **0** from 0.5 Mpc out, while the tier only
  fades in past 1 Mpc. So the tier cannot push the star zone below budget — measured 60.0 fps with
  it drawn and 60.0 fps with it hidden, a 0.01 ms difference. Cold cost is 0.1 ms to parse 884,736
  bytes and 25.8 ms to build both levels. `web/src/core/tier-budget.js` holds the line at runtime:
  a rolling mean over 60 frames, warmup ignored, deferring the tier when the mean exceeds the budget
  and restoring it when there is headroom. Verified live — tightening the budget to 8 ms hides the
  tier and drops the badge to `UNRESOLVED`; restoring 20 ms brings both back.

## Acceptance

- Flying outward crosses from measured stars to modelled structure with no visible seam.
- Every element in this tier reports `SIMULATED`; selection never claims an object identity, and
  the card cites DESI DR1 as the science reference rather than as the source of the pixels.
- The tier loads within the phase-1 cold-start budget or defers behind a progress state.

## Risks

- Nothing is downloaded, so there is no portal to keep working — and a reader may reasonably think
  this tier is DESI data. Mitigation: the badge, the card and the research doc all say `SIMULATED`.
- If a DESI mirror ever becomes reachable, ingest it behind the same tile format and flip the badge
  back; nothing else about the tier changes.
- Volume size: a modelled field at survey resolution would not fit as points. Mitigation: a
  low-detail density grid, never per-object geometry in this tier.