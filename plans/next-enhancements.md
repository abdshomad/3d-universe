# Next enhancements

Decomposed from [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) after E1–E3 closed,
2026-10-05. Ordered by what most endangers the project's central claim, not by what is easiest.

**Completed:** [E1 object picking](next-enhancements.md) · [E2 manifest
integrity](next-enhancements.md) · [E3 download the slice](next-enhancements.md) — all shipped
2026-10-04, 247 node tests green. Those three remain recorded in the history below.

---

## E4 — Constellation vertices must resolve to a measured star

**Why now.** PRD feature 4 says every edge is a cited relation, and the citation is there:
`d3-celestial`, derived from Stellarium. But the *vertices* are not catalogue rows. Each of the 89
figures is a list of raw RA/Dec pairs, and the layer draws a line between positions that resolve to
nothing in any tile. This is the same defect class as the stale card that named an undrawn star, and
it is shipped in every session.

Measured today: **893 vertices across 89 figures. 339** have a measured star within 10″ of the
position the figure gives them; **554 do not**, with a median separation of 138″ and a tail out to
degrees. Constellation figures span the whole sky, and most of their stars sit far outside the
200 pc neighbourhood tile we bake.

**Scope.** Ingest the figure stars as a real, provenance-carrying set rather than trusting
coordinates: query the catalogue for the stars at the figure positions, match each vertex to the
row it names, and bake them with their measured parallaxes. A vertex with no measured match is
either dropped or badged — never drawn as though it were measured.

**Invariant that matters.** A figure line is drawn between two *measured* stars or not at all. If
the vertex set and the star set can drift apart, the layer will quietly start drawing lines to
positions again, and nothing will notice.

**Exit.** Every drawn vertex resolves through the same identity path a click uses. A vertex with no
catalogued star is reported, not silently placed.

---

## E5 — Exoplanet relations: host to planet, cited

**Why now.** The knowledge graph has exactly one edge type — constellation lines, which E4 is about
to make honest. PRD feature 4 names *exoplanet host → planet* explicitly. It is also the one
relation type where the data is verified reachable: NASA Exoplanet Archive TAP answered from this
host, returning positions, distances and host names.

Measured today: `pscomppars` gives **2,345 confirmed planets within 200 pc** with a distance, and
the `ps` table carries RA/Dec for the same rows — everything a ribbon needs, inside the scale the
atlas already renders.

**Scope.** Ingest planets with a distance inside the atlas's reach, join each to its host star,
draw the host→planet edge in the existing ribbon language, and give the planet a card: distance,
discovery year, equilibrium temperature, and the archive citation.

**Invariant that matters.** A planet's position is *inferred* from its host's direction and the
archive's distance. Those are different kinds of number, and the card must not present an inferred
position as though it were astrometric. The flag column already distinguishes them for the CSV
export; the card needs to as well.

**Exit.** A planet card names its host, cites the archive, and its distance matches the archive row
that produced it.

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
