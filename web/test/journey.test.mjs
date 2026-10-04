/**
 * Guided journeys: real places, in order, each with a measured distance.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { UnplacedLandmarkError, journeyFromLandmarks } from '../src/core/journey.js';
import { celestialDirection } from '../src/core/celestial.js';

const LANDMARKS = [
  { name: 'Alpha Centauri A', ra_deg: 219.9021, dec_deg: -60.834, distance_pc: 1.347 },
  { name: "Barnard's Star", ra_deg: 269.4519, dec_deg: 4.6936, distance_pc: 1.821 },
  { name: 'Sirius', ra_deg: 101.2872, dec_deg: -16.7161, distance_pc: 2.637 },
];

const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;

test('a journey visits every landmark, nearest first', () => {
  const journey = journeyFromLandmarks(LANDMARKS);
  assert.deepEqual(journey.names(), ['sol', 'Alpha Centauri A', "Barnard's Star", 'Sirius']);
});

test('each waypoint sits exactly on its measured distance', () => {
  const journey = journeyFromLandmarks(LANDMARKS);
  const radii = journey.waypoints.map((waypoint) => waypoint.radiusPc);
  for (let i = 1; i < radii.length; i += 1) {
    assert.ok(radii[i] > radii[i - 1], 'radii must increase for a path to exist');
  }
  assert.ok(close(radii[1], 1.347, 1e-9));
  assert.ok(close(radii[3], 2.637, 1e-9));
});

test('each leg looks at the destination, the last at itself', () => {
  const journey = journeyFromLandmarks(LANDMARKS);
  const sol = journey.waypoints[0];
  assert.deepEqual(sol.lookAtDeg, { ra: 219.9021, dec: -60.834 }, 'from the Sun, look at Alpha Cen');
  const sirius = journey.waypoints[journey.waypoints.length - 1];
  assert.deepEqual(sirius.lookAtDeg, { ra: 101.2872, dec: -16.7161 }, 'at Sirius, look at Sirius');
});

test('the sampled gaze points where the route is going', () => {
  const journey = journeyFromLandmarks(LANDMARKS, { segmentSeconds: 10 });
  const sample = journey.sample(0.5);
  const [x, y, z] = sample.lookDirection;
  const toward = [x, y, z];
  const expected = celestialDirection(219.9021, -60.834);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(Math.abs(toward[axis] - expected[axis]) < 1e-9);
  }
});

test('a landmark without a measured distance is refused', () => {
  assert.throws(
    () => journeyFromLandmarks([{ name: 'Somewhere', ra_deg: 0, dec_deg: 0 }]),
    UnplacedLandmarkError,
  );
  assert.throws(
    () => journeyFromLandmarks([{ name: 'Nowhere', ra_deg: 0, dec_deg: 0, distance_pc: 0 }]),
    UnplacedLandmarkError,
  );
});

test('an empty journey is refused', () => {
  assert.throws(() => journeyFromLandmarks([]), /at least one/);
});

test('landmarks are sorted even when handed over out of order', () => {
  const journey = journeyFromLandmarks([LANDMARKS[2], LANDMARKS[0], LANDMARKS[1]]);
  assert.deepEqual(journey.names(), ['sol', 'Alpha Centauri A', "Barnard's Star", 'Sirius']);
});