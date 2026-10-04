# Sub-plan 03 — Visual Language

**Goal:** implement [`docs/prd/art-direction.md`](../../docs/prd/art-direction.md) — Ref A as the
medium, Ref B as the information language.

Depends on 02 (all of this is layers over the engine). Depends on 01 for positions and provenance.

## Layers, in build order

- [x] **Deep field**: real telescope imagery on four parallax planes per field, not a skybox —
  `web/src/data/deep-fields.js`, `web/src/render/deep-field.js`, `web/src/render/backdrop.js`. Three
  fields: Webb's first deep field (SIMBAD ICRS 110.8054, −73.4569, queried 2026-10-04) plus two
  composed positions, each declared `authored` rather than passed off as measured. Planes stay fixed
  in world space and rebuild only when the view scale leaves its band, so parallax is real. Verified
  by A/B in a browser: backdrop on p99 luminance 20, off p99 7.
- [ ] `[TODO]` **Procedural nebulosity**: low-frequency 3D noise, near-black floor, additive.
- [ ] `[TODO]` **Star dust**: far (1 px) and near (soft sprite) instanced layers with parallax.
- [ ] `[TODO]` **Measured objects**: additive sprites, magnitude → brightness, B−V → RGB.
- [ ] `[TODO]` **Relations**: tapered Bézier ribbons, noise-modulated alpha, hue per relation type.
- [ ] `[TODO]` **Reticles**: screen-space-width wireframe circles, tick arcs, crosshair, uncertainty
  ellipse around the selected object.
- [ ] `[TODO]` **Spark markers**: colored `+` glyphs for transient/event objects (pulsar, FRB, GW).
- [ ] `[TODO]` **HUD**: title lockup, thin top nav, fact card, boxed readout, provenance badge.
- [ ] `[TODO]` **Camera grammar**: constant slow drift, exponential scale changes, no cuts.

## Honesty rules (hard requirements, not style)

- A ribbon renders only when its relation has a citation in the data model.
- Simulated or synthesized objects and edges render with the SIMULATED badge and dashed magenta.
- The renderer can answer "measured or synthesized?" for any visible object in O(1).

## Acceptance

- A frame at rest matches the references: >70 % of frame is star field, UI under ~8 %.
- Selecting any object produces a fact card with image, parameters, and a provenance line.
- Every visible edge resolves to a cited relation.

## Synthesis policy (resolved)

Simulated fill is in scope: beyond the measured sky, space is filled and always badged SIMULATED,
dashed magenta, one click from any object to its fact card explaining that it is generated. The deep
field and the graph language carry the visual weight; the fill only supplies density.