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
run](next-enhancements.md) · [E17 asset
verification](next-enhancements.md) · [E18 re-measurement](next-enhancements.md) ·
[E19 the solar system tier](next-enhancements.md) ·
[E22 the known-bodies menu](next-enhancements.md)
— 391 node tests.
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

## E23 — The point pipeline kills SwiftShader at ~15 s

**Why now.** Found while extending the celestial smoke to
live past its first two seconds (E22/04): the committed
code — no menu changes involved — loses the WebGL device
about 15 s into the default route under software rendering.
Three shader-validation failures (`Shader Error 0`, then
`1282` × N, empty info logs) and then
`WebGL Device Lost: Unknown reason`. Real keypresses wait
~1.4 s each behind the frame loop, so any check that
interacts with the page lives long enough to hit it.

**What is known (measured, 2026-10-07).** Pre-existing on
`HEAD` (verified by stashing the menu work and re-running).
Not the far-scale limit: the camera is near the floating
origin at the failure, and the galaxy layer's 1/8192 render
scale already covers that. It is cumulative across the
additive point layers — hiding **any one** of `stars`,
`lss-field`, `sparks`, `nebulosity`, `star-dust`, `galaxies`
keeps a 16 s run clean, so each layer is necessary to the
failure; the deep-field backdrop and the constellation
ribbons are innocent (hiding them changes nothing). Host
memory is not the cause (490 GB free).

**Scope.** Find the resource SwiftShader exhausts: capture
the failing program's validation state (the info log is
empty today — try `gl.getProgramInfoLog` before three's
wrapper, or run with `WEBGL_debug_renderer_info`), count
live programs/uniforms/attribute buffers at the failure
moment, and compare backends (`--use-angle=swiftshader`
vs `--use-gl=swiftshader`). If it is a hard software-raster
limit, the honest fix is the frame-budget controller
shedding whole point *layers* (not only stars) when the
backend is software — the same rule that sheds stars today,
one level up.

**Exit.** A 60 s headless run under SwiftShader completes
with zero page errors and all six point layers drawing.

