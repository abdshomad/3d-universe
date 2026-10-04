# Next enhancements

Decomposed from [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) after E1–E3 closed,
2026-10-05. Ordered by what most endangers the project's central claim, not by what is easiest.

**Completed:** [E1 object picking](next-enhancements.md) · [E2 manifest
integrity](next-enhancements.md) · [E3 download the slice](next-enhancements.md) — all shipped
2026-10-04, 247 node tests green. Those three remain recorded in the history below.

---

## E4 — Constellation vertices must resolve to a measured star

**Status: done as far as the data allows, 2026-10-05** — and the first thing to record is that my
original framing was wrong. The renderer never placed vertices at assumed positions: it calls
`index.nearest(ra, dec)` and draws between the *measured* stars it finds. Every ribbon already joins
two real catalogue rows.

The real defect is subtler and worse. `nearest` accepted any match within **0.35° — 21 arcminutes**.
Of 300 segment endpoints, only 113 (38%) match within 10″; the median is 289″ and the 90th
percentile is 2,318″. So most ribbons were joining a star the figure does not name, while the
citation on the layer implies the relation is real. A wrong relation asserted confidently is a worse
failure than a missing one, and this one was in every session.

**What changed.** `nearest` now reports the separation it accepted. A ribbon whose worst end is worse
than **600″** is dropped and counted, because a figure point is the position of a specific star and
10′ is already a poor claim. Each drawn mesh records its own `endSeparationArcsec`, and the report
names the worst match it kept. Verified live: 89 cited figures, 150 segments attempted, **50 drawn**,
**27 dropped as too loose**, worst match kept 536″, no console errors.

**What that costs.** The layer now covers a third of its segments instead of most of them. That is
the honest price: the other two thirds were asserting pairings up to 21′ off. The report says so
rather than hiding it.

**Recovery is blocked on catalogue access, not on design.** Three Gaia probes failed — a 0.05° patch
and a 12°×26° box both returned nothing in 90–120 s. SIMBAD answers in about a second but its ADQL
rejected every geometry and magnitude form tried (`CONTAINS`/`POINT`/`CIRCLE`, `flux(V)` in `WHERE`).
VizieR's Bright Star Catalogue answered minimal queries in 1–3 s and is the next thing to try: one
query for 9,110 naked-eye stars, matched locally, one-to-one, dropping any segment with an unmatched
vertex. The mechanism is about forty lines and its policy is written out above; it is not in the tree
because nothing calls it yet, and shipping uncalled code is how it rots.

**Two things worth keeping from the work.** `relation-layer.js` had **no tests at all** — the
matching logic that makes every claim in the knowledge graph had never been executed by the suite.
There are six now, covering match quality, the drop, the count and the worst-case report.

And the crash they found was mine, not inherited. `HEAD` carried
`index[segment.length - 1] ? endOf(segment) : null` — harmless, because indexing a `StarIndex` by a
number is always `undefined`, so the call never ran. Rewriting that condition to
`segment[segment.length - 1]` made it live and threw `ReferenceError` on every ribbon build. The new
tests caught it in the same minute. The whole dead statement is gone.

---

## E5 — Exoplanet relations: host to planet, cited

**Status: done, 2026-10-05, with one part deliberately not built** — `ingest/sources/exoplanets.py`
pulls `pscomppars`, which is one row per planet; `ps` is one row per *publication* and inflates the
count to 7,905 rows for 1,630 hosts. Inside 200 pc that is **2,345 planets across 1,652 systems**,
nearest Proxima Cen b at 1.30 pc, discovered 2016 by radial velocity.

**The edge is not drawn, on purpose.** The scope above asked for a host→planet ribbon. At 50 pc a
5 AU orbit subtends about a third of an arcsecond — a fraction of a pixel. Drawn at true scale the
line has no length, and drawn at exaggerated scale it is a diagram pretending to be a measurement.
So the planet is a **fact about a measured star** instead: the host is a real tile row, and the card
that names the star names its planets, with the archive as the source. That is the relation this
scale can actually support.

**A third flag.** An exoplanet has no astrometry, so its 3D position is the archive's `sy_dist`
applied to a measured direction. That is a real number and not an astrometric solution, so rows and
cards carry `DERIVED` alongside `MEASURED` and `SIMULATED`, and the export gate now refuses anything
outside the three.

Verified live: **968 of 1,652 systems** matched a measured star within 10′, carrying **1,440
planets**; the 684 that matched nothing are counted, not dropped quietly. Export read back: 61,440
rows — 60,000 `MEASURED`, 1,440 `DERIVED`, with `host`, `disc_year`, `st_teff` and
`discovery_method` filled for every planet and left empty for every star.

**Two defects reading the file caught.** The exported provenance had an empty citation, because the
report carried one per matched system and none at the top where the export asked for it. And the
CSV header had no `host` or `disc_year` column at all, so the archive's data was being collected,
formatted and then silently discarded — the export looked complete and was not.

---

## E6 — Cinematic auto-fly

**Why now.** Locked decision 5 puts an *optional cinematic auto-fly mode* in v1. Every other part of
that decision is shipped: the guided journey, the authored opening, free flight, deep links. This is
the one promise in the locked decisions that no code implements yet.

**Scope.** A mode, off by default and never taken from the viewer without consent, that flies the
existing journey with the HUD quiet, the framing composed, and a hold at each scale so the eye can
catch up. It drives the machinery that exists rather than adding a camera system.

**Invariant that matters.** It must be interruptible. A viewer who touches anything takes the sky
back immediately, because a cinematic mode that traps the pointer is the failure this project's
whole premise argues against — the observer is the point.

**Exit.** It runs, it yields on any input, and reduced-motion users are never handed it.

---

## Not now, and why

- **Binary pairs from Gaia DR3.** Queried from this host twice. A sky patch a third of a degree
  across, filtered on `nss_best_neighbour_angular_dist`, returned nothing in 90 seconds. Gaia TAP is
  reachable but not usable for a harvest of this shape, and a wide-binary catalogue that must be
  guessed at is worse than no edges.
- **A bulk DESI mirror.** Unchanged from sub-plan 05: the tier stays generated until
  `data.desi.lbl.gov` answers, at which point the badge flips back on the same tile format.
- **Constellation *borders***, as opposed to figures. A second d3-celestial layer with the same
  uncited-vertex problem E4 is fixing. Fix the vertices once, then decide whether borders earn
  their place.
