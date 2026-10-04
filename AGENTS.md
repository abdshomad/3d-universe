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