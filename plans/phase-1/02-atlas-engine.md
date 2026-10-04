# Sub-plan 02 — Atlas Engine

**Goal:** a renderer that spans 1 m → ~500 Mpc at 60 fps with hundreds of thousands of points.

**Engine: three.js `WebGPURenderer`**, which falls back to WebGL 2 automatically on older hardware.
Decided by grill, 2026-10-04. Sub-plans 03–05 talk to the interfaces below, never to the library.

## The actual hard problem

One float32 frame of reference cannot represent a solar-system planet and a galaxy. The engine must
solve scale without the camera ever visibly snapping.

## Interfaces (stable regardless of engine)

- `CameraRig` — position in parsecs; exposes `travelTo(target, arc)`, `setScaleRange()`.
- `SceneGraph` — nested scale cells, each with a local origin; only the active cell carries full
  precision.
- `Layer` — `load(tile)`, `update(camera, budget)`, `draw()`. Every visual element is a layer.
- `LodTree` — octree over baked tiles, frustum + distance culling, budgeted per frame.
- `DepthModel` — logarithmic depth so 1 m and 1 Gpc coexist in one depth buffer.

## Tasks

- [x] Camera rig with exponential travel and constant angular rate across scale changes —
  `web/src/core/camera-rig.js`. Travel interpolates distance geometrically and direction as unit
  vectors; sweep rate holds at 6.83 rad/s with a spread of 4.4e-4 over 25 decades.
- [x] Floating origin; render space stays under 9.9e6 m at every scale, so float32 never loses its
  integral part — `web/src/core/floating-origin.js`.
- [x] Depth: contiguous scale bands, not one buffer. A single 29-decade range leaves 595 km per
  depth step at 1 AU; banded leaves 41 km, and 1.2 mm at 1 km — `web/src/core/depth-model.js`.
- [x] Octree LOD: `web/src/core/lod-tree.js` builds from tile bounds and magnitude range alone,
  culls by view pyramid, by forward test and by distance, then spends the point budget on the tiles
  covering the most sky. Brightness is physical: a star baked at magnitude G from Earth shows as
  G + 5·log₁₀(d/d₀) elsewhere. On the real baked tile: 3000 points at full brightness from the Sun,
  culled entirely from 50 kpc, and a 500-point budget honoured exactly.
- [x] Point rendering with additive blending, verified in a browser — `web/src/render/`:
  12,219 Gaia stars drawn as screen-space points sized and brightened from magnitude. Measured
  under SwiftShader software rendering at ~9–12 fps; that is a floor, not a GPU number. Points
  rebased whenever the floating origin moves, and near/far bracket the visible content.
- [x] Frame budget controller: `web/src/core/frame-budget.js`. Slow frames cut the point budget
  fast, fast frames restore it slowly, so the atlas thins before it stutters and never breathes.
  Verified live in a headless browser with a 60,000-star tile: 11 drops from 120,000 to the 3,000
  floor, frame time 95.8 ms → 74.2 ms as the load fell.
- [x] Post chain: bloom, with the void held at `#05060a` — `web/src/render/post.js`. Measured in a
  browser: bright cores 101 → 172 pixels, halo band 1666 → 2072, void median exactly `[5,6,10]` with
  the chain on and off. ACES was tried and removed: the scene pass is already display-encoded, so
  tone mapping darkened every star (92 bright pixels → 0). It returns when the scene carries HDR.
- [ ] `[TODO]` Deterministic camera path format so a cinematic route is data, not code.
- [ ] `[TODO]` Performance harness: fixed route, per-frame timings, CI-checkable budget.

## Acceptance

- 100 000 real stars at 60 fps on a mid-range laptop GPU.
- Continuous flight Earth orbit → 100 kpc with no stall and no visible precision pop.
- Frame budget holds when LOD is throttled: dropping stars must be smooth, not stuttering.

## Performance anchor

SpaceEngine reports ~300 000 stars across ~100 VBOs as acceptable. Targets here are in that class,
not in the billions; the billions arrive as LOD tiles, never as individual points.