/**
 * Engine checks for the camera rig, floating origin and depth model.
 *
 * These cover the properties a user would notice: a flight that lands where it
 * said, motion that feels the same at every scale, identical behaviour at 30 and
 * 144 fps, render coordinates that never overflow float32, and a depth scheme
 * that can still tell a planet from a background star.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { CameraRig, radius, travelRadius } from '../src/core/camera-rig.js';
import { DEPTH_STEPS, DepthBands, DepthModel } from '../src/core/depth-model.js';
import { FloatingOrigin } from '../src/core/floating-origin.js';
import { METRES_PER_AU, METRES_PER_PC } from '../src/core/units.js';

const FIVE_HUNDRED_MPC = 500 * 1e6 * METRES_PER_PC;
const FROM = [1, 0, 0];
const TO = [0, FIVE_HUNDRED_MPC, 0];

function fly(from, to, options = {}) {
  const { durationSeconds = 8, fps = 60, rig = null, origin = null } = options;
  const camera = rig ?? new CameraRig({ positionMetres: from });
  const originTracker = origin ?? new FloatingOrigin();
  camera.travelTo(to, { durationSeconds });
  const dt = 1 / fps;
  const samples = [];
  while (camera.isTravelling) {
    camera.update(dt);
    if (origin) origin.update(camera.positionMetres);
    samples.push({
      t: samples.length * dt,
      position: [...camera.positionMetres],
      render: origin ? origin.toRenderSpace(camera.positionMetres) : null,
      sweep: camera.sweepRate(),
      travelling: camera.isTravelling,
    });
  }
  return { camera, origin: originTracker, samples };
}

test('travel lands exactly on the target', () => {
  const { camera } = fly(FROM, TO);
  assert.ok(Math.abs(camera.positionMetres[1] - FIVE_HUNDRED_MPC) <= 1e-6);
});

test('sweep rate stays constant across 25 orders of magnitude', () => {
  const { samples } = fly(FROM, TO);
  const rates = samples.filter((s) => s.travelling && s.sweep > 0).map((s) => s.sweep);
  const spread = (Math.max(...rates) - Math.min(...rates)) / Math.max(...rates);
  assert.ok(spread < 0.02, `sweep rate spread ${spread}`);
});

test('travel grows geometrically: every frame multiplies radius identically', () => {
  const duration = 8;
  const fps = 60;
  const { samples } = fly(FROM, TO, { durationSeconds: duration, fps });
  const expected = Math.log(FIVE_HUNDRED_MPC / 1) / (duration * fps);
  const moving = samples.filter((s) => s.travelling);
  const steps = moving.slice(1).map((s, i) => Math.log(radius(s.position) / radius(moving[i].position)));
  const worst = Math.max(...steps.map((step) => Math.abs(step - expected) / expected));
  assert.ok(worst < 1e-9, `per-frame log growth varies by ${worst}`);
});

test('frame rate does not change the flight', () => {
  const duration = 6;
  const fps = 30;
  const startRadius = 1;
  const slow = fly(FROM, TO, { durationSeconds: duration, fps }).samples;
  const fast = fly(FROM, TO, { durationSeconds: duration, fps: 144 }).samples;
  const logGrowth = Math.log(FIVE_HUNDRED_MPC / startRadius);
  // Each sample lags the analytic curve by at most one frame of growth.
  const tolerance = Math.exp((logGrowth / (duration * fps)) * 1.01);
  for (const samples of [slow, fast]) {
    for (const sample of samples) {
      const u = Math.min(sample.t / duration, 1);
      const expected = travelRadius(startRadius, logGrowth, u);
      const ratio = radius(sample.position) / expected;
      assert.ok(
        ratio <= tolerance && ratio >= 1 / tolerance,
        `at t=${sample.t} radius drifted by ${ratio}x`,
      );
    }
  }
});

test('rotation is a constant angular rate at any scale', () => {
  const near = new CameraRig({ positionMetres: [1, 0, 0] }).autoDrift(0.01);
  const far = new CameraRig({ positionMetres: [0, FIVE_HUNDRED_MPC, 0] }).autoDrift(0.01);
  for (let i = 0; i < 120; i += 1) {
    near.update(1 / 60);
    far.update(1 / 60);
  }
  assert.ok(Math.abs(near.yaw - far.yaw) < 1e-12);
  assert.ok(Math.abs(near.yaw - 0.01 * 2) < 1e-12);
});

test('floating origin keeps render space float32-safe over the whole flight', () => {
  const origin = new FloatingOrigin();
  const { samples } = fly(FROM, TO, { fps: 60, origin });
  const worst = Math.max(...samples.map((s) => Math.max(...s.render.map(Math.abs))));
  assert.ok(worst < 1e7, `render space reached ${worst} m`);
});

test('floating origin round-trips world positions exactly', () => {
  const origin = new FloatingOrigin();
  const rig = new CameraRig({ positionMetres: [0, 1e12, 0] });
  for (let i = 0; i < 200; i += 1) {
    rig.update(1 / 60);
    origin.update(rig.positionMetres);
  }
  const world = origin.toWorld(origin.toRenderSpace(rig.positionMetres));
  const error = Math.hypot(...world.map((v, axis) => v - rig.positionMetres[axis]));
  assert.ok(error < 1e-6, `round-trip error ${error} m`);
});

test('depth bands are contiguous and cover the full range', () => {
  const bands = new DepthBands();
  assert.equal(bands.nearMetres, 1e-3);
  assert.equal(bands.farMetres, 1e26);
  for (let i = 1; i < bands.bands.length; i += 1) {
    assert.equal(bands.bands[i].nearMetres, bands.bands[i - 1].farMetres);
  }
  for (let exponent = -3; exponent <= 26; exponent += 1) {
    const distance = 10 ** exponent;
    const index = bands.bandIndexFor(distance);
    const band = bands.bands[index];
    const isLast = index === bands.bands.length - 1;
    const inside = isLast ? distance <= band.farMetres : distance < band.farMetres;
    assert.ok(distance >= band.nearMetres && inside, `1e${exponent} landed in ${band.name}`);
  }
});

test('banded depth beats one 29-decade range by an order of magnitude', () => {
  const bands = new DepthBands();
  const single = new DepthModel({ nearMetres: 1e-3, farMetres: 1e26 });
  const banded = bands.resolutionAt(METRES_PER_AU);
  const unbounded = single.resolutionMetres(METRES_PER_AU, DEPTH_STEPS);
  assert.ok(banded * 10 < unbounded, `banded ${banded} m vs single ${unbounded} m at 1 AU`);
  assert.ok(banded < 6.371e6, `banded resolution ${banded} m cannot hold a planet at 1 AU`);
});

test('the surface band resolves metres at a kilometre out', () => {
  const bands = new DepthBands();
  const resolution = bands.resolutionAt(1e3);
  assert.ok(resolution < 0.1, `resolution ${resolution} m at 1 km`);
});

test('depth stays monotonic within every band', () => {
  const bands = new DepthBands();
  for (const band of bands.bands) {
    let previous = -1;
    for (let exponent = Math.log10(band.nearMetres); exponent < Math.log10(band.farMetres); exponent += 0.25) {
      const value = band.model.ndc(10 ** exponent);
      assert.ok(value > previous, `band ${band.name} is not monotonic at 1e${exponent}`);
      assert.ok(value >= 0 && value <= 1);
      previous = value;
    }
  }
});

test('depth mapping inverts', () => {
  const depth = new DepthModel({ nearMetres: 1e-3, farMetres: 1e26 });
  for (const metres of [1e-2, 1, METRES_PER_AU, METRES_PER_PC, 1e24]) {
    const roundTrip = depth.metresFromNdc(depth.ndc(metres));
    assert.ok(Math.abs(roundTrip - metres) / metres < 1e-9, `round trip failed at ${metres}`);
  }
});