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
draw, with a test that corrupts one row and sees it refused.
