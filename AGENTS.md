Always refactor source code into several smaller files, each under 256 LOC.
Always update this file, then `git commit` and `git push` to
`https://github.com/abdshomad/3d-universe.git` after a task is completed.

## Plans

Every plan lives in `plans/` as `plans/<name>.md`. If a plan grows too big to stay readable and actionable, split it into sub-plans under `plans/<name>/` (`plans/<name>/01-<topic>.md`, `02-<topic>.md`, …), each standing on its own, and keep the parent plan as the index that links to them.

## Inex method

Work the flywheel: `i` → `n`, `n`, `n`… ♾️

- `i` / `init` — deep research into `docs/deep-research/`, PRD into `docs/prd/`, baseline scaffolding.
- `n` / `next` — implement the top `[TODO]` of the active plan; auto-runs `e` when the plan is empty. `n3` runs 3 cycles in one turn.
- `e` / `enhance` — decompose the PRD into 3 tasks per module in `plans/next-enhancements.md`.
- `focus: <dir>` — steer 1 batch at `<dir>` (or edit `plans/focus.md`), then auto-resume the PRD roadmap. `focus: reset` cancels.
- `r` `m` `t` `f` `c` `d` — xtend commands, auto-run after a build: `t`/`f`/`c`/`r` gates, then `m` migrate features, `d` deploy.
- `/loop <interval>` — repeat `n` forever (`/loop 5m`) or capped (`/loop 10m max=6`).
- `/goal <text>` — run a goal until done, e.g. `/goal Run inex continuous loop until Phase 1 done`.
- `/schedule CronExpression="0 9 * * *" Prompt="trigger 'n'"` — run on a schedule.

When the plan is empty, auto-trigger `e`: decompose the next 3 PRD enhancements and continue with `n`.

## Done

- 2026-10-04 — `i` init: deep research, PRD, art direction, reference videos; phase-1 plan split into
  5 sub-plans; grill locked 5 decisions (500 Mpc / DESI tier, simulated fill badged, web + three.js
  WebGPU, interactive atlas + cinematic mode, public web app).
- 2026-10-04 — `n` #1 (sub-plan 01): `ingest/` package built and run against live sources — Gaia
  (nearest stars at 1.30 pc), JPL SBDB (Ceres, real orbits), NASA imagery (asset downloads 200).
  Found the Gaia@AIP mirror answers in ~1 s where the official ESA TAP returns an async job with no
  `TABLEDATA`; ESA path now fails loudly instead of returning empty. README added.
- 2026-10-04 — `n` #2 (sub-plan 01): binary tile format (`ingest/tiles.py`) + `bake` CLI. 11.27
  B/star, round-trip position error 0.0004 pc at the quantization bound. Tiles carry their own unit —
  the first small-body bake came out degenerate because parsec quantization collapsed the solar
  system into one point. Baked counts match the archive exactly: 1413 stars at parallax>50 mas,
  228 at >100 mas.
- 2026-10-04 — `n` #3 (sub-plan 01): `ingest/manifest.py` + `manifest` CLI. Per-tile bounds, unit,
  catalog/release, provenance flag, row-id range and SHA-256; digests verified against `sha256sum`
  and a one-byte flip is detected.
- 2026-10-04 — `n` #4 (sub-plan 01): `ingest/verify.py` + `verify` CLI prove the provenance round
  trip by re-running each tile's stored query and matching catalog ids. Tiles gained a per-object id
  array (`U3DTILE2`, 19 B/star) because a tile without ids cannot cite a star. Corrupting a tile
  (bad id or a shoved position) makes verification fail, so the check has teeth.
- 2026-10-04 — `n` #5 (sub-plan 01, final): catalog releases became data — `ingest/catalogs.json` +
  `catalogs.py`. DR2 and DR3 both bake and verify with no code change; unpublished releases are
  refused with the reason and their date. Sub-plan 01 complete.
- 2026-10-04 — `n` #6 (sub-plan 02): engine core in `web/src/core/` with 12 node tests. Two real
  bugs the tests caught: travel lerped raw coordinates, so a 25-decade target snapped the camera onto
  its axis on frame one; and the start radius was clamped against the target, teleporting the camera
  from 1 m to 5e16 m. Sweep rate now holds at 6.83 rad/s (spread 4.4e-4). Depth is banded, not one
  buffer: 41 km per step at 1 AU versus 595 km.
- 2026-10-04 — `n` #7 (sub-plan 02): octree LOD with physical brightness culling; tiles now carry a
  magnitude range so LOD can ask whether a tile is still bright enough to earn budget. Three real
  bugs found on the way: the box/plane test used min·n and max·n (wrong whenever a normal mixes
  signs, so it culled tiles in plain view); the octree passed a `Box` where a depth was expected and
  recursed forever; and the culling pyramid was built at the camera's real position, where a
  1e20 m coordinate makes every direction give the same garbage planes.
- 2026-10-04 — `n` #8 (sub-plan 02): the atlas draws. Tile reader, star layer and scene runner;
  12,219 measured Gaia stars render in a headless browser at ~9-12 fps under software rendering,
  WebGL2 fallback confirmed. Fixed along the way: three's WebGPU renderer rejects ShaderMaterial
  (needs a node material), point size in world units vanishes at 1e12 m (screen-space now), and a
  far plane taken from the camera's distance clips every star a parsec away. App is served by pm2
  from `ecosystem.config.cjs`, port read from `.env`, which pm2 watches.
- 2026-10-04 — `n` #9 (sub-plan 02): frame budget controller. The atlas sheds stars when frames run
  long and restores them slowly when they recover. Proven live against a 60,000-star tile under
  software rendering: 11 drops to the 3,000-point floor, frame time 95.8 ms to 74.2 ms.
- 2026-10-04 — `n` #10 (sub-plan 02): post chain. Bloom lifts bright cores 101 to 172 pixels and the
  halo band 1.7x, while the void stays exactly `#05060a` — a scene background colour is crushed to
  black by the colour round trip, so the floor is applied last, in display space. ACES was measured
  and rejected: the pass is already display-encoded, so it darkened every star instead of rolling
  highlights off.
- 2026-10-04 — `n` #11 (sub-plan 02): cinematic routes as data (`camera-path.js`, `routes/scale-out.js`).
  Also caught a silent one: the post chain's `vec4()` got an RGBA node, which the node builder
  rejected, so the whole chain — including the void floor — was never applied. Painting the page red
  proved it: with the chain on the void stays `#05060a`; with it off the red shows through.
- 2026-10-04 — `n` #12 (sub-plan 02, final): performance harness. `scripts/perf-check.py` times a
  fixed route in a headless browser and fails the run on budget or stall; budgets live in
  `config/perf-budgets.json`. Found while wiring it: the harness was recording the *clamped* frame
  step, so every frame measured exactly 100 ms. Now it records the real interval — median 0.167 s,
  p95 0.20 s, worst 0.25 s at 3,000 points under software rendering.
- 2026-10-04 — `n` #13 (sub-plan 03): deep-field backdrop — real Webb and Hubble imagery on four
  parallax planes per field, placed by ICRS coordinates. Two real bugs surfaced: three's camera
  looks down -Z, so the yaw mapping pointed the camera *away* from every target and mirrored the LOD
  culling frustum; and route bearings and celestial RA used two different axis conventions, so
  "look at 145 degrees" missed the field placed at 145. Both now live in `core/view.js` and
  `core/celestial.js` with round-trip tests. 78/78 tests pass.
- 2026-10-04 — `n` #14 (sub-plan 03): nebulosity from deterministic 3D fBm noise, plus the shared
  additive point primitive (`render/point-layer.js`) that stars and dust now both use. Two findings
  worth keeping: the node tests could not resolve `PointsNodeMaterial` from three's main build, so
  every render module now imports `three/webgpu` explicitly; and an A/B of the dust is meaningless
  while the camera is flying — the isolated comparison (stars and backdrop hidden) is what showed
  18,588 lit pixels against 12,954.
- 2026-10-04 — `n` #15 (sub-plan 03): star dust — far 1 px grains plus near soft sprites, flagged
  UNRESOLVED so it is never mistaken for catalogue data. Chasing a measurement that came out
  backwards exposed a real waste bug: the whole medium was being re-quantized every time the frame
  budget ticked, several times a second under load. It now rebuilds only when the origin moves or
  the view scale doubles. 99/99 tests pass.
- 2026-10-04 — `n` #16 (sub-plan 03): measured objects. The renderer had its own copy of the
  photometry and the claim "the tile and the screen agree" lived in a comment. Now the JS is a
  verified mirror of the Python: the test spawns python3 and compares magnitude to flux, size,
  B-V to temperature and RGB at 1e-6. 107/107 tests pass.
- 2026-10-04 — `n` #17 (sub-plan 03): relation ribbons. Constellation figures are ingested from
  d3-celestial with their URL and retrieval date, and `assertCited` refuses to draw anything
  uncited. Figure ends attach to the nearest measured star within 0.35 degrees; 77 of 150 attempted
  segments matched — the rest stay undrawn rather than pointing at nothing. 116/116 tests pass.
- 2026-10-04 — `n` #18 (sub-plan 03): reticles — circle, tick arc, gapped crosshair and a rotated
  uncertainty ellipse as line segments, which the GPU draws a pixel wide at any scale. The reticle
  locks onto the nearest measured star to the view centre (Gaia 5262578111591082240 in the
  browser check). Selection is centre-lock for now; click-picking belongs to sub-plan 04.
  124/124 tests pass.
- 2026-10-04 — `n` #19 (sub-plan 03): spark markers from the ATNF pulsar catalogue. Two ingestion
  bugs cost most of this one, both silent: VizieR pads its columns with spaces, so parsing on
  whitespace split RA `00 06 04.80` into three tokens and shifted every field; and the response
  starts with a blank line, so the first line taken as a header parsed every row to {}. Distances
  carry their provenance - parallax or dispersion measure - all the way to the fact card. 130/130
  tests pass.
- 2026-10-04 — `n` #20 (sub-plan 03): the HUD, as a pure view model so its rules are tested without
  a browser. The badge is the point: SIMULATED outranks UNRESOLVED outranks MEASURED, and it reads
  UNRESOLVED here because measured stars and unresolved dust share the frame. A missing B-V shows as
  an em dash, not a zero. 137/137 tests pass.
- 2026-10-04 — `n` #21 (sub-plan 03, final): camera grammar. The rig now keeps the route's gaze and
  the slow drift as separate terms — assigning `yaw` every frame had been silently cancelling the
  drift, so the "constant slow drift" in the art direction never actually ran. Verified live: drift
  grows 0.0053 to 0.0137 rad across a segment while the base angle follows the beats. Sub-plan 03 is
  complete; 140/140 tests pass.
- 2026-10-04 — `n` #22 (sub-plan 04): free flight. Forward integrates the radius exactly as
  d·e^(rate·t) rather than by Euler step, so two half-steps equal one whole step and the gain the
  HUD advertises is the gain you get. Verified in the browser: W grows the distance, the waypoint
  reads 'free flight' while the route is paused, Shift boosts about ten times. 149/149 tests pass.
- 2026-10-04 — `n` #23 (sub-plan 04): landmarks with measured distances, from Hipparcos via VizieR,
  cross-checked against SIMBAD to 0.11-0.99 arcsec. Chasing them exposed something bigger: the
  Gaia@AIP mirror we have been baking from serves only ~0.05% of Gaia DR3 - 62,723 stars brighter
  than G=8, and zero in the box containing Alpha Centauri A. Tiles are statistically fine but
  unnamed stars are usually missing, so a journey built on our own tiles would fly past the
  nearest star without it. Recorded in the research doc.
- 2026-10-04 — `n` #25 (sub-plan 04): search in the HUD. Type a name or a HIP number, get a flight
  path; matching is deliberately narrow, because a looser matcher starts returning stars nobody asked
  for. Verified live: 'sirius' flies to 2.6371 pc, the measured Hipparcos distance, and an unknown
  name answers 'nothing found' instead of inventing one. Paths may now run inward as well as
  outward, since a search can approach a nearby star from far away. 166/166 tests pass.
- 2026-10-04 — `n` #26 (sub-plan 04): fact cards per object kind, as one implementation the HUD
  shares rather than a second copy. Stars, landmarks and events are live: Sirius reads
  '2.637 pc, parallax 379.21 ± 1.58 mas, cross-check 0.16" vs SIMBAD'. Planet, galaxy and nebula
  cards are deliberately absent - we hold no such catalogue, and a card over invented data is the
  failure this project exists to avoid. Two bugs the browser caught: a search entry's description
  overwrote the card's kind and broke the dispatcher, and a missing cross-check rendered the word
  'undefined' in a fact card. 174/174 tests pass.
- 2026-10-04 — `n` #27 (sub-plan 04): light-travel-time scrubber. A 3D sky has no single 'now':
  one star is seen three years late, another three thousand. Every fact card now carries the row
  'light left 2017 - 8.6 yr ago', and the HUD reports the span of epochs on screen. The scrubber
  moves the observer's epoch and recomputes arrivals; it deliberately does not re-render the sky,
  because our catalogues describe one epoch and faking a second would be the easiest lie here.
  182/182 tests pass.
- 2026-10-04 — `n` #28 (sub-plan 04): onboarding, thirty seconds and no wall. Hints are
  independent timers sharing one HUD slot rather than a queue, because in the queue version a
  long-lived flight hint blocked the next useful thing for 24 seconds. The design bug was only
  visible by reading the browser timeline. Verified live: hints supersede each other, and the
  flight hint retires within a second of the viewer flying. 189/189 tests pass.
- 2026-10-04 — `n` #29 (sub-plan 04): accessibility. Keyboard-only flight completed ('/' focuses
  search, Escape dismisses hints), reduced motion stops both self-flying and drift, and the HUD
  palette is now measured: --ink-dim was 3.30:1, below AA for the small labels that used it, and is
  now 5.24:1. The browser caught that my first reduced-motion wiring honoured auto-play but not
  drift - the scene applied it unconditionally. Drift now reads exactly 0 when motion is reduced.
- 2026-10-04 — `n` #30 (sub-plan 04, final): deep links. The URL carries position, orientation,
  observer epoch and selection, and a shared view takes the camera off the route's opening shot. A
  hostile fragment is ignored, not flown to. The browser caught three wiring bugs the unit tests
  could not: the route overwrote the restored position, the link spoke degrees while the rig speaks
  radians, and the selection id was serialised as a truncated number. 205/205 tests pass.
- 2026-10-04 — `n` #34 (sub-plan 05): the modelled tier's fact card. It leads with what the
  tier is *not* - a survey map, no galaxy here is measured - and reaches the HUD without a
  click, because when nothing else is selected and the tier is on screen it is what you are
  looking at. Verified live: 49,410 cells at 200 Mpc, 6,163 at 5000 Mpc. Two plumbing bugs
  the browser caught that the unit tests could not: the seed lives under header.dataset,
  and cardFor passes only observerYear, so pointCount must ride on the object.
- 2026-10-04 — `n` #33 (sub-plan 05): radial LOD and seam continuity. The level switches on the
  angular size of a cell rather than a distance, and the seam smoothsteps opacity over
  1-8 Mpc. Verified live: fine at 2 and 200 Mpc, coarse at 5000 Mpc, hidden at 0.2 Mpc.
  217/217 node tests pass. Two defects found on the way: a stale `lssLayer` reference killed
  the frame loop, and three r186 renamed `PostProcessing` to `RenderPipeline`. The level rule
  was also inverted - fine detail belongs where a cell is *large* on screen, not small.
- 2026-10-04 — `n` #32 (sub-plan 05): the modelled large-scale field. A Gaussian random field with a ΛCDM-like power spectrum, 96³ over 500 Mpc, generated in 1.7 s and identical for a given seed; rendered as one additive point per occupied cell with brightness ∝ density². Verified live at 5 Mpc out: field extent 500 Mpc, 49,410 points, badge reads SIMULATED. parseField refuses any cube not flagged simulated. Caught a unit error - 1 Mpc was 3.086e19 m instead of 3.086e22, drawing the tier a thousand times too close.
- 2026-10-04 — `n` #31 (sub-plan 05): DESI probe. The public path is reachable and documented
  (CC BY 4.0, citation arXiv:2503.14745), but one region is 16.25 GB (ELG) and 5.48 GB (LRG) and
  CosmoDC2 is unreachable from this host. That overturns a locked PRD decision: the 500 Mpc tier is
  generated and badged SIMULATED, not ingested survey galaxies badged SURVEY/STATISTICAL. The
  sub-plan and the research doc now say so, and the stale 'DESI galaxies are measured' note is gone.
- 2026-10-06 — fix: the demo domain answered `not found` at `/`. `serve.js` serves the
  repo root and the atlas lives at `/web/index.html`, so `/` had no index; it now 302s
  there. The redirect must stay a redirect - the import map is relative to `/web`, so
  serving the file at `/` would break `./src/main.js`. One outage along the way: pm2
  runs scripts through `ProcessContainerFork.js`, so an
  `import.meta.url === pathToFileURL(process.argv[1])` main-guard never fires under pm2
  and silently took the site down; the entrypoint listens unconditionally again,
  `process.env` now overrides `.env`, and the tests spawn the real server on an
  ephemeral port (in-process listeners keep `node --test`'s event loop alive and hang
  the run). 4 serve tests; 333/333 pass; verified live through the tunnel: `/` → 302
  → `/web/index.html` → 200.
- 2026-10-06 — feature: the tour. A new visitor is offered a seven-stop
  walk once - sky, search, click, epoch, routes, badge, export - and each
  stop rings the HUD piece it describes. T replays it, Escape or skip ends
  it, and `localStorage` remembers the visitor so it is offered once. The
  hint slot yields while the walk runs. Pure logic in `core/tour.js`, copy
  in `data/tour.js`, paint in `ui/tour.js`; verified in headless Chromium
  (15/15 checks, including not-offered-twice and the walk closing on
  'done'). 341/341 tests pass.
- 2026-10-06 — `e`: decomposed the next three PRD enhancements. E19 — the
  solar system tier: SBDB is ingested, baked and verifiable on the Python side
  but no tile ships and nothing renders it, so a visitor can fly to 500 Mpc
  and never see Ceres. E20 — the 100,000-star success criterion: the shipped
  tile carries 60,000 and the reachable Gaia mirror caps near 62,723, so the
  claim gets measured against or withdrawn, not hoped for. E21 — T2 galactic
  structure: only procedural nebulosity exists; the Planck/HI density sources
  the research names have never been probed from this host.
- 2026-10-06 — `n` (E16): the first-run drive — `scripts/first-run.py`,
  Playwright in headless Chromium (SwiftShader) — walks the visitor path
  cold: land, tour, onboarding, `j` journey, `sirius` search, star click,
  event click, export, cold link, `r` outward flight. It found four
  integration bugs no unit test could see, all fixed: (1) `shareView` was
  gated on free flight, so a visitor on a route — the default state — never
  got a shareable URL; it is ungated now, with a settle/1 s throttle so a
  flying sky does not churn the URL every frame. (2) The export modeled
  "what is on screen" as a count — a prefix of one tile, ignoring the LOD
  stride, double-counting levels — and exported all 1,440 planets when 0
  stars were drawn; it now walks the exact drawn selection per tile
  (stride/drawCount) and exports a planet only when its host is drawn
  (drive: 3,000 measured stars + 72 of their planets, the file matches the
  counter to the row). (3) The integrity sampler carried the same
  count-prefix lie; it walks the same selection now, with a test that proves
  it follows the stride rather than the tile prefix. (4) Deep links rounded
  the position to four decimals of a parsec — up to 10 AU — so a cold page
  landed 1.2e12 m from the shared place; links now carry metres at full
  precision (`String()` round-trips a double exactly) and the place survives
  to 0 m. The drive also records what the software profile really is: the
  frame budget defers the modelled tier (fps 1 against the 20 ms tier
  budget) — a receipt with its evidence, not a silent pass and not a false
  failure. 349/349 node tests; the drive passes with zero console and page
  errors; the report lives in `docs/perf/first-run.json`.
- 2026-10-06 — E22 planned: the known-bodies menu. The
  user asked for a HUD menu of planets, satellites, comets,
  galaxies, black holes; the atlas holds a cited catalogue
  for none of those six kinds (small bodies are ingested but
  not shipped — E19). So the plan is catalogue-first:
  `plans/celestial-menu.md` with five sub-plans — 01 catalogue
  survey (a verdict with a receipt per kind: INGEST / HELD /
  NOT-REACHABLE), 02 ingestion (bricks, tiles, verifiers),
  03 render primitives (one layer per kind, each
  budget-deferrable and pickable), 04 the HUD menu (a pure
  view model over loaded datasets), 05 flight and fact cards
  (a pick flies and opens a cited card, or says why it
  cannot). The governing rule: the menu is a projection of
  what is loaded and cited — a kind with no dataset says so,
  with the reason. Added to the roadmap as E22.
- 2026-10-06 — `n` #35 (E17): every shipped asset now verifies against its
  source — `ingest/verify_assets.py` (+ `verify_hipparcos.py`,
  `verify_relations.py`) re-runs each asset's own query and resolves every row
  back to it. Live run, 6/6 assets, exit 0: landmarks 3/3, nearby 2000/2000
  (every parallax ≥ 1 mas), figure-stars 8726/8726 (every star has a parallax
  and V < 6.5), binaries 2885/2885 (primaries 1533 Hipparcos + 1352 Gaia
  tile; secondaries 153 Hipparcos + 2732 Gaia tile; 2047/2047 distinct WDS
  designations resolve against B/wds/wds), constellations 89/89 (both Serpens
  halves), exoplanets 2345/2345 within 200 pc — the archive has not moved
  since 2026-10-04. Four findings on the way: (1) VizieR's asu-tsv endpoint is
  dead server-side (every query, even for other catalogues, returns "No
  catalogue or table was specified or found") — `ingest/sources/landmarks.py`
  moved to VizieR TAP ADQL, the route the other sources already use, and the
  asset regenerated byte-identical apart from its citation; (2) TAP ADQL reads
  a bare `_RA.icrs` as a table qualifier and rejects `B-V` next to a quoted
  dotted column — both must be quoted; (3) RAICRS ≠ `_RA.icrs` (Hipparcos
  epoch J1991.25 vs VizieR's J2000 ICRS, up to 65″ apart), so landmarks and
  nearby verify against `_RA.icrs` while figure-stars verify against RAICRS;
  (4) three bugs in the verifier itself, found by its first run: `primary_hip`
  is a Gaia reference in 1352 of 2885 pairs (not an int), d3-celestial
  carries two "Ser" figures (Caput and Cauda) so a dict index compares the
  wrong one, and `f"{catalogue}_{end}s"` pluralized to "primarys". The
  plan's exoplanet row was stale (1,440 planets on 3,080 cards — the asset
  holds 2,345 planets on 1,652 systems) and missed `binaries.json` as the
  sixth asset; both corrected.
- 2026-10-07 — `n` #36 (E18): re-measure, or stop claiming —
  `scripts/remeasure.py` (+ `scripts/remeasure_probe.py`) reports
  frame rate, tier cost, parse cost and cold start, each with the
  machine and the conditions it was measured under, to
  `docs/perf/remeasure.json`. Live run on this host (SwiftShader,
  WebGL2, 1280×800): cold start 0.5 s (criterion <5 s — met);
  route 3.3 fps median, worst frame 1.1 s, 0 stalls (60 fps is the
  GPU-host criterion; the software budget of 4 fps is met at the
  median, missed at p95); parse 0.1 ms and build 22 ms for
  884,736 bytes (recorded 0.1/25.8 ms — parse exact, build within
  15 %); tier cost **not measurable on this machine**: the software
  renderer held 93 frames in 20 s parked at 1 AU but 0 and 1
  frames in the same windows parked at 5 Mpc, the tier's
  visibility band. The diagnosis, with evidence: the far-field
  scene beyond ~1 Mpc takes seconds per frame under SwiftShader — a
  parked page's rAF chain stops ~0.75 s in (the app's loop and an
  independent counter die at the same millisecond; no exception, no
  crash, no reload; timers and visibilityState fine), the GPU
  process saturates (~4.6 cores), 1 AU and 326 pc render fine (26
  and 40 frames/6 s) while 32.6 kpc and 100 kpc collapse (2
  frames/6 s); 3.2 pc is slow for a different reason (72,219 stars
  drawn, 5 frames/6 s). All three recorded claims corrected with
  the re-measured numbers, their conditions and a pointer to the
  JSON: `plans/phase-1/05-large-scale.md` (the 60.0 fps A/B and
  the 0.01 ms tier cost stand as GPU-host measurements),
  `plans/phase-1.md` (exit criteria), `docs/prd/universe-3d.md`
  (success criteria). 349 node tests unchanged.
- 2026-10-07 — `n` #37 (E19): the solar system tier ships. `ingest`
  bakes the SBDB tile (500 bodies, AU-quantized — parsec
  quantization would collapse the belt to one point) plus a
  sidecar the fact card reads (names, diameters, H, and the
  orbital epoch each position is valid for); `astro/orbits.py`
  gains a Julian-date converter. The web side loads the tile
  as its own layer (flat amber — bodies shine by reflected
  sunlight, so no blackbody ramp), picks it in screen space,
  and the search index merges the 500 bodies (a name or an
  spkid — "ceres" or "20000001" both fly). The card learns a
  `small_body` kind whose honesty row is the orbital epoch,
  and solar-system light travel reads in minutes (Ceres: 23
  min ago) instead of rounding to "0.0 yr". Proven live in a
  headless browser: 500 rendered, a deep link restores Ceres
  by id, a click picks a body, search flies, the card names
  spkid sbdb:20000001 and epoch 2026-06-09. The verifier's
  SBDB path covers the shipped tile (500/500 against live
  SBDB) and the asset verifier covers the sidecar — 7/7
  assets resolve. 361/361 node tests.

- 2026-10-07 — `n` #38 (E22/02): the five catalogues
  bake and verify. Planets and satellites come from
  JPL Horizons as geocentric apparent positions at a
  stated epoch (the OBSERVER ephemeris: RA/Dec ICRF,
  range and APmag in one call; the physical-data
  block parses in all three of its published formats,
  so radius, V(1,0), albedo and mass ride on every
  record). Comets are the SBDB comet query filtered
  to bound orbits (1,769 of the 4,077 the API
  counts). Galaxies are RC3's 10,618 redshift rows,
  distance derived by the Hubble law with H0 = 70
  stated on the record. Black holes are
  Corral-Santana's 33 distance rows joined to the 17
  dynamical masses, limit flags and asymmetric errors
  intact. Every tile carries its dataset kind in its
  header, the manifest lifts it, and the boot loop
  dispatches on it — a kind the renderer has no
  primitive for is not drawn as something it is not.
  The SBDB brick now computes geocentric directions
  too: the old heliocentric direction put a nearby
  body up to ~24 degrees from its true sky position,
  so the small-body tile was re-baked and the search
  index re-merged. Two defects the verifier caught:
  the tile format's 16-bit milli-mag bound clamps
  Pluto's 35.4 (the sidecar now carries the true
  apmag, the verifier compares against the clamp),
  and the RC3 PGC column arrives in two formats
  (`PGC11752` and `PGC 9735`), which broke id
  matching until the normalization stripped the
  space. All 8 tiles round-trip against their live
  sources, all 12 shipped assets resolve (5 new
  sidecar checks), 361/361 node tests, and a
  headless-browser smoke proves the boot survives
  the wider manifest with the small-body tier
  intact. The 256-LOC rule holds: cli_fetch,
  tiles_codec, verify_sidecars and verify_report
  split out of the three files that crossed it.