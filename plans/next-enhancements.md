# Next enhancements

Decomposed from [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) after sub-plan 05 closed,
2026-10-04. Three enhancements, each with an exit criterion a browser can falsify. Ordered by how
much they close the project's stated promises — not by how easy they are.

---

## E1 — Object picking: click a light, read its card

**Why now.** PRD core feature 7 says *every selection shows a fact card*. Today a selection only
exists after you type a name: search resolves a HIP, the route flies there, the card appears. A
click — the most natural gesture in a 3D atlas — does nothing. I deferred this while building the
cards, and it is now the largest gap between what the PRD promises and what the app does.

**Scope.** A raycast against the star layers and the spark layers, resolving a hit to a catalog
identity, setting the reticle, and routing the card. Hover is out of scope: click only, so the
gesture is unambiguous while flight controls are live.

**Invariant that matters.** A pick resolves through the same tile and star index the search box
builds from, and produces the same identity shape. If a click can name a star the search box
cannot, or the two disagree about its distance, they disagree about identity — which is precisely
the bug class this project exists to prevent.

**Exit.** A click names the star under the cursor, pins the reticle to it, and shows its card;
where no star is drawn, nothing is claimed. Verified in the browser, both ways.

**Status: done, 2026-10-04** — `web/src/core/picker.js` holds the decisions (click vs drag, which
hit wins, what a hit *is*), and `main.js` owns only the raycast. The threshold is what four pixels
are worth at the depth of the object under the reticle, so a pick is neither easier nor harder at
one scale than another. Verified live at 10 pc among 72,219 stars: a centre click selected
GAIA 2739689239311660672 at 4.118 pc — a *nearer* star than the reticle's 85.9 pc candidate, which
is the whole point of clicking rather than centring. The pick pins: steering the view away, and the
LOD dropping to 3,000 points, leaves the reticle and the card on the star that was clicked. A drag
picks nothing. Ten tests cover the identity maths, including that a pick resolves to the same
distance the tile encodes and that an unsupported unit is refused rather than mis-scaled.

**One bug this surfaced, worth keeping.** At 1 Mpc the LOD drops every star, and the card kept
naming GAIA 3891136711141807232 at 85.944 pc — a star no longer on screen. `dropStaleSelection`
now clears any star selection when the LOD drops the star set, so with 0 stars drawn the card
claims nothing at all. A card asserting a measurement about something not drawn is precisely the
failure this project exists to prevent, and nothing about that card looked wrong until the
observation was read.

---

## E2 — Manifest integrity: every rendered light resolves to a catalog row

**Why now.** This is Phase 1 exit criterion 2 and the project's central promise: *every rendered
measured object resolves to a catalog row*. It has never been asserted anywhere. Prose about
provenance is not a guarantee; a check is.

**Scope.** Two assertions. Offline: for every baked tile, the manifest's `count` matches the tile
header and the file's `sha256` matches the bytes on disk — so a stale manifest cannot ship. Online:
every star currently drawn resolves, through `SearchIndex`, to an entry with a distance, a magnitude
and a provenance string.

**Invariant that matters.** The check must run against the *rendered* set, not the tile's nominal
count. A tile that claims 60,000 stars and yields 58,412 resolvable ones is exactly the failure
worth catching.

**Exit.** The integrity check runs in CI over the baked assets and reports zero unresolved stars at
three scales (10 pc, 10 kpc, 1 Mpc). A deliberately corrupted tile fails it.

---

## E3 — Download the slice

**Why now.** PRD user 3 is *scientist-adjacent — checks that positions and provenance are correct,
and can download the slice.* Two of three verbs are shipped. The third is the one that makes the
first two checkable, and it is small once provenance is already first-class in the card.

**Scope.** A button that exports exactly what is on screen as CSV: id, RA/Dec or baked Cartesian
position, magnitude, colour index, distance in pc, light-travel years, and the provenance string.
Nothing synthesised is exported without its flag in a column of its own.

**Invariant that matters.** The export must not be able to launder a modelled object into a
measured one. A `flag` column that reads `SIMULATED` for every row the tier generated, and
`MEASURED` for catalogue rows, is not decoration — it is the export's contract.

**Exit.** Export at 10 kpc produces rows whose provenance strings match the on-screen cards exactly,
and every modelled row is flagged. Verified by reading the file back.

---

## Not now, and why

- **Cinematic auto-fly mode** (locked decision 5). The journey builder and the opening already give
  an authored camera path; a separate cinematic mode is presentation on top of machinery that
  exists. Better spent after picking, which it would need to feel complete.
- **A bulk DESI mirror.** Noted in sub-plan 05 as a locked assumption change: the tier stays
  generated until a real mirror is reachable. Revisit only if `data.desi.lbl.gov` answers.
- **Exoplanet and binary relations.** The relation layer carries constellation lines today. The
  ingest for host–planet pairs is unbuilt, and inventing edges without a cited source would violate
  the knowledge-graph rule that every edge is a relation we can name.
