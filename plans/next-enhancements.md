# Next enhancements

Decomposed from [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) after E4–E6 closed,
2026-10-05. Ordered by what most endangers the project's central claim, then by what completes an
interaction.

**Completed:** [E1 picking](next-enhancements.md) · [E2 manifest integrity](next-enhancements.md) ·
[E3 download the slice](next-enhancements.md) · [E4 relation honesty](next-enhancements.md) ·
[E5 exoplanet relations](next-enhancements.md) · [E6 cinematic auto-fly](next-enhancements.md) —
all shipped 2026-10-04/05, 275 node tests green.

---

## E7 — Figure stars from Hipparcos, so the figures are drawn between named stars

**Why now.** E4 stopped the constellation layer from drawing ribbons between stars the figures do
not name, and in doing so cut it to **50 of 150 segments**. The honest cost was accepted — but it was
accepted on the assumption the stars could not be fetched. That assumption has now been tested and is
false.

Measured today: the NASA/ESA **VizieR** mirror of Hipparcos answers in **1.7 seconds** and returns
**8,789 naked-eye stars** (V < 6.5) with positions *and* parallaxes. Against the 893 figure vertices:

| tolerance | vertices matched |
|---|---|
| 1″ | 590 (66%) |
| 5″ | 847 (95%) |
| **10″** | **874 (98%)** |
| 30″ | 889 (100%) |

Median separation **0.58″**. The figure points *are* catalogue stars — E4's looseness was never a
property of the figures, only of the nearest-star lookup we had. 6,421 of those stars sit inside the
200 pc the atlas already renders, so the recovered layer is inside the scale the camera reaches.

**Scope.** Ingest the naked-eye Hipparcos set as its own provenance-carrying tile. Match each figure
vertex to its star one-to-one, carry the measured parallax, and let the relation layer resolve
endpoints against *those* rows rather than against the nearest star in the neighbourhood tile. The
10′ tolerance E4 introduced stays as the ceiling; with real vertices it should almost never bind.

**Invariant that matters.** A figure endpoint resolves to the star the figure names, or the segment
is not drawn. No fallback to "whatever star is nearby" — that is the behaviour E4 removed, and
restoring it quietly would undo the whole point.

**Exit.** Every drawn endpoint names a Hipparcos star, and the segment count rises well past 50 with
the match quality reported per segment.

---

## E8 — The modelled tier becomes pickable

**Why now.** E1 made stars pickable and the field card reachable by falling back when nothing else
is selected, but a click on the modelled structure itself still does nothing. Every layer that draws
something should be interrogable, or the viewer is left guessing what they are looking at when they
click it.

**Scope.** Raycast the LSS layers, resolve a hit to the cell it is, and report that cell in the field
card: its grid indices, quantised density, and the distance band the current fade represents. The
existing `dropStaleSelection` and the tier's fade already govern when the layer is interactable at
all; this extends the same discipline to picking.

**Invariant that matters.** A picked cell reports its own density. It must not be described as a
galaxy, a void, or an overdensity in units that imply a measurement — it is a quantised value in a
seeded random field, and the card says so.

**Exit.** A click on visible structure names the cell and its density; a click on nothing clears it.

---

## E9 — Captions for the cinematic holds

**Why now.** E6 holds for five seconds at each scale "so the eye can catch up", and then says
nothing. The hold is the whole point of the mode, and it is currently the emptiest five seconds in
the product — the viewer is held at a scale with no word about what they are looking at.

**Scope.** One line per step, timed with the hold: the scale in units a person can hold, and what is
measured there. At the neighbourhood: *a parsec is 3.26 light years — the distance light travels in
a year*. At 500 Mpc: *this is a model, not a survey*. Sourced from the same research the rest of the
copy comes from, not invented for the mode.

**Invariant that matters.** A caption is a claim like any other. Each one carries its own source, and
the modelled tier's caption says *simulated* in the text rather than relying on a badge the viewer may
not be looking at.

**Exit.** Every cinematic step shows its caption during its hold, and the caption disappears the
moment the sky is taken back.

---

## Not now, and why

- **Binary pairs from Gaia DR3.** Still blocked: Gaia TAP returned nothing in 90–120 s for probes as
  small as a 0.05° patch. VizieR works and is fast, but a wide-binary catalogue needs the Gaia
  neighbour table specifically, and inventing pairs from co-motion at our parallax precision would
  be a guess dressed as a relation.
- **Constellation borders.** The same d3-celestial layer as the figures, and the same uncited-vertex
  problem E7 is about to solve for the figures. Solve the vertices once, then decide whether borders
  earn their place.
- **A bulk DESI mirror.** Unchanged: the tier stays generated until `data.desi.lbl.gov` answers, at
  which point the badge flips back on the same tile format and nothing else changes.
