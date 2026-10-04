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