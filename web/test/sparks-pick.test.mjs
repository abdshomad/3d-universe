/**
 * A vertex index is not an event index unless the layer says which is which.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createSparkLayers } from '../src/render/sparks.js';

const citation = { dataset: 'test events' };

function event(id, flux, distance_source = 'parallax') {
  return {
    id, kind: 'pulsar', flux_mjy: flux, distance_pc: 100, period_s: 0.1, distance_source,
  };
}

test('each vertex names the event it belongs to', () => {
  const events = [event('a', 10), event('b', 100), event('c', 1000)];
  const worldPositions = new Map(events.map((e, i) => [e.id, [i * 1e18, 0, 0]]));
  const [layer] = createSparkLayers({ events, worldPositions, citation });

  // Glyph sizes differ between measured and estimated distances, so the glyph
  // count is not a constant. What must hold is that every event drawn is named.
  const drawn = [...new Set(layer.userData.vertexEvent)];
  assert.equal(drawn.length, 3, 'three events, three names in the mapping');
  assert.deepEqual(
    drawn.map((index) => layer.userData.events[index].id),
    ['a', 'b', 'c'],
  );
});

test('an event with no position is not drawn and does not shift the mapping', () => {
  const events = [event('a', 10), event('unplaced', 10), event('b', 100)];
  const worldPositions = new Map([['a', [0, 0, 0]], ['b', [1e18, 0, 0]]]);
  const [layer] = createSparkLayers({ events, worldPositions, citation });

  const drawn = [...new Set(layer.userData.vertexEvent)];
  assert.equal(drawn.length, 2, 'only placeable events draw');
  assert.deepEqual(
    drawn.map((index) => layer.userData.events[index].id),
    ['a', 'b'],
    'and the second drawn event is b, not the skipped one',
  );
});

test('the layer carries the citation so a pick can refuse without one', () => {
  const events = [event('a', 10)];
  const worldPositions = new Map([['a', [0, 0, 0]]]);
  const [layer] = createSparkLayers({ events, worldPositions, citation });
  assert.equal(layer.userData.citation.dataset, 'test events');
  assert.equal(layer.userData.kind, 'pulsar');
});

test('a dispersion-measure distance draws hollow, a parallax one filled', () => {
  const events = [event('measured', 10, 'parallax'), event('estimated', 10, 'dispersion-measure')];
  const worldPositions = new Map(events.map((e, i) => [e.id, [i * 1e18, 0, 0]]));
  const [layer] = createSparkLayers({ events, worldPositions, citation });

  assert.equal(layer.userData.measured, 1);
  assert.equal(layer.userData.estimated, 1);
  // The signature of a ring is a vertex off both axes; a cross only ever has
  // one axis non-zero, so this distinguishes them without counting vertices.
  const positions = layer.geometry.attributes.position.array;
  const offAxis = (eventIndex) => {
    for (let i = 0; i < layer.userData.vertexEvent.length; i += 1) {
      if (layer.userData.vertexEvent[i] !== eventIndex) continue;
      const x = Math.abs(positions[3 * i]);
      const z = Math.abs(positions[3 * i + 2]);
      if (x > 1e-6 && z > 1e-6) return true;
    }
    return false;
  };
  assert.equal(offAxis(0), false, 'the parallax cross has no vertex off-axis');
  assert.equal(offAxis(1), true, 'the dispersion-measure ring does');
});
