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
- [x] **Procedural nebulosity**: `web/src/core/noise.js` (deterministic 3D value noise + fBm) and
  `web/src/render/nebulosity.js`. Blobs are drawn only where the noise is above a threshold, so the
  medium has holes instead of a wash, and the seed makes the same sky on every machine. Isolated in a
  browser: lit pixels 18,588 with the dust, 12,954 without (+43%). The point primitive it shares with
  the star field now lives in `render/point-layer.js`.
- [x] **Star dust**: `web/src/render/star-dust.js` — a far layer of 1 px grains (72% of 45,000) and
  a near layer of soft sprites (28%), both additive and seeded so the sky is identical everywhere.
  Flagged `UNRESOLVED`: dust stands for what the catalogue did not resolve, and is never presented
  as measurement. Isolated in a browser: 1,015,952 lit pixels with the dust, 43,596 without.
- [x] **Measured objects**: `web/src/core/photometry.js` is now the single renderer-side
  implementation of magnitude → size and brightness, B−V → RGB, mirrored from
  `ingest/astro/photometry.py` and **verified against it** — the test runs the Python and compares to
  1e-6, so the tile and the screen cannot drift apart. Verified in a browser: 4,843 strided stars,
  112,791 lit pixels, flagged `MEASURED`.
- [x] **Relations**: `web/src/data/relations.js`, `web/src/render/ribbons.js`,
  `web/src/render/relation-layer.js` and `ingest/sources/relations.py`. 89 constellation figures
  ingested from d3-celestial with the source URL and retrieval date recorded; **an uncited relation
  throws rather than draws**. Each figure end is attached to the nearest *measured* star within 0.35°,
  and ends with no star are not drawn at all. Verified in a browser: 150 segments attempted, **77
  ribbons drawn** from 154 matched ends against 60,000 indexed stars.
- [x] **Reticles**: `web/src/render/reticles.js` — circle, tick arc, gapped crosshair and a rotated
  uncertainty ellipse, drawn as line segments so the stroke is a screen-space pixel at every scale.
  The reticle locks onto the nearest *measured* star to the view centre; verified in a browser on
  Gaia `5262578111591082240`, one reticle in the scene, no console errors.
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