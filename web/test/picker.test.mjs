/**
 * A click must resolve to the same identity a typed name would.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  cellIdentity,
  eventIdentity,
  identityAt,
  isClick,
  nearestCellOnScreen,
  pickFromHits,
} from '../src/core/picker.js';

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

/**
 * A clicked cell is a number from a generator, and must read like one.
 */
test('a cell hit reports where it is in the grid and what it holds', () => {
  const field = {
    kind: 'field',
    grid: 4,
    radiusMpc: 500,
    cellMpc: 125,
    flag: 'SIMULATED',
    seed: 20261004,
    method: 'Gaussian random field',
    quantise: { floor: 0.35, ceiling: 4.5 },
    scienceReference: 'DESI DR1',
    cells: new Uint8Array(64).fill(120),
  };
  // index 21 in a 4^3 grid is x=1, y=1, z=1
  const cell = cellIdentity({ field, cellIndex: 21 });
  assert.equal(cell.kind, 'field');
  assert.deepEqual([cell.cell.x, cell.cell.y, cell.cell.z], [1, 1, 1]);
  assert.equal(cell.cell.quantised, 120);
  assert.equal(cell.cell.floor, 0.35);
  assert.equal(cell.cell.ceiling, 4.5);
});

test('a hit outside the cube is not a cell', () => {
  const field = { grid: 4, cells: new Uint8Array(64), quantise: {}, flag: 'SIMULATED' };
  assert.equal(cellIdentity({ field, cellIndex: 64 }), null, 'past the end');
  assert.equal(cellIdentity({ field, cellIndex: -1 }), null);
  assert.equal(cellIdentity({ field, cellIndex: 1.5 }), null, 'not a cell index');
  assert.equal(cellIdentity({ cellIndex: 1 }), null, 'no field, no cell');
});

test('a picked cell has an id, so it can be shared like a star', () => {
  const field = { grid: 4, cells: new Uint8Array(64), quantise: {}, flag: 'SIMULATED' };
  assert.equal(cellIdentity({ field, cellIndex: 21 }).id, 'lss:21');
});

test('the cell nearest the click wins, in pixels', () => {
  // Two cells on screen: one at the click, one 40 px away.
  const projected = new Float64Array([
    0.0, 0.0, 0.5,   // dead centre
    0.04, 0.0, 0.5,  // ~40 px right on a 1000 px wide view
  ]);
  const hit = nearestCellOnScreen(projected, { x: 0, y: 0 }, { width: 1000, height: 800 });
  assert.equal(hit.index, 0);
  assert.ok(hit.pixels < 1);
});

test('a click far from every cell picks nothing', () => {
  const projected = new Float64Array([0.0, 0.0, 0.5]);
  assert.equal(nearestCellOnScreen(projected, { x: 0.9, y: 0.9 }, { width: 1000, height: 800 }), null);
});

test('cells behind the camera are not pickable', () => {
  const behind = new Float64Array([0.0, 0.0, -5]); // z < -1
  const infront = new Float64Array([0.9, 0.9, 5]);  // z > 1
  assert.equal(nearestCellOnScreen(behind, { x: 0, y: 0 }, { width: 1000, height: 800 }), null);
  assert.equal(nearestCellOnScreen(infront, { x: 0, y: 0 }, { width: 1000, height: 800 }), null);
});

test('an empty layer picks nothing rather than throwing', () => {
  assert.equal(nearestCellOnScreen(new Float64Array(0), { x: 0, y: 0 }, { width: 800, height: 600 }), null);
});

/**
 * A spark is a glyph drawn around a catalogue row. A pick has to find the row.
 */
test('an uncited event is not a selection', () => {
  assert.equal(eventIdentity({ event: { id: 'PSR', kind: 'pulsar' } }), null,
    'a number with no source is not a card');
  assert.equal(eventIdentity({ event: null }), null);
  assert.equal(eventIdentity({ event: { kind: 'pulsar' } }), null, 'no id, no identity');
});

test('a cited event selects, with its id as a string', () => {
  const selected = eventIdentity({
    event: { id: 12345, kind: 'pulsar', period_s: 0.0331 },
    citation: 'ATNF pulsar catalogue',
  });
  assert.equal(selected.kind, 'pulsar');
  assert.equal(selected.id, '12345');
  assert.equal(selected.period_s, 0.0331);
  assert.equal(selected.citation, 'ATNF pulsar catalogue');
});
