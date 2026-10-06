/**
 * The solar-system tier: a small body is its own kind, with
 * its own card, its own epoch, and its own way of being named.
 */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

import { cardFor, cardForSmallBody } from '../src/ui/fact-card.js';
import { identityAt } from '../src/core/picker.js';
import { resolveSelection } from '../src/core/selection-resolver.js';
import { formatLookback } from '../src/core/light-travel.js';
import { SearchIndex } from '../src/core/search.js';

const rowValue = (card, label) => card.rows.find(([name]) => name === label)?.[1];

/** Ceres as the tile and the sidecar together describe it. */
const ceres = {
  kind: 'small_body',
  id: '20000001',
  pointIndex: 0,
  // 2.767 AU in parsecs: the distance the tile encodes.
  distancePc: 1.3415e-5,
  distance_au: 2.767,
  magnitude: 8.4,
  name: '1 Ceres (A801 AA)',
  diameter_km: 939.4,
  H: 3.34,
  epoch: '2026-06-09',
  provenance: 'nasa.jpl.sbdb live · U3DTILE2 · measured',
};

test('a small-body card names the spkid, diameter, magnitude and epoch', () => {
  const card = cardForSmallBody(ceres, { observerYear: 2026 });
  assert.equal(card.name, '1 Ceres (A801 AA)');
  assert.equal(rowValue(card, 'spkid'), '20000001');
  assert.equal(rowValue(card, 'diameter'), '939.4 km');
  assert.equal(rowValue(card, 'absolute magnitude H'), '3.34');
  assert.equal(rowValue(card, 'orbital epoch'), '2026-06-09');
  assert.equal(rowValue(card, 'distance'), '2.767 AU');
});

test('the epoch row is the point: the light row is minutes, not years', () => {
  const card = cardForSmallBody(ceres, { observerYear: 2026 });
  const light = rowValue(card, 'light left');
  // Ceres is 23 light-minutes away; a card that rounded that
  // to "0.0 yr ago" would be hiding the only lookback it has.
  assert.match(light, /23 min ago/);
});

test('a small body with no measured diameter carries a dash, not a zero', () => {
  const card = cardForSmallBody({ ...ceres, diameter_km: null }, {});
  assert.equal(rowValue(card, 'diameter'), '—');
});

test('every small-body card names its source', () => {
  const card = cardForSmallBody(ceres, {});
  assert.match(card.provenance, /nasa\.jpl\.sbdb/);
  assert.match(card.provenance, /measured/);
});

test('dispatch routes a small body to its own card', () => {
  const card = cardFor({ ...ceres }, {});
  assert.equal(rowValue(card, 'orbital epoch'), '2026-06-09');
});

test('a click on an AU tile is a small body, never a star', () => {
  const tile = {
    header: {
      unit: 'au',
      origin: [0, 0, 0],
      extent: [1, 1, 1],
      provenance: { catalog: 'nasa.jpl.sbdb', release: 'live' },
    },
    ids: [20000001n],
    positions: [32767, 0, 0],
    magnitudes: [8400],
    count: 1,
  };
  const identity = identityAt({ tile, index: 0, originMetres: [0, 0, 0] });
  assert.equal(identity.kind, 'small_body');
  assert.equal(identity.id, '20000001');
});

test('a click on a parsec tile is still a star', () => {
  const tile = {
    header: {
      unit: 'pc',
      origin: [0, 0, 0],
      extent: [1, 1, 1],
      provenance: { catalog: 'esa.gaia', release: 'DR3' },
    },
    ids: [5262578115910822400n],
    positions: [32767, 0, 0],
    magnitudes: [8400],
    count: 1,
  };
  assert.equal(identityAt({ tile, index: 0 }).kind, 'star');
});

test('a shared link to a small body resolves to the body, not a landmark', () => {
  const entry = { ...ceres, id: 'sbdb:20000001' };
  const resolved = resolveSelection({
    selectionId: 'sbdb:20000001',
    searchEntries: [entry],
  });
  assert.equal(resolved.kind, 'small_body');
  assert.equal(resolved.selection.name, '1 Ceres (A801 AA)');
  assert.equal(resolved.selection.epoch, '2026-06-09');
});

test('a shared link naming nothing stays unknown', () => {
  const resolved = resolveSelection({ selectionId: 'sbdb:99999999', searchEntries: [] });
  assert.equal(resolved.kind, 'unknown');
  assert.equal(resolved.selection, null);
});

test('solar-system light travel reads in minutes, and years stay years', () => {
  assert.equal(formatLookback(23 / 525960), '23 min ago');
  assert.equal(formatLookback(0.4 / 525960), '1 min ago');
  assert.equal(formatLookback(8.6), '8.6 yr ago');
});

test('a small body answers to its spkid the way a star answers to a HIP number', () => {
  const index = new SearchIndex([
    { id: 'sbdb:20000001', name: '1 Ceres (A801 AA)', kind: 'small_body', distance_pc: 1.3e-5 },
    { id: 'hip:32349', name: 'Sirius', hip: 32349, distance_pc: 2.637 },
  ]);
  assert.equal(index.byNumber('20000001').id, 'sbdb:20000001');
  assert.equal(index.byNumber('32349').id, 'hip:32349');
  assert.equal(index.query('ceres')[0].id, 'sbdb:20000001');
});

test('ingest derives the calendar date an orbital epoch names', () => {
  // The Python side is the source of truth for the converter,
  // so the test runs it. A host without python3 or without
  // the ingest package cannot check it, and the suite stays
  // green there; a converter that is wrong fails everywhere.
  const script = [
    'from ingest.astro.orbits import julian_to_iso',
    'assert julian_to_iso(2451545.0) == "2000-01-01"',
    'assert julian_to_iso(2461234.5) == "2026-07-13"',
  ].join('\n');
  try {
    execFileSync('python3', ['-c', script], { encoding: 'utf8' });
  } catch (error) {
    if (/No module named|ENOENT|not found/i.test(String(error.message))) return;
    throw error;
  }
});
