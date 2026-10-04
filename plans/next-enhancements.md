# Next enhancements

Decomposed from [`docs/prd/universe-3d.md`](../docs/prd/universe-3d.md) after E13–E15 closed, 2026-10-05.
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
