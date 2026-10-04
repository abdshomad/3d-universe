/**
 * Noise: deterministic, continuous, and actually noisy.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { fbm3, hash3, mulberry32, valueNoise3 } from '../src/core/noise.js';

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const variance = (values) => {
  const m = mean(values);
  return mean(values.map((value) => (value - m) ** 2));
};

test('hashing is stable and bounded', () => {
  const first = hash3(3, -7, 11, 42);
  assert.equal(first, hash3(3, -7, 11, 42));
  assert.ok(first >= 0 && first < 1);
  assert.notEqual(first, hash3(4, -7, 11, 42));
});

test('value noise is continuous across a lattice boundary', () => {
  const before = valueNoise3(0.999, 0.5, 0.5);
  const after = valueNoise3(1.001, 0.5, 0.5);
  assert.ok(Math.abs(before - after) < 0.02, `jumped by ${Math.abs(before - after)}`);
});

test('value noise is roughly centred and spread', () => {
  const values = [];
  for (let i = 0; i < 400; i += 1) {
    values.push(valueNoise3(i * 0.37, i * 0.11, i * 0.53, 7));
  }
  assert.ok(mean(values) > 0.35 && mean(values) < 0.65, `mean ${mean(values)}`);
  assert.ok(variance(values) > 0.01, `variance ${variance(values)}`);
});

test('fractal noise stays in range and varies with position', () => {
  const values = [];
  for (let i = 0; i < 200; i += 1) values.push(fbm3(i * 0.21, i * 0.07, i * 0.13, { seed: 3 }));
  assert.ok(values.every((value) => value >= 0 && value <= 1));
  assert.ok(variance(values) > 0.005, 'fbm should not be flat');
  assert.equal(fbm3(1.5, 2.5, 3.5, { seed: 3 }), fbm3(1.5, 2.5, 3.5, { seed: 3 }));
});

test('different seeds give different fields', () => {
  assert.notEqual(fbm3(1, 2, 3, { seed: 1 }), fbm3(1, 2, 3, { seed: 2 }));
});

test('the seeded stream is reproducible', () => {
  const first = Array.from({ length: 5 }, mulberry32(99));
  const again = Array.from({ length: 5 }, mulberry32(99));
  const other = Array.from({ length: 5 }, mulberry32(100));
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, other);
  assert.ok(first.every((value) => value >= 0 && value < 1));
});