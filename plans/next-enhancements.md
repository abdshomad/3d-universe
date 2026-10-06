# Next enhancements

Decomposed from [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) after E13–E15 closed, 2026-10-05.
E19–E21 decomposed 2026-10-06, after the tour landed.
This cycle is about the whole rather than the parts: fifty tasks have verified features in isolation,
and none of them has checked what a person actually does.

**Completed:** [E1 picking](next-enhancements.md) · [E2 manifest
integrity](next-enhancements.md) · [E3 download the slice](next-enhancements.md) · [E4 relation
honesty](next-enhancements.md) · [E5 exoplanet relations](next-enhancements.md) · [E6 cinematic
auto-fly](next-enhancements.md) · [E7 figure stars](next-enhancements.md) · [E8 tier
picking](next-enhancements.md) · [E9 captions](next-enhancements.md) · [E10 event
picking](next-enhancements.md) · [E11 binary pairs](next-enhancements.md) · [E12 link
round-trip](next-enhancements.md) · [E13 relation picking](next-enhancements.md) · [E14 pulsar
verification](next-enhancements.md) · [E15 journey captions](next-enhancements.md) · [E16 first
run](next-enhancements.md) — 349 node tests.
---

## E17 — The five catalogues that ship unverified

**Why now.** Nine data assets ship. Four have a verifier — the manifest, the baked tiles, and now the
events. **Five do not**:

| asset | what depends on it |
|---|---|
| `landmarks/landmarks.json` | search, journey routing, the guided flight |
| `search/nearby.json` | typing a name and being taken there |
| `relations/constellations.json` | every figure drawn on screen |
| `relations/figure-stars.json` | the endpoints those figures resolve to |
| `relations/exoplanets.json` | 1,440 planets on 3,080 star cards |

The event catalogue had exactly this gap and paid for itself immediately: 598 of 598 resolved, and the
check found that 559 of the distances were dispersion-measure estimates nobody had noticed. **Five more
assets are carrying the same unexamined assumption**, and one of them — the landmark set — decides where
a search takes you.

**Scope.** Extend the pattern rather than inventing a new one: for each asset, resolve every row back to
the catalogue it claims, and report what does not. Where a source is unreachable from this host, say so
with the receipt rather than skipping the check — the point is to know, not to pass.

**Invariant that matters.** An asset that cannot be verified against its source must say that in the
file. A catalogue that cannot be checked is not the same thing as one that has been checked and passed.

**Exit.** Every shipped asset either verifies against its source or records why it cannot, and the
count of unresolved rows is a number someone has looked at.

---

## E18 — Re-measure, or stop claiming

**Why now.** Every performance figure recorded in the plans was measured before this host's disk filled.
The atlas currently renders at **4.3 fps** here, where it measured **60 fps** when healthy. So the
recorded claims — *60 fps with the tier drawn and 60 with it hidden, a 0.01 ms difference*, *0.1 ms to
parse 884,736 bytes*, *cold start to the local tier under 5 s* — cannot be reproduced on this machine
today, and nothing in the repository would notice if they had quietly become false.

That is the one kind of claim in this project that no test guards: the test suite proves the code
behaves, not that it is fast.

**Scope.** Make the numbers checkable rather than remembered. One command that reports frame rate,
tier cost, parse cost and cold start, writing its output somewhere a person reads it. Then re-measure,
and correct the plans wherever the machine's answer differs from what is written — including if the
answer is "this is slower than we said".

**Invariant that matters.** A recorded number carries the machine and the conditions it was measured on.
"60 fps" without them is a story, and this project's whole argument is that a story is not a
measurement.

**Exit.** One command reports the current numbers, the plans carry figures that match it, and any
figure that cannot be re-measured says so where it is stated.

---

## E19 — The solar system tier that ships but does not render

**Why now.** The PRD's v1 table marks T0 — solar system and small bodies — as in
scope, and the ingest side is done: `ingest/sbdb.py` fetches real orbital
elements, `bake_sbdb` writes an AU-quantized tile, the verifier re-runs an SBDB
query, and `astro/orbits.py` places bodies at the catalog epoch. But no SBDB
tile is in `assets/tiles/`, no layer in `web/src/` draws one, and the
fact-card dispatcher refuses small bodies on the grounds that "we hold no such
catalogue" — which stopped being true the day the ingest ran. A visitor can fly
to 500 Mpc but cannot see Ceres.

**Scope.** Bake the T0 slice (the phase-1 plan already measured 200 asteroids at
6e-5 AU round-trip error), ship the tile, and render it as its own layer with
its own provenance flag — a cited small body, not a star. The fact card learns a
`small_body` kind: name, diameter, absolute magnitude, and the orbital epoch the
position is valid for. Orbits as lines are optional; positions are not.

**Invariant that matters.** A small body's position is an *epoch*, not a fact.
The card must say when the elements were computed for, or the viewer is being
shown a past Ceres as though it were tonight's.

**Exit.** A small body renders at its SBDB position, its card names the spkid
and the epoch, and the verifier's SBDB path covers the shipped tile.

---

## E20 — The 100,000-star criterion, measured or withdrawn

**Why now.** The PRD's success criteria say "100 000+ real stars navigable at
60 fps on a mid-range laptop GPU". The shipped tile carries 60,000. The ceiling
is not engineering but data: the Gaia@AIP mirror this host can reach serves
~0.05% of DR3 — 62,723 stars brighter than G=8, and zero in the box containing
Alpha Centauri A (recorded in the research doc, `n` #23). So the criterion is
currently unmet, nothing in the repo would notice, and the PRD still states it
as a goal.

**Scope.** Measure the reachable maximum: query the mirror for the full extent
it will serve, bake every star it returns, and report the count against the
criterion. If the mirror cannot reach 100,000, find a second source (Hipparcos
is already ingested for landmarks; Yale BSC is named in the research) or
correct the PRD criterion where it is stated, with the reason. Frame cost at the
new count belongs to E18's re-measurement, not here.

**Invariant that matters.** A success criterion is a claim. It is either
measured against or edited — never quietly hoped for.

**Exit.** The star count shipped is a number someone has looked at, the PRD
criterion matches the machine's answer or says why it cannot, and the nearest
unnamed stars (the Alpha Centauri box) are either present or the gap is stated
where the map is shown.

---

## E21 — Galactic structure: measured density, or say so

**Why now.** The PRD's tier table marks T2 — galactic structure: dust, HI,
Milky Way morphology — as "phase 1", and phase 1 is closing. What exists today
is procedural: nebulosity from 3D fBm noise and star dust, both honestly
flagged. What the research names for T2 is different in kind: "density fields,
not individuals — Planck dust, HI/21cm, HERA, extinction maps". No measured
density field has ever been probed from this host, so the atlas has measured
large-scale structure at 500 Mpc while the near field — the least measured
place in the whole atlas — is only noise.

**Scope.** Probe the T2 sources the research names (Planck, HI/21cm surveys)
from this host, exactly as the DESI probe was run: record reachability,
licence, and size. If a density field is reachable at a sane size, ingest it as
a flagged layer (extinction or HI column density, not points); if not, record
the receipt and leave the procedural dust as the only medium — visibly
UNRESOLVED, as it already is.

**Invariant that matters.** A density field is not a picture. Ingesting an image
of the Milky Way and calling it galactic structure would be the exact lie this
project exists to avoid; only a sampled field with a provenance block qualifies.

**Exit.** Either a measured density layer ships with its provenance block, or
the research doc and this plan record which sources were probed, which were
reachable, and why none shipped.

---

## E22 — The known-bodies menu

**Why now.** The atlas holds seven cited datasets and the only
door to any of them is search-by-name. A visitor who does not
know a name cannot ask "what is here" — and the user's first
ask for this project was a menu of planets, satellites, comets,
galaxies, black holes. Four of those six kinds the atlas holds
nothing for, and the project's whole argument is that a kind
without a cited catalogue must not be faked. So the menu is
planned catalogue-first: research, then ingest, then render,
then the menu itself.

**Scope.** [`plans/celestial-menu.md`](celestial-menu.md) and its
five sub-plans — 01 catalogue survey (verdicts with receipts per
kind), 02 ingestion (bricks, tiles, verifiers), 03 render
primitives (one layer per kind, each budget-deferrable and
pickable), 04 the HUD menu (a pure view model over loaded
datasets), 05 flight and fact cards (a pick flies and opens a
cited card, or says why it cannot). Consumes E19's SBDB tile
rather than duplicating it.

**Invariant that matters.** The menu is a projection of what is
loaded, not a second list. A kind with no dataset says so, with
the reason — an honest absence is information, a silent one is a
bug.

**Exit.** The menu in a headless browser lists exactly the loaded
kinds with their flags, every entry flies and opens a card that
names its source, and a kind without a catalogue is absent or
marked not-held — never populated.
