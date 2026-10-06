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
verification](next-enhancements.md) · [E15 journey captions](next-enhancements.md) — 329 node tests.

---

## E16 — A first run, driven the way a person drives it

**Why now.** Fifty tasks have landed. Each one verified its own thing: the picker picks, the exporter
exports, the captions appear, the budget defers. Nobody has sat with the atlas and gone *from the door
to somewhere*, because that is the only path a viewer takes and it is the one path no test exercises.

The evidence that this is a real gap rather than a ceremonial one: every bug this session that a unit
test could not see was an **integration** bug. A stale `lssLayer` reference throwing inside the frame
loop. `dropStaleSelection` clearing a selection chosen by a *different* layer. The card quoting
`distance_pc` while the layer placed the spark with `distance_kpc`. Each was invisible until something
drove the app and read what came out.

**Scope.** One continuous session, no shortcuts, exactly as a first-time visitor: land and read the
opening; let the onboarding run; press `j` and let the journey fly; type a name and fly to it; click a
star and a cell and an event; export the slice; copy the link and open it cold in a fresh page. Every
step must leave the app in a state the next step can use.

**Invariant that matters.** Nothing in that path may depend on a previous step having happened. Cold
start, every time — the second load of a URL is the one most viewers never do and therefore the one
nobody tests.

**Exit.** The whole sequence completes with no console errors, and every artefact it produces — the
CSV, the link, the card — is the one a person asked for rather than the one a component happened to
make.

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
