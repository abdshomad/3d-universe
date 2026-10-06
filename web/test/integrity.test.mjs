/**
 * Every light on screen must still resolve to a catalogue row.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { sampleIntegrity } from '../src/core/integrity.js';

/** A tile whose rows resolve, standing in for a baked asset. */
function tile(count = 64, overrides = {}) {
  const positions = new Uint16Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) positions[i] = 1000 + i;
  return {
    header: {
      tile_id: 't',
      unit: 'pc',
      origin: [0, 0, 0],
      extent: [100, 100, 100],
      provenance: { catalog: 'esa.gaia', release: 'DR3' },
    },
    ids: Array.from({ length: count }, (_, i) => 1000 + i),
    positions,
    magnitudes: new Uint16Array(count).fill(9000),
    count,
    ...overrides,
  };
}

test('a healthy tile resolves every sampled row', () => {
  const report = sampleIntegrity({
    tiles: [tile(64)], drawn: [{ tileId: 't', stride: 1, drawCount: 64 }], sample: 16,
  });
  assert.equal(report.ok, true);
  assert.equal(report.checked, 16);
  assert.equal(report.resolved, 16);
  assert.deepEqual(report.failures, []);
});

test('the check covers the drawn set, not the whole tile', () => {
  // LOD trimmed to 8 points: only those 8 can be on screen.
  const report = sampleIntegrity({
    tiles: [tile(64)], drawn: [{ tileId: 't', stride: 1, drawCount: 8 }], sample: 64,
  });
  assert.equal(report.checked, 8, 'a sample larger than the drawn set cannot invent rows');
  assert.equal(report.ok, true);
});

test('the sample follows the stride, not the tile prefix', () => {
  // The renderer draws every 4th star, so a broken row at
  // index 4 is on screen — and the check must see it, where a
  // walk over the first 8 rows would never look.
  const broken = tile(64);
  broken.ids[4] = null;
  const report = sampleIntegrity({
    tiles: [broken], drawn: [{ tileId: 't', stride: 4, drawCount: 8 }], sample: 8,
  });
  assert.equal(report.ok, false);
  assert.equal(report.resolved, 7);
  assert.ok(report.failures.some((f) => f.includes('row 4 does not resolve')), report.failures.join());
});

test('a row that cannot be named is reported, not skipped', () => {
  const broken = tile(16);
  broken.ids[7] = null;
  const report = sampleIntegrity({
    tiles: [broken], drawn: [{ tileId: 't', stride: 1, drawCount: 16 }], sample: 16,
  });
  assert.equal(report.ok, false);
  assert.equal(report.resolved, 15);
  assert.ok(report.failures.some((f) => f.includes('does not resolve')), report.failures.join());
});

test('a tile that names no catalog fails, however measured it claims to be', () => {
  const uncited = tile(8);
  uncited.header.provenance = { catalog: '', release: '' };
  const report = sampleIntegrity({
    tiles: [uncited], drawn: [{ tileId: 't', stride: 1, drawCount: 8 }], sample: 8,
  });
  assert.equal(report.ok, false);
  assert.equal(report.resolved, 0);
  assert.ok(report.failures[0].includes('cites no catalog'), report.failures.join());
});

test("the provenance must cite the catalog of the tile it came from", () => {
  const swapped = tile(8);
  swapped.header.provenance = { catalog: 'esa.gaia', release: 'DR3' };
  const report = sampleIntegrity({
    tiles: [swapped], drawn: [{ tileId: 't', stride: 1, drawCount: 8 }], sample: 8,
  });
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
});

test('nothing drawn is not a failure — it is an empty sky', () => {
  const report = sampleIntegrity({ tiles: [tile(64)], drawn: [] });
  assert.equal(report.ok, true);
  assert.equal(report.checked, 0);
  assert.deepEqual(report.failures, []);
});

test('a drawn tile that is not loaded is a failure, not a pass', () => {
  const report = sampleIntegrity({
    tiles: [], drawn: [{ tileId: 'ghost', stride: 1, drawCount: 10 }],
  });
  assert.equal(report.ok, false);
  assert.ok(report.failures[0].includes('drawn but not loaded'), report.failures.join());
});
