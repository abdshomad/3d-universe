/**
 * Camera paths: a film must not drift while you watch it.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { CameraPath, polarToCartesian } from '../src/core/camera-path.js';
import { METRES_PER_PC, metresToPc } from '../src/core/units.js';

const route = () => new CameraPath([
  { name: 'sol', radiusPc: 1, bearingDeg: 0, segmentSeconds: 4, holdSeconds: 2 },
  { name: 'near', radiusPc: 100, bearingDeg: 90, segmentSeconds: 6, holdSeconds: 2 },
  { name: 'far', radiusPc: 10000, bearingDeg: 180, segmentSeconds: 8, holdSeconds: 0 },
]);

const radiusAt = (path, seconds) => metresToPc(Math.hypot(...path.sample(seconds).positionMetres));

test('the same moment always gives the same position', () => {
  const path = route();
  const a = path.sample(7.25);
  const b = path.sample(7.25);
  assert.deepEqual(a.positionMetres, b.positionMetres);
  assert.equal(a.name, b.name);
});

test('radius interpolates geometrically, not linearly', () => {
  const path = new CameraPath([
    { name: 'a', radiusPc: 1, segmentSeconds: 10, holdSeconds: 0 },
    { name: 'b', radiusPc: 100, segmentSeconds: 10, holdSeconds: 0 },
  ]);
  // Exponential easing is not halfway at the halfway point, but it is strictly
  // between the endpoints and never overshoots.
  const mid = radiusAt(path, 5);
  assert.ok(mid > 1 && mid < 100, `mid radius ${mid}`);
  assert.notEqual(mid, 50, 'a linear interpolation would land exactly here');
});

test('radius only ever grows', () => {
  const path = route();
  let previous = 0;
  for (let t = 0; t <= path.durationSeconds; t += 0.25) {
    const radius = radiusAt(path, t);
    assert.ok(radius >= previous - 1e-9, `radius fell at ${t}s`);
    previous = radius;
  }
});

test('a hold parks the camera exactly on its waypoint', () => {
  const path = route();
  const sample = path.sample(5.5); // inside the hold after the first segment
  assert.equal(sample.holding, true);
  assert.ok(Math.abs(metresToPc(Math.hypot(...sample.positionMetres)) - 100) < 1e-6);
});

test('the route arrives at its final radius', () => {
  const path = route();
  const end = path.sample(path.durationSeconds + 10);
  assert.equal(end.name, 'far');
  assert.ok(Math.abs(metresToPc(Math.hypot(...end.positionMetres)) - 10000) < 1e-3);
});

test('bearings take the shortest arc', () => {
  const path = new CameraPath([
    { name: 'a', radiusPc: 1, bearingDeg: 350, segmentSeconds: 10, holdSeconds: 0 },
    { name: 'b', radiusPc: 10, bearingDeg: 10, segmentSeconds: 10, holdSeconds: 0 },
  ]);
  // Easing is exponential, so the halfway moment is still early in the sweep:
  // the check is which way round it goes, not where it is at t=5.
  const approaching = path.sample(9.9).bearingDeg;
  assert.ok(approaching > 5 && approaching < 10.1, `crossed the long way: ${approaching}`);
  assert.equal(path.sample(0).bearingDeg, 350);
  assert.equal(path.sample(10).bearingDeg, 10);
});

test('duration counts segments and holds', () => {
  // Segments and the holds that follow them; the last waypoint has no segment
  // after it, so its duration is ignored.
  assert.equal(route().durationSeconds, 4 + 2 + 6);
});

test('polar to cartesian puts the camera on the requested bearing', () => {
  const [x, , z] = polarToCartesian(2, 90);
  const radius = 2 * METRES_PER_PC;
  assert.ok(Math.abs(x) / radius < 1e-12);
  assert.ok(Math.abs(z - radius) / radius < 1e-12);
});

test('nonsense routes are refused', () => {
  assert.throws(() => new CameraPath([]), /at least two/);
  assert.throws(
    () => new CameraPath([
      { name: 'a', radiusPc: 10 },
      { name: 'b', radiusPc: 1 },
    ]),
    /further out/,
  );
  assert.throws(() => new CameraPath([{ radiusPc: -1 }, { radiusPc: 2 }]), /unusable radius/);
  assert.throws(() => route().sample(-1), /negative/);
});