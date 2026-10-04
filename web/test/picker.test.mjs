/**
 * A click must resolve to the same identity a typed name would.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { identityAt, isClick, pickFromHits } from '../src/core/picker.js';

/** A tile whose geometry a test can predict: origin 0, 100 pc extent, unit pc. */
function tile(overrides = {}) {
  const count = overrides.count ?? 2;
  return {
    header: {
      tile_id: 'test-tile',
      unit: 'pc',
      origin: [0, 0, 0],
      extent: [100, 100, 100],
      provenance: { catalog: 'esa.gaia', release: 'DR3' },
    },
    ids: overrides.ids ?? [42, 43],
    // Star 0 sits at the far corner (100 pc), star 1 at the origin.
    positions: new Uint16Array([65535, 0, 0, 0, 0, 0]),
    magnitudes: new Uint16Array([11000, 9000]),
    count,
    ...overrides,
  };
}

test('a click is a press and release in the same place', () => {
  assert.equal(isClick({ x: 10, y: 10, time: 0 }, { x: 12, y: 11, time: 120 }), true);
});

test('a drag is a camera move, not a click', () => {
  assert.equal(isClick({ x: 10, y: 10, time: 0 }, { x: 140, y: 10, time: 120 }), false);
});

test('a slow press is not a click either', () => {
  assert.equal(isClick({ x: 10, y: 10, time: 0 }, { x: 10, y: 10, time: 4000 }), false);
});

test('an incomplete gesture picks nothing', () => {
  assert.equal(isClick(null, { x: 1, y: 1, time: 1 }), false);
  assert.equal(isClick({ x: 1, y: 1, time: 1 }, null), false);
});

test('the nearest nameable hit wins', () => {
  const best = pickFromHits([
    { tileId: 't', index: 3, distance: 40 },
    { tileId: 't', index: 7, distance: 12 },
    { tileId: 't', index: 9, distance: 80 },
  ], { tileId: 't' });
  assert.equal(best.index, 7);
});

test('a hit we cannot name is not a selection', () => {
  assert.equal(pickFromHits([{ tileId: 't', distance: 5 }], { tileId: 't' }), null,
    'no vertex means no identity');
  assert.equal(pickFromHits([{ tileId: 'other', index: 1, distance: 5 }], { tileId: 't' }), null,
    'a hit from another tile is not this tile’s star');
  assert.equal(pickFromHits([], { tileId: 't' }), null);
});

test('a pick resolves to a catalogue row, with the distance the tile encodes', () => {
  const identity = identityAt({ tile: tile(), index: 0 });
  assert.equal(identity.kind, 'star');
  assert.equal(identity.id, '42');
  assert.equal(identity.pointIndex, 0);
  // Star 0 sits at the far corner of a 100 pc box, so it is 100 pc away.
  assert.ok(Math.abs(identity.distancePc - 100) < 1e-6, `expected 100 pc, got ${identity.distancePc}`);
  assert.equal(identity.magnitude, 11, 'magnitudes are stored ×1000');
  assert.ok(identity.provenance.includes('esa.gaia DR3'));
  assert.ok(identity.provenance.includes('measured'));
});

test('a pick is not an identity if the tile cannot supply one', () => {
  assert.equal(identityAt({ tile: tile(), index: 99 }), null, 'out of range');
  assert.equal(identityAt({ tile: tile({ ids: [null, 43] }), index: 0 }), null, 'no id, no name');
  assert.equal(identityAt({ tile: null, index: 0 }), null);
});

test('the floating origin shifts the distance, and must not mirror it', () => {
  const near = identityAt({ tile: tile(), index: 0, originMetres: [0, 0, 0] });
  // Move the origin to sit on the star: the star is now at the origin, 0 pc away.
  const at = identityAt({
    tile: tile(),
    index: 0,
    originMetres: [100 * 3.0856775814913673e16, 0, 0],
  });
  assert.ok(Math.abs(at.distancePc) < 1e-6, `expected 0 pc, got ${at.distancePc}`);
  assert.ok(near.distancePc > at.distancePc, 'moving the origin to the star shortens the distance');
});

test('an unsupported unit is refused rather than silently mis-scaled', () => {
  const bad = tile();
  bad.header.unit = 'furlong';
  assert.throws(() => identityAt({ tile: bad, index: 0 }), /unsupported unit/);
});
