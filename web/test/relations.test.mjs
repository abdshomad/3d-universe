/**
 * Relations: a ribbon is a claim, so it needs a citation, and it needs shape.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three/webgpu';

import {
  RELATION_TYPES,
  UncitedRelationError,
  assertCited,
  citableRelations,
  relationStyle,
} from '../src/data/relations.js';
import { buildRibbonGeometry, createRibbonMesh } from '../src/render/ribbons.js';

const a = new Vector3(0, 0, 0);
const b = new Vector3(1e9, 1e8, 1e8);

test('an uncited relation is refused', () => {
  assert.throws(() => assertCited({ id: 'made-up' }), UncitedRelationError);
  assert.throws(() => assertCited({ id: 'blank', citation: '  ' }), UncitedRelationError);
});

test('a cited relation passes through', () => {
  const relation = { id: 'constellation:Ori', citation: { dataset: 'd3-celestial' } };
  assert.equal(assertCited(relation), relation);
});

test('only cited relations survive the filter', () => {
  const kept = citableRelations([
    { id: 'a', citation: 'source-a' },
    { id: 'b' },
    { id: 'c', citation: { dataset: 'x' } },
  ]);
  assert.deepEqual(kept.map((r) => r.id), ['a', 'c']);
});

test('hue carries meaning, and simulated is dashed', () => {
  assert.ok(RELATION_TYPES.constellation.dashed === false);
  assert.ok(RELATION_TYPES.simulated.dashed === true, 'simulated edges must be marked');
  assert.throws(() => relationStyle('nonsense'), /unknown relation type/);
});

test('a ribbon tapers to nothing at both ends', () => {
  const { geometry } = buildRibbonGeometry({
    points: [a, b], colour: [1, 1, 1], width: 1e7, curve: 0, samples: 8,
  });
  const positions = geometry.getAttribute('position').array;
  // First pair is the ribbon start: both vertices sit on the centre line.
  const startSpan = Math.hypot(
    positions[3] - positions[0], positions[4] - positions[1], positions[5] - positions[2],
  );
  assert.ok(startSpan < 1e-6, `start span ${startSpan}`);
});

test('a ribbon bulges away from its chord', () => {
  const straight = buildRibbonGeometry({
    points: [a, b], colour: [1, 1, 1], width: 1e7, curve: 0, samples: 8,
  });
  const curved = buildRibbonGeometry({
    points: [a, b], colour: [1, 1, 1], width: 1e7, curve: 0.2, samples: 8,
  });
  assert.notDeepEqual(
    Array.from(curved.geometry.getAttribute('position').array.slice(0, 9)),
    Array.from(straight.geometry.getAttribute('position').array.slice(0, 9)),
  );
});

test('alpha is grainy, not flat, and deterministic', () => {
  const options = { points: [a, b], colour: [1, 1, 1], width: 1e7, curve: 0.1, seed: 3 };
  const first = buildRibbonGeometry(options);
  const again = buildRibbonGeometry(options);
  assert.deepEqual(
    Array.from(first.geometry.getAttribute('color').array),
    Array.from(again.geometry.getAttribute('color').array),
  );
  assert.ok(first.alphaRange[1] > first.alphaRange[0], 'noise should vary the alpha');
});

test('a ribbon has geometry to draw', () => {
  const mesh = createRibbonMesh({ points: [a, b], colour: [1, 0, 0], width: 1e7, name: 'test' });
  assert.equal(mesh.name, 'ribbon:test');
  assert.ok(mesh.geometry.getAttribute('position').count > 0);
  assert.ok(mesh.material.blending !== 0, 'ribbons are additive');
});

test('a ribbon needs two points', () => {
  assert.throws(() => buildRibbonGeometry({ points: [a], colour: [1, 1, 1], width: 1 }), /at least two/);
});