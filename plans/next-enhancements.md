# Next enhancements

Decomposed from [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) after E10–E12 closed, 2026-10-05.
Two of these need no external data at all, which is the point: three catalogues were probed and found
unreachable this cycle, and the next batch does not pretend otherwise.

**Completed:** [E1 picking](next-enhancements.md) · [E2 manifest
integrity](next-enhancements.md) · [E3 download the slice](next-enhancements.md) · [E4 relation
honesty](next-enhancements.md) · [E5 exoplanet relations](next-enhancements.md) · [E6 cinematic
auto-fly](next-enhancements.md) · [E7 figure stars](next-enhancements.md) · [E8 tier
picking](next-enhancements.md) · [E9 captions](next-enhancements.md) · [E10 event
picking](next-enhancements.md) · [E11 binary pairs](next-enhancements.md) · [E12 link
round-trip](next-enhancements.md) — 321 node tests green.

---

## E13 — The relation layer becomes selectable

**Why now.** Three layers in this atlas can be pointed at and interrogated: stars, modelled cells,
events. Relations cannot. A constellation line is drawn between two named Hipparcos stars, under a
citation, and clicking it does nothing — so the one layer whose entire content is a *claim about a
relationship* is the one you cannot ask anything about. That is the same argument that justified E10,
and it is not finished until the relations layer answers too.

**Scope.** Click a ribbon, resolve which relation it belongs to, and show a card: the figure's name,
its catalogue, and the two stars at its ends with their measured positions. For a double, the
separation and the WDS number. The relation already carries its `relationType` and citation in
`userData`, so the honest version of this is mostly plumbing — which is the sign it should have been done
earlier.

**Invariant that matters.** A selected relation names both of its endpoints. A line that cannot say
which two stars it joins is a mark on the sky, and it should not be selectable as though it were a
statement.

**Exit.** A click on a drawn line names the relation, its source, and its two endpoints.
**Status: done, 2026-10-05** — ribbons are picked in screen space, like the modelled cells: a line a
few pixels wide cannot be raycast honestly, so the curve is projected and the nearest point within
14 px is the pick. The star index now carries the id of every star it holds, and a ribbon records the
two ends it joins — a line that cannot say which two stars it connects is a mark on the sky, and it
should not be selectable as though it were a statement.

Verified live: clicking a line in Ursa Major selects `constellation:UMa` and the card reads **joins HIP
54539 and HIP 50372**, *match quality 1.6″ — the worst of its two ends*, cited to Hipparcos via VizieR.
A ribbon with an unnamed end reports that one end is not a catalogued star rather than claiming both.


---

## E14 — The pulsar catalogue is verified, and its distances are labelled

**Why now.** `ingest verify` round-trips every baked *tile* id back to its catalogue. The event
catalogue has never had that check, and looking at it closely turns up something worth knowing:

> Of **598** pulsars, **559** have distances derived from a dispersion measure. Only **39** have a
> parallax.

The atlas places every one of them in 3D using those numbers. The card says
`distance from: dispersion-measure` on a row, which is honest and easy to miss — but the *layer* gives
no hint that 93% of its spark positions rest on an estimate rather than a distance measurement.

**Scope.** Two parts. Round-trip every pulsar id back to ATNF through VizieR's `B/psr/psr` — probed this
session, answers in **1.3 seconds**, carrying `Name`, `RAJ2000`, `DEJ2000`, `Plx`, `DM`, `P0` — and
refuse to ship a catalogue whose ids do not resolve. And make the estimate visible where it is used: the
spark layer should distinguish a parallax distance from a dispersion-measure distance the way the LSS
tier distinguishes measured from simulated, so a viewer who has not opened a card still knows.

**Invariant that matters.** A DM-derived distance is an estimate with a real uncertainty, and the
uncertainty grows with the square of the DM. Nothing in this layer may present one as a measured
distance.

**Exit.** Every pulsar id resolves against ATNF; the layer distinguishes measured from estimated
distances, and says how many of each it is drawing.

---

## E15 — Captions for the guided journey

**Why now.** E9 gave the cinematic a caption for every hold and ended the "emptiest five seconds in the
product". The *other* fly-through — the `j` guided journey, which is what most viewers actually watch —
still holds in silence at each scale. Half the fix is already written; the copy is derived from radii.

**Scope.** The same `captionFor` the cinematic uses, applied to the journey's holds. No new copy, no new
mechanism — the same discipline, in the place more people will see it.

**Invariant that matters.** One source of scale copy. Two implementations of the same sentence will
drift, and a caption that contradicts another caption is worse than no caption.

**Exit.** Every journey hold shows the caption the cinematic would show for that scale.

---

## Not now, and why — with receipts

Three catalogues were probed this cycle and found unreachable from this host. None of them is a guess;
each was measured, and each belongs in the record so nobody re-derives it next cycle.

- **Fast radio bursts (frbtheorycat).** Every export URL returns the site's Joomla HTML rather than
  CSV: `?task=export.format=csv&type=csv` → 71,688 bytes of `<!DOCTYPE html>`, and two alternates the
  same or a 404. The endpoint has moved or changed its parameters.
- **Gravitational-wave events (GWOSC).** The site root answers 200, and every API path 404s with an
  HTML page: `/api/events/GWTC-1-confident/`, `/api/v2/events/`, and the trailing-slash variant all.
  A 301 on one path resolves to that same 404.
- **Gaia DR3 (ESA).** Unchanged: three probes, the smallest a third of a degree across, nothing in
  90–120 seconds.

The event layer's code already draws `frb` and `gravitational_wave` kinds, so when either endpoint
answers this is a data change and nothing else. VizieR worked for everything this cycle — Hipparcos for
the figures, WDS for the doubles, and ATNF for E14 — which is the argument for treating it as the
default mirror rather than a fallback.
