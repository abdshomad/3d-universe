/**
 * Camera angles: round-trip and the three.js sign convention.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { anglesFromDirection, directionFromAngles } from '../src/core/view.js';

const close = (a, b, tolerance = 1e-12) => Math.abs(a - b) <= tolerance;

test('yaw zero looks down -Z, the way a three.js camera is built', () => {
  const [x, y, z] = directionFromAngles(0, 0);
  assert.ok(close(x, 0) && close(y, 0) && close(z, -1));
});

test('pitch lifts the gaze upward', () => {
  const [, y] = directionFromAngles(0, Math.PI / 4);
  assert.ok(close(y, Math.SQRT1_2));
  assert.ok(directionFromAngles(0, -Math.PI / 4)[1] < 0);
});

test('aiming at a direction and reading the angles back agree', () => {
  for (const target of [[1, 0, 0], [0, 1, 0], [0, 0, -1], [-0.82, 0.57, 0], [0.3, -0.2, 0.9]]) {
    const { yaw, pitch } = anglesFromDirection(target);
    const round = directionFromAngles(yaw, pitch);
    const length = Math.hypot(...target);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(
        close(round[axis], target[axis] / length, 1e-9),
        `axis ${axis}: ${round[axis]} vs ${target[axis] / length}`,
      );
    }
  }
});

test('a direction of any length aims the same way', () => {
  const near = anglesFromDirection([1, 0, 0]);
  const far = anglesFromDirection([1e6, 0, 0]);
  assert.ok(close(near.yaw, far.yaw));
});

test('the zero vector cannot be aimed at', () => {
  assert.throws(() => anglesFromDirection([0, 0, 0]), /zero vector/);
});