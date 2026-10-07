# 03 — Render primitives: one layer per kind, each with a flag

Sub-plan 01 decides what can exist; 02 bakes it. This one
decides how each kind is *drawn* — and the drawing has
invariants that are not negotiable, because they are what
makes the menu honest.

**The invariants, from the code that already works:**

1. **Provenance in O(1).** Every layer answers "measured or
   synthesized?" per object, at the object, not by looking
   the kind up in a table (PRD hard constraint). Stars carry
   `MEASURED` in the tile bytes; sparks carry `UNRESOLVED`;
   the LSS field carries `SIMULATED`. A new kind picks its
   flag the same way: `MEASURED` where a catalogue row backs
   it, `DERIVED` where a position is computed from one
   (exoplanets are the precedent), never an unflagged row.
2. **Budget-deferrable.** The frame budget must be able to
   shed each layer independently — "an optional tier must
   never be the reason a frame is late" (`render/scene.js`,
   the LSS deferral in `main.js`). A kind that cannot be
   deferred cannot ship.
3. **Pickable through one path.** The picker
   (`pickAt` in `main.js`) already resolves event sparks,
   ribbons, stars and LSS cells in a stated order. A new
   kind joins that order with a stated priority, or it is
   not clickable — and a menu entry that opens nothing is a
   lie.

**Per kind, the primitive is a question with a real answer:**

| kind | candidate primitive | the question |
|---|---|---|
| small bodies (SBDB) | points, like stars, on an AU-quantized tile | E19's scope — consume its layer, do not duplicate it |
| comets | the same tile format, `des`-filtered | does the SBDB brick already cover them, or a second query? |
| satellites / majors | points on an AU tile | 01's verdict decides whether this kind exists at all |
| galaxies (nearby sample) | points with a magnitude law like stars | is the sample's count within the point budget, and is its distance column a real measurement (redshift vs parallax — the card must say which)? |
| black holes | a marker primitive — a ring or reticle, not a star point | a BH is not a light source; drawing it as a star is the exact lie this project exists to avoid. What does a BH's row actually measure (position? mass? distance?) — 01 decides |
| orbit lines (optional) | line segments, like relation ribbons | E19 marks orbits optional: "positions are not". Lines belong to the card, not the sky, unless a cited ephemeris says where a body is tonight |

**The one new primitive, if 01 approves black holes, is the
marker**: a GPU-drawn line ring (the reticle machinery in
`render/reticles.js` already draws a pixel-wide ring at any
scale). A marker carries its flag the way a spark does —
`userData` on the layer, cited at build time, refused by an
`assertCited`-style gate at draw time (the relation ribbons
do exactly this: `assertCited` refuses to draw anything
uncited).

**Invariant that matters.** A kind is not a colour. Adding
galaxies as "star points but orange" would be a rendering
choice without a data row; every kind here is a catalogue
first and a pixel second.

**Exit.** Every kind 02 shipped renders, picks, and answers
"measured?" in O(1); the frame budget can defer each layer
independently (a unit test over the budget, as the LSS
deferral has); and an uncited layer of any kind refuses to


## Exit state — 2026-10-07

Every kind sub-plan 02 shipped renders, picks, and
answers "measured?" in O(1).

- **small bodies, comets, planets, satellites** — one
  AU primitive (`render/au-layer.js`): a flat colour per
  kind (these bodies shine by reflected sunlight, so a
  blackbody ramp would lie), size keyed on the apparent
  magnitude the tile carries. The small-body layer was
  refactored onto the same builder — which fixed a silent
  defect: it read `tile.mag`, a field the tile reader
  never exposes, so every body drew at one size; the
  magnitude law now actually runs.
- **galaxies** — `render/galaxy-layer.js`: one point per
  RC3 row, size keyed on the catalogue's own BT, colour
  from the tile's own baked B-VT bytes.
- **black holes** — `render/marker-layer.js`: a
  GPU-drawn ring, not a star point. A black hole is not a
  light source, and the ring says so. Each ring faces the
  camera and holds a fixed angular size at any distance.

The invariants, proven:

- **Provenance in O(1)**: every layer carries its tile's
  provenance block on `userData` — flag and citation —
  and `identityAt` names the tile's dataset kind from its
  header, so a click on a comet tile is a comet, never a
  small body wearing one.
- **Budget-deferrable**: the galaxy field and the
  black-hole markers register with `OptionalTiers`
  (`core/optional-tiers.js`). The frame budget's verdict
  defers them, each layer on its own flag, and a layer
  that is not registered is never deferred. Unit-tested.
- **Pickable through one path**: `core/point-pick.js`
  projects a tiled layer and resolves the hit through the
  tile it came from — the same function a click, a search
  and a deep link share. Pick order: sparks, relations,
  black-hole markers, small bodies, comets, planets,
  satellites, galaxies, stars, cells.
- **Uncited refuses to draw**: every layer builder calls
  `assertCited` on its tile's provenance; a test strips
  the provenance away and sees the builder refuse.

Cards (`ui/celestial-cards.js`): a planet card is an
ephemeris row — epoch and ephemeris source; a galaxy card
states that its distance is a Hubble-law redshift; a
black-hole card reads limit flags as limits (≤, ≥, ≈) and
shows an asymmetric mass uncertainty as one. A missing
value is the em dash, never a zero. 24 new node tests,
385/385; the headless-browser smoke draws all six tiers.

**Far-scale render limit, measured**: the point
pipeline of the software renderer fails its program
validation once render-space positions pass roughly
1e22 m — measured by bisection, clean at 1.2e22,
failing at 2.3e22, independent of the camera's far
plane, colours and sizes. The galaxy catalogue spans
768 Mpc = 2.4e25 m, so the galaxy layer renders at
1/8192 of render space (`RENDER_SCALE` in
`galaxy-layer.js`). The scale is invisible: the
perspective divide cancels a uniform scale, so every
galaxy keeps its true direction, and the floating
origin keeps parallax true; depth is the only thing
compressed, and at these distances every galaxy
already sits at the far plane, where depth is flat
anyway. The black-hole markers (a line primitive,
peaking at 8.5e20 m) and every AU tier are far below
the limit and render unscaled.
