/**
 * Spark markers: measured flux to visible size, and nothing drawn uncited.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EVENT_KINDS,
  createSparkLayers,
  eventStyle,
  sparkGlyphPoints,
  sparkSizeForFlux,
} from '../src/render/sparks.js';
import { UncitedRelationError } from '../src/data/relations.js';

test('a spark glyph is two crossing strokes', () => {
  const points = sparkGlyphPoints({ size: 2 });
  assert.equal(points.length, 4);
  assert.deepEqual(points[0], [-2, 0, 0]);
  assert.deepEqual(points[3], [0, 2, 0]);
});

test('glyph size follows measured flux, not taste', () => {
  const bright = sparkSizeForFlux(5000);
  const faint = sparkSizeForFlux(5);
  assert.ok(bright > faint, 'a brighter pulsar gets a bigger glyph');
  assert.ok(bright <= 7 && faint >= 2, 'sizes stay in range');
  assert.equal(sparkSizeForFlux(null), 2, 'an unknown flux draws the smallest mark');
});

test('each event kind has its own colour and label', () => {
  const colours = Object.values(EVENT_KINDS).map((kind) => kind.colour.join(','));
  assert.equal(new Set(colours).size, colours.length, 'no two kinds share a colour');
  assert.equal(eventStyle('pulsar').label, 'pulsar');
  assert.throws(() => eventStyle('meteor'), /unknown event kind/);
});

test('an uncited event is not drawn', () => {
  assert.throws(
    () => createSparkLayers({ events: [{ id: 'pulsar:J0000', kind: 'pulsar' }], worldPositions: new Map() }),
    UncitedRelationError,
  );
});

test('layers are built per kind, skipping events we cannot place', () => {
  const citation = { dataset: 'ATNF' };
  const events = [
    { id: 'pulsar:A', kind: 'pulsar', flux_mjy: 100, citation },
    { id: 'pulsar:B', kind: 'pulsar', flux_mjy: 10, citation },
    { id: 'pulsar:C', kind: 'pulsar', flux_mjy: 5000, citation },
  ];
  const worldPositions = new Map([
    ['pulsar:A', [1, 0, 0]],
    ['pulsar:B', [0, 1, 0]],
  ]);
  const layers = createSparkLayers({ events, worldPositions, citation });
  assert.equal(layers.length, 1);
  assert.equal(layers[0].userData.kind, 'pulsar');
  assert.equal(layers[0].userData.count, 3, 'three catalogued events');
  // Vertices per glyph vary with the distance source — a measured distance
  // draws a cross, an estimated one a ring — so count the glyphs, not the points.
  assert.equal(
    new Set(layers[0].userData.vertexEvent).size,
    2,
    'two placed events, and the unplaceable one drew nothing',
  );
});

test('distance provenance travels with the event', () => {
  const citation = { dataset: 'ATNF' };
  const dm = { id: 'pulsar:DM', kind: 'pulsar', flux_mjy: 5, distance_source: 'dispersion-measure', citation };
  const parallax = { id: 'pulsar:PL', kind: 'pulsar', flux_mjy: 5, distance_source: 'parallax', citation };
  const events = [dm, parallax];
  const layers = createSparkLayers({
    events,
    worldPositions: new Map([['pulsar:DM', [1, 0, 0]], ['pulsar:PL', [0, 1, 0]]]),
  });
  assert.equal(layers.length, 1);
  assert.equal(events[0].distance_source, 'dispersion-measure');
  assert.equal(events[1].distance_source, 'parallax');
});