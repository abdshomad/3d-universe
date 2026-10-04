# Next enhancements

Decomposed from [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) after E7–E9 closed, 2026-10-05.
Ordered by what most endangers a stated promise, then by what completes an interaction.

**Completed:** [E1 picking](next-enhancements.md) · [E2 manifest
integrity](next-enhancements.md) · [E3 download the slice](next-enhancements.md) · [E4 relation
honesty](next-enhancements.md) · [E5 exoplanet relations](next-enhancements.md) · [E6 cinematic
auto-fly](next-enhancements.md) · [E7 figure stars](next-enhancements.md) · [E8 tier
picking](next-enhancements.md) · [E9 captions](next-enhancements.md) — 299 node tests green.

---

## E10 — Events become pickable: pulsars, bursts, gravitational waves

**Why now.** E8's argument was that every layer which draws something should be interrogable. The
event layer draws and cannot be. Pulsars, fast radio bursts and gravitational-wave events are rendered
as sparks with their own citation, and a click on one does nothing — the picker covers star tiles and,
since E8, the modelled tier. This is the last rendered layer a viewer can point at and get no answer.

**Scope.** Include the event sparks in the pick path and give each a card: kind, distance, period or
flux, discovery year, and the citation the spark already carries. Events are the one catalogue in the
atlas that mixes wildly different measurement types — a pulsar timing solution, a radio burst, a strain
signal — so the card has to keep them distinguishable rather than flattening them into "object".

**Invariant that matters.** An event card says which kind of measurement it is quoting. A pulsar's
period is a timing solution; a burst's flux is a single-epoch measurement. Rendering one as the other is
the same error as calling a modelled cell a galaxy.

**Exit.** A click on a spark selects it, names it, and shows a card that distinguishes the measurement.

---

## E11 — Binary pairs, from a catalogue that answers

**Why now.** Binary pairs have been on the "not now" list since the first decomposition, written off
when Gaia was the only candidate. The reason was always access, and the reason to revisit it is that
**VizieR answers**. Probed this session: the Washington Double Star catalogue (`B/wds/wds`) holds
**157,980 pairs** and returns a count in under two seconds. That is the same mirror E7 used to recover
the constellation figures, and it converts a closed door into an open question.

**Scope.** Ingest the naked-eye subset of WDS, match each component against the Hipparcos set E7
already baked — a pair is only drawn when *both* components resolve to a measured star with a
parallax — and draw the pair as an edge between them, with the WDS separation and the WDS number as
the citation. A pair whose components are both resolved is a real, cited double; one that resolves on
one side only is not a double star in this atlas and is not drawn.

**Invariant that matters.** A pair is two measured stars or it is nothing. The temptation will be to
draw the separation arc where one component is known, and that arc is the strongest-looking thing on
the layer while being the least supported.

**Exit.** Every drawn pair has both components resolving to catalogue rows, with its separation and
catalogue identifier reported, and the count of omitted pairs stated rather than hidden.

---

## E12 — A shared link round-trips what a viewer was looking at

**Why now.** Locked decision 3 is shareable URLs. The deep link carries a selection id, and since E8 a
picked cell has one (`lss:446880`) — but decoding looks that id up in the *star search index*, where no
cell exists. So a viewer who picks a cell, copies the URL and sends it to someone gets the view and
silently loses the thing they were pointing at. The link looks complete and is not, which is the same
defect class as the export with no `host` column.

**Scope.** Teach `decodeView` the selection kinds that exist — star, landmark, and field cell — and
refuse to claim a selection it cannot restore. A link that cannot carry the selection should say so
rather than arriving half-complete.

**Invariant that matters.** A restored view either shows what the sender was looking at, or visibly
says it could not. It never silently drops the selection and presents the result as if that were the
view.

**Exit.** A link with a cell selection restores the cell; a link with a made-up id reports that the
selection is unknown instead of rendering an empty card.

---

## Not now, and why

- **Constellation borders.** The same d3-celestial source as the figures. E7 solved the vertex problem
  for figures, so borders are now *possible* — but a boundary layer is a second thing to look at, and
  the figures it would sit behind are the point.
- **A bulk DESI mirror.** Unchanged: the tier stays generated until `data.desi.lbl.gov` answers, at
  which point the badge flips back on the same tile format and nothing else changes.
- **Wide binaries from astrometry.** E11 is about *catalued visual doubles*, which is a different and
  weaker claim than a measured orbit. Gaia's neighbour table would give the stronger one and remains
  unreachable — three probes, nothing in 90–120 seconds.
