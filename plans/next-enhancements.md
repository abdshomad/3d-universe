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

**Status: done, 2026-10-05** — the spark layers record which catalogue row each vertex belongs to.
That mapping is recorded rather than inferred: an event with no position is skipped, so a vertex index
is *not* an event index without it, and a test pins the case where the second event in the catalogue is
the third drawn.

Events are picked **before** stars. Sparks are drawn with `depthTest: false` and `renderOrder: 15`, so
they sit on top of the stars behind them; picking in a different order would let a click name a star
the viewer cannot see. My first implementation had the comment right and the code backwards.

Verified live by sweeping the sky at 1 kpc and clicking: `pulsar:B0906-17` selects, and the card gives
the kind, the flux at 400 MHz, the period, the age, the distance *and its source*, and the ATNF
citation. Period, flux and age are kept distinct because they are different kinds of measurement.

**The card was disagreeing with the sky.** A pulsar placed from a dispersion measure has
`distance_kpc` and no `distance_pc`, so the card showed a dash for a pulsar that is visibly drawn at a
position — the layer placed it by one field and the card quoted another. The card now quotes
`distance_kpc` when that is what the layer used, so the two agree, and still names whether that
distance came from a parallax or a dispersion measure.

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

**Exit.** Every pair kept has both components resolving to catalogue rows, with its separation and
catalogue identifier reported, and the count of omitted pairs stated rather than hidden.

**Status: done, 2026-10-05, with no edges drawn — deliberately** —
`ingest/sources/doubles.py` takes the naked-eye WDS catalogue, derives each secondary's position from
the primary plus its separation and position angle, and keeps only pairs whose **both** components
match a measured row within 30″. Result: **2,885 pairs** of 28,516 candidates, attaching to **3,080
stars**; 23 pairs with no tile row are counted rather than dropped.

**No edge is drawn, and the measurement says why.** The median separation is **5.1 arcseconds**. At
100 pc that is a fraction of a pixel, so an edge between the components would have no visible length and
one drawn at exaggerated scale would be a diagram pretending to be a measurement. The same call as
E5's exoplanet orbits, for the same reason. A double is a fact about its stars: the card names the
companion, the separation in arcseconds, and the WDS number.

**Three bugs in the ingest, each of which quietly produced a plausible number.**

1. *WDS gives the primary's position, not a pair centre.* Interpreting `RAJ2000`/`DEJ2000` as the centre
   and offsetting both components resolves **7,091** component positions; reading it as the primary
   and offsetting only the secondary resolves **9,746**. Both were measured, not assumed.
2. *`sep1 = 999.9` means "unknown", not "far".* It is greater than zero, so a `sep1 > 0` filter admits
   it and puts the secondary 16 arcminutes away on invented geometry. One "resolved" pair was exactly
   this.
3. *The tile's positions are 16-bit, and I read them as one byte each.* Every coordinate was garbage:
   **zero** of 400 reference stars matched under any axis permutation. With the fix, 292 of 400
   match — the expected rate, since some naked-eye stars lie beyond the tile's 200 pc. That one bug
   moved the result from **34 pairs to 2,885**.

The matcher is also indexed by sky cell. Comparing every candidate against every star is 523 million
comparisons in pure Python, which timed out at 280 seconds; bucketed, the same ingest takes 5.4 s.

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
**Status: done, 2026-10-05** — `web/src/core/selection-resolver.js`. A link's `s=` id is resolved by
kind: a landmark through the search index, a modelled cell through the density field, a pulsar or
burst through the event catalogue, a catalogue star through the tile's ids. A restored cell is the same
object a click produces, so the two are indistinguishable downstream.

Verified live with three links: `s=lss:446880` restores the cell and shows its card; `s=lss:999999`
and `s=nonsense-id` both report **selection not restored**, naming the id that was asked for and
saying the position, orientation and epoch in the link did arrive intact.

**The bug that shipped for nine minutes.** My patch anchored on a single-line import that had already
been rewritten to multi-line, so the import was never added, and `node --check` passed — it validates
syntax, not whether an identifier is bound. The browser caught it as `resolveSelection is not defined`.
Anchoring a patch on text that has since changed shape fails silently, and a syntax check cannot see
it. The check that would have caught it: grep every imported name against the import list, which is now
part of the loop.


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
