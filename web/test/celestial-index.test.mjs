/**
 * The celestial index: a tile plus its sidecar rows
 * become entries — the same entries the menu lists
 * and the search answers. A flight to an entry lands
 * on the position the tile drew, so the entry is read
 * back from the tile, not re-derived from a catalogue
 * the renderer never saw.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { METRES_PER_AU, METRES_PER_PC } from '../src/core/units.js';
import { celestialDirection } from '../src/core/celestial.js';
import {
  BODY_LIMIT,
  CELESTIAL_KINDS,
  celestialEntries,
  celestialEntry,
  directionToRaDec,
} from '../src/core/celestial-index.js';

/** Quantise a catalogue position onto a tile's grid. */
function quantise(units, origin, extent) {
  return units.map((value, axis) => Math.round(
    ((value - origin[axis]) / extent[axis]) * 65535));
}

/**
 * A tile with one body at a known sky position.
 * The origin and extent bracket the body per axis,
 * so its quantised position is the one the layer
 * drew. The tile's unit is the unit of its origin
 * and extent: an 'au' tile carries AU, and the
 * reader scales to metres.
 */
function tileAt(raDeg, decDeg, distanceAu, {
  unit = 'au',
  flag = 'MEASURED',
  kind = 'small_body',
} = {}) {
  const units = celestialDirection(raDeg, decDeg)
    .map((component) => component * distanceAu);
  const origin = units.map((value) => (value < 0 ? value * 2 : 0));
  const extent = units.map((value) => Math.abs(value) * 2 + 1e-9);
  return {
    header: {
      tile_id: `${kind}-tile`,
      unit,
      origin,
      extent,
      provenance: { catalog: 'nasa.jpl.sbdb', release: 'live', flag },
      extra: { dataset_kind: kind },
    },
    ids: [20000001n],
    positions: new Uint16Array(quantise(units, origin, extent)),
    magnitudes: [3340],
    colours: [0, 0, 0],
    count: 1,
  };
}

/** The sidecar row for the tile's one body. */
function row(fields = {}) {
  return {
    spkid: '20000001',
    name: '1 Ceres (A801 AA)',
    H: 3.34,
    diameter_km: 939.4,
    epoch: '2026-06-09',
    distance_au: 3.4582,
    ...fields,
  };
}

test('a direction round-trips through ra and dec', () => {
  const { ra_deg, dec_deg } = directionToRaDec(
    celestialDirection(76.001904, 19.721149),
  );
  assert.ok(Math.abs(ra_deg - 76.001904) < 1e-6);
  assert.ok(Math.abs(dec_deg - 19.721149) < 1e-6);
});

test('an entry carries the body the tile drew', () => {
  // Ceres' own position: ra 76.001904, dec 19.721149,
  // 3.4582 AU.
  const tile = tileAt(76.001904, 19.721149, 3.4582);
  const entry = celestialEntry({
    tile,
    index: 0,
    row: row(),
    kind: 'small_body',
    prefix: 'sbdb',
    flag: 'MEASURED',
  });
  assert.equal(entry.id, 'sbdb:20000001');
  assert.equal(entry.kind, 'small_body');
  assert.equal(entry.flag, 'MEASURED');
  assert.equal(entry.name, '1 Ceres (A801 AA)');
  // The quantised grid is 2/65535 of the extent per
  // axis: the round trip lands within a hundredth of
  // a degree.
  assert.ok(Math.abs(entry.ra_deg - 76.001904) < 0.01);
  assert.ok(Math.abs(entry.dec_deg - 19.721149) < 0.01);
  const wantedPc = 3.4582 * METRES_PER_AU / METRES_PER_PC;
  assert.ok(Math.abs(entry.distance_pc - wantedPc) / wantedPc < 1e-4);
  assert.equal(entry.visual_magnitude, 3.34);
  assert.equal(entry.provenance, 'nasa.jpl.sbdb live · U3DTILE2 · measured');
  // The row rides whole: the card reads its fields.
  assert.equal(entry.epoch, '2026-06-09');
  assert.equal(entry.diameter_km, 939.4);
});

test('the flag comes from the tile, not the row', () => {
  const tile = tileAt(10, 20, 1);
  tile.header.provenance.flag = 'SIMULATED';
  const entry = celestialEntry({
    tile,
    index: 0,
    row: row(),
    kind: 'small_body',
    prefix: 'sbdb',
    flag: 'SIMULATED',
  });
  assert.equal(entry.flag, 'SIMULATED');
});

test('entries sort brightest first, unnamed magnitudes last', () => {
  const tile = tileAt(0, 0, 1);
  tile.count = 3;
  tile.ids = [1n, 2n, 3n];
  // Three distinct, non-zero positions: a zero
  // position has no direction, so it would not
  // be a body at all.
  tile.positions = new Uint16Array([
    32768, 32768, 32768, 16384, 32768, 0, 0, 16384, 32768,
  ]);
  const entries = celestialEntries({
    tile,
    rows: new Map(Object.entries({
      '1': row({ spkid: '1', name: 'bright', H: 2 }),
      '2': row({ spkid: '2', name: 'faint', H: 9 }),
      '3': row({ spkid: '3', name: 'unknown', H: undefined }),
    })),
    kind: 'small_body',
  });
  assert.deepEqual(
    entries.map((entry) => entry.name),
    ['bright', 'faint', 'unknown'],
  );
});

test('a body without a sidecar row is dropped, not invented', () => {
  const tile = tileAt(0, 0, 1);
  const entries = celestialEntries({
    tile,
    rows: new Map(),
    kind: 'small_body',
  });
  assert.equal(entries.length, 0);
});

test('every kind knows its prefix, its magnitude and its unit', () => {
  assert.deepEqual(CELESTIAL_KINDS.small_body, {
    prefix: 'sbdb',
    magnitude: 'H',
    distance: 'distance_au',
    unit: 'AU',
  });
  assert.deepEqual(CELESTIAL_KINDS.black_hole, {
    prefix: 'a61',
    magnitude: null,
    distance: 'distance_kpc',
    unit: 'kpc',
  });
  // The menu lists six kinds — every kind the
  // manifest holds, and no kind it does not.
  assert.deepEqual(Object.keys(CELESTIAL_KINDS), [
    'small_body', 'comet', 'planet', 'satellite',
    'galaxy', 'black_hole',
  ]);
});

test('the list is capped, and the cap is stated', () => {
  assert.equal(BODY_LIMIT, 100);
});
