# Sub-plan 05 — Large-Scale Structure (500 Mpc)

**Goal:** the atlas reaches ~500 Mpc — the DESI large-scale-structure reach — as a *statistical*
tier, seamlessly continuous with the measured-star zone inside it.

Depends on 02 (engine) and 01 (bake conventions). 03 supplies the rendering language used here.

## Honesty note

DESI galaxies are **measured**, not invented. At 500 Mpc they are not individually identifiable, so
this tier carries its own badge: `SURVEY · STATISTICAL`. It must never share the `SIMULATED` badge of
synthetic fill, and it must never present a density filament as a named object.

## Data

DESI completed its planned five-year survey in April 2026 with >47 million galaxies and quasars
mapped. The access path for the public catalog is the first task below — do not assume a portal
shape before probing it.

## Tasks

- [ ] `[TODO]` Probe and document the DESI public data path (catalog release, redshift + sky position
  columns, download format, license). Record the result in the research doc.
- [ ] `[TODO]` Bake pipeline for the survey: read positions + redshift, bin into a 3D density grid
  sized to the survey volume, quantize, emit as low-detail tiles.
- [ ] `[TODO]` Rendering layer: additive density volume — no per-galaxy points. Filaments emerge from
  the density itself; nothing is drawn "on top" to fake a filament.
- [ ] `[TODO]` Radial LOD: the tier loads coarse-first and refines only where the camera is close in
  *angular* terms, so a distant view costs one tile.
- [ ] `[TODO]` Seam continuity: cross-fade from the measured-star zone into the statistical zone with
  no visible ring, seam, or density pop. Same additive language, same tonemap.
- [ ] `[TODO]` `SURVEY · STATISTICAL` badge and a fact card explaining what the tier is and is not.
- [ ] `[TODO]` Frame-budget check: the 500 Mpc tier must not push the star zone below its budget.

## Acceptance

- Flying outward crosses from measured stars to statistical structure with no visible seam.
- Every element in this tier reports `SURVEY · STATISTICAL`; selection never claims an object
  identity the survey cannot support.
- The tier loads within the phase-1 cold-start budget or defers behind a progress state.

## Risks

- Volume size: 47 M objects do not fit as points. Mitigation: density grid at load, never per-object
  geometry in this tier.
- Public portal shapes change between releases. Mitigation: isolate the access code in one module,
  same rule as sub-plan 01.