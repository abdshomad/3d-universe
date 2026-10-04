/**
 * Search: narrow on purpose, and every result has somewhere to fly to.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { SearchIndex, entryDirection, flightPathTo } from '../src/core/search.js';

const ENTRIES = [
  { id: 'hip:71683', hip: 71683, name: 'Alpha Centauri A', ra_deg: 219.9, dec_deg: -60.8, distance_pc: 1.347, visual_magnitude: -0.01 },
  { id: 'hip:87937', hip: 87937, name: "Barnard's Star", ra_deg: 269.45, dec_deg: 4.69, distance_pc: 1.821, visual_magnitude: 9.54 },
  { id: 'hip:32349', hip: 32349, name: 'Sirius', ra_deg: 101.29, dec_deg: -16.72, distance_pc: 2.637, visual_magnitude: -1.44 },
  { id: 'hip:70890', hip: 70890, name: null, ra_deg: 5.6, dec_deg: -45.0, distance_pc: 1.295, visual_magnitude: 11.01 },
];

const index = new SearchIndex(ENTRIES);

test('a name finds its star', () => {
  const best = index.best('Sirius');
  assert.equal(best.hip, 32349);
  assert.equal(best.distance_pc, 2.637);
});

test('names are matched case-insensitively and partially', () => {
  assert.equal(index.best('sirius').hip, 32349);
  assert.equal(index.best('centauri').hip, 71683);
  assert.equal(index.best("Barnard").hip, 87937);
});

test('a catalogue number finds the same star as its name', () => {
  assert.equal(index.byNumber('32349').hip, 32349);
  assert.equal(index.byNumber('HIP 32349').hip, 32349);
  assert.equal(index.byNumber('hip 71683').name, 'Alpha Centauri A');
  assert.equal(index.byNumber('99999999'), null);
  assert.deepEqual(index.best('32349').id, index.best('Sirius').id);
});

test('results are ranked by how well they match, then brightness', () => {
  const results = index.query('a');
  assert.ok(results.length > 1);
  const ranked = index.query('siri');
  assert.equal(ranked[0].hip, 32349);
});

test('a bare number resolves by catalogue id, never as a name', () => {
  assert.equal(index.query('70890')[0].hip, 70890, 'numbers are looked up as HIP');
  assert.equal(index.query('70890')[0].name, null, 'and an unnamed star stays unnamed');
  assert.ok(!index.query('hip').some((entry) => entry.hip === 70890),
    'an unnamed star never appears in name results');
});

test('nothing typed means nothing found', () => {
  assert.deepEqual(index.query(''), []);
  assert.deepEqual(index.query('   '), []);
  assert.equal(index.best('zzz'), null);
});

test('the named roll call is available', () => {
  assert.equal(index.named().length, 3);
  assert.equal(index.size, 4);
});

test('a flight path reaches the entry, and works inward too', () => {
  const outward = flightPathTo(index.byNumber('32349'), { fromPc: 0.01 });
  assert.deepEqual(outward.names(), ['here', 'Sirius']);
  assert.ok(Math.abs(outward.waypoints[1].radiusPc - 2.637) < 1e-9);

  const inward = flightPathTo(index.byNumber('70890'), { fromPc: 1000 });
  assert.equal(inward.names()[1], 'HIP 70890', 'a nearby star can be flown to from far away');
});

test('a flight needs a destination with a distance', () => {
  assert.throws(() => flightPathTo({ hip: 1, name: 'Nowhere', ra_deg: 0, dec_deg: 0 }), /without a distance/);
});

test('an entry has a direction to look at', () => {
  const direction = entryDirection(index.byNumber('32349'));
  assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-12);
});
