/**
 * A vertex index is not an event index unless the layer says which is which.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createSparkLayers } from '../src/render/sparks.js';

const citation = { dataset: 'test events' };

function event(id, flux) {
  return { id, kind: 'pulsar', flux_mjy: flux, distance_pc: 100, period_s: 0.1 };
}

test('each vertex names the event it belongs to', () => {
  const events = [event('a', 10), event('b', 100), event('c', 1000)];
  const worldPositions = new Map(events.map((e, i) => [e.id, [i * 1e18, 0, 0]]));
  const [layer] = createSparkLayers({ events, worldPositions, citation });

  const glyphs = layer.userData.vertexEvent.length / 4; // four vertices per glyph
  assert.equal(glyphs, 3);
  assert.deepEqual(
    [0, 1, 2].map((g) => layer.userData.events[layer.userData.vertexEvent[g * 4]].id),
    ['a', 'b', 'c'],
  );
});

test('an event with no position is not drawn and does not shift the mapping', () => {
  const events = [event('a', 10), event('unplaced', 10), event('b', 100)];
  const worldPositions = new Map([['a', [0, 0, 0]], ['b', [1e18, 0, 0]]]);
  const [layer] = createSparkLayers({ events, worldPositions, citation });

  assert.equal(layer.userData.vertexEvent.length / 4, 2, 'only placeable events draw');
  assert.deepEqual(
    [0, 1].map((g) => layer.userData.events[layer.userData.vertexEvent[g * 4]].id),
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
