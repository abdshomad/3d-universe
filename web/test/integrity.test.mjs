/**
 * Every light on screen must still resolve to a catalogue row.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { sampleIntegrity } from '../src/core/integrity.js';

/** A tile whose rows resolve, standing in for a baked asset. */
function starIndex(count = 64, overrides = {}) {
  const positions = new Uint16Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) positions[i] = 1000 + i;
  return {
    tile: {
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
    },
  };
}

test('a healthy tile resolves every sampled row', () => {
  const report = sampleIntegrity({ starIndex: starIndex(64), drawnPoints: 64, sample: 16 });
  assert.equal(report.ok, true);
  assert.equal(report.checked, 16);
  assert.equal(report.resolved, 16);
  assert.deepEqual(report.failures, []);
});

test('the check covers the drawn range, not the whole tile', () => {
  // LOD trimmed to 8 points: only those 8 can be on screen.
  const report = sampleIntegrity({ starIndex: starIndex(64), drawnPoints: 8, sample: 64 });
  assert.equal(report.checked, 8, 'a sample larger than the drawn set cannot invent rows');
  assert.equal(report.ok, true);
});

test('a row that cannot be named is reported, not skipped', () => {
  const broken = starIndex(16);
  broken.tile.ids[7] = null;
  const report = sampleIntegrity({ starIndex: broken, drawnPoints: 16, sample: 16 });
  assert.equal(report.ok, false);
  assert.equal(report.resolved, 15);
  assert.ok(report.failures.some((f) => f.includes('does not resolve')), report.failures.join());
});

test('a tile that names no catalog fails, however measured it claims to be', () => {
  const uncited = starIndex(8);
  uncited.tile.header.provenance = { catalog: '', release: '' };
  const report = sampleIntegrity({ starIndex: uncited, drawnPoints: 8, sample: 8 });
  assert.equal(report.ok, false);
  assert.equal(report.resolved, 0);
  assert.ok(report.failures[0].includes('cites no catalog'), report.failures.join());
});

test("the provenance must cite the catalog of the tile it came from", () => {
  const swapped = starIndex(8);
  swapped.tile.header.provenance = { catalog: 'esa.gaia', release: 'DR3' };
  const report = sampleIntegrity({ starIndex: swapped, drawnPoints: 8, sample: 8 });
  assert.equal(report.ok, true);
  assert.ok(report.failures.length === 0);
});

test('nothing drawn is not a failure — it is an empty sky', () => {
  const report = sampleIntegrity({ starIndex: starIndex(64), drawnPoints: 0 });
  assert.equal(report.ok, true);
  assert.equal(report.checked, 0);
  assert.deepEqual(report.failures, []);
});

test('no tile loaded is a failure, not a pass', () => {
  const report = sampleIntegrity({ starIndex: null, drawnPoints: 10 });
  assert.equal(report.ok, false);
  assert.ok(report.failures[0].includes('no tile'));
});
