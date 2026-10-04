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
- [ ] `[TODO]` Generate the density field: a seeded ΛCDM-like volume binned to a low-detail grid,
  quantized like our star tiles. Generated, not ingested — and labelled as such everywhere.
- [ ] `[TODO]` Rendering layer: additive density volume — no per-galaxy points. Filaments emerge
  from the density itself; nothing is drawn "on top" to fake a filament.
- [ ] `[TODO]` Radial LOD: the tier loads coarse-first and refines only where the camera is close
  in *angular* terms, so a distant view costs one tile.
- [ ] `[TODO]` Seam continuity: cross-fade from the measured-star zone into the statistical zone
  with no visible ring, seam, or density pop. Same additive language, same tonemap.
- [ ] `[TODO]` `SIMULATED` badge and a fact card saying what the tier is and is not: a model of
  structure, not a survey map.
- [ ] `[TODO]` Frame-budget check: the 500 Mpc tier must not push the star zone below its budget.

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