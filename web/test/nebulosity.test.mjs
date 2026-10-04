/**
 * Nebulosity: deterministic, bounded, and not a uniform wash.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createNebulosity } from '../src/render/nebulosity.js';

const attributeArray = (layer, name) => layer.geometry.getAttribute(name).array;

test('the same seed builds the same cloud', () => {
  const a = createNebulosity({ radiusMetres: 1e15, count: 800, seed: 5 });
  const b = createNebulosity({ radiusMetres: 1e15, count: 800, seed: 5 });
  assert.deepEqual(Array.from(attributeArray(a, 'position')), Array.from(attributeArray(b, 'position')));
  assert.deepEqual(Array.from(attributeArray(a, 'size')), Array.from(attributeArray(b, 'size')));
});

test('a different seed builds a different cloud', () => {
  const a = createNebulosity({ radiusMetres: 1e15, count: 800, seed: 5 });
  const b = createNebulosity({ radiusMetres: 1e15, count: 800, seed: 6 });
  assert.notDeepEqual(Array.from(attributeArray(a, 'position')), Array.from(attributeArray(b, 'position')));
});

test('blobs stay inside the cloud and none sit exactly at the centre', () => {
  const layer = createNebulosity({ radiusMetres: 1e15, count: 1500, seed: 9 });
  const positions = attributeArray(layer, 'position');
  assert.ok(positions.length > 0, 'the cloud drew nothing at all');
  for (let i = 0; i < positions.length; i += 3) {
    const distance = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
    assert.ok(distance <= 1e15 + 1, `blob at ${distance}`);
    assert.ok(distance > 0, 'a blob sitting on the camera');
  }
});

test('faint regions draw nothing, so the medium has holes', () => {
  const layer = createNebulosity({ radiusMetres: 1e15, count: 4000, seed: 11 });
  assert.ok(layer.userData.kept < layer.userData.considered, 'nothing was culled');
  assert.ok(layer.userData.kept > 0, 'everything was culled');
});

test('brightness and size stay in range', () => {
  const layer = createNebulosity({ radiusMetres: 1e15, count: 2000, seed: 13, gain: 0.1 });
  for (const value of attributeArray(layer, 'color')) {
    assert.ok(value >= 0 && value <= 0.1, `colour ${value}`);
  }
  for (const value of attributeArray(layer, 'size')) {
    assert.ok(value >= 1.6 && value <= 7.0, `size ${value}`);
  }
});

test('the camera offset shifts the whole cloud, it does not distort it', () => {
  // Small radii on purpose: render-space coordinates are float32, and at 1e15 m
  // a kilometre of camera movement is below the precision of the buffer.
  const plain = createNebulosity({ radiusMetres: 1e9, count: 600, seed: 17 });
  const shifted = createNebulosity({
    radiusMetres: 1e9, count: 600, seed: 17, cameraMetres: [1e6, 0, 0],
  });
  const a = attributeArray(plain, 'position');
  const b = attributeArray(shifted, 'position');
  for (let i = 0; i < a.length; i += 3) {
    assert.ok(Math.abs((a[i] - b[i]) - 1e6) < 1e3, `x shifted by ${a[i] - b[i]}`);
  }
});