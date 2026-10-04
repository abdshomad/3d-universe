/**
 * Star dust: two layers, a fixed sky, and an honest flag.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { DUST_LAYERS, UNRESOLVED, createStarDust } from '../src/render/star-dust.js';

const sizes = (layer) => layer.geometry.getAttribute('size').array;
const positions = (layer) => layer.geometry.getAttribute('position').array;
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

test('a shell of dust comes back as two layers', () => {
  const layers = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 1000 });
  assert.equal(layers.length, 2);
  assert.deepEqual(layers.map((l) => l.userData.layer), ['far', 'near']);
  assert.ok(layers[0].userData.pointCount > layers[1].userData.pointCount, 'far layer is denser');
});

test('dust is labelled unresolved, never measured', () => {
  const [far] = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 400 });
  assert.equal(far.userData.provenance, UNRESOLVED);
});

test('the same seed gives the same sky', () => {
  const a = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 500, seed: 4 });
  const b = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 500, seed: 4 });
  assert.deepEqual(Array.from(positions(a[0])), Array.from(positions(b[0])));
});

test('a different seed gives a different sky', () => {
  const a = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 500, seed: 4 });
  const b = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 500, seed: 5 });
  assert.notDeepEqual(Array.from(positions(a[0])), Array.from(positions(b[0])));
});

test('dust stays inside the shell and outside the inner radius', () => {
  const [far, near] = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 1200 });
  for (const layer of [far, near]) {
    const buffer = positions(layer);
    for (let i = 0; i < buffer.length; i += 3) {
      const radius = Math.hypot(buffer[i], buffer[i + 1], buffer[i + 2]);
      assert.ok(radius >= 1e6 && radius <= 1e9 + 1, `grain at ${radius}`);
    }
  }
});

test('the near layer is visibly coarser than the far one', () => {
  const [far, near] = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 2000 });
  assert.ok(mean(Array.from(sizes(near))) > 2 * mean(Array.from(sizes(far))), 'near dust should read bigger');
});

test('the far layer stays at about one pixel', () => {
  const [far] = createStarDust({ innerRadiusMetres: 1e6, outerRadiusMetres: 1e9, count: 800 });
  for (const value of sizes(far)) {
    assert.ok(value >= 1.0 && value <= 1.4, `far grain size ${value}`);
  }
});

test('an inverted shell is refused', () => {
  assert.throws(
    () => createStarDust({ innerRadiusMetres: 1e9, outerRadiusMetres: 1e6 }),
    /must exceed/,
  );
});

test('the default layers are the ones the art direction asks for', () => {
  assert.equal(DUST_LAYERS.length, 2);
  assert.deepEqual(DUST_LAYERS.map((l) => l.name), ['far', 'near']);
});