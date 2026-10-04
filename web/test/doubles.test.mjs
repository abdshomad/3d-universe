/**
 * A double is a fact about two measured stars, or it is not drawn at all.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { attachDoubles, doublesCardRow, tileIndexOf } from '../src/data/doubles.js';

const payload = {
  flag: 'DERIVED',
  citation: { catalogue: 'B/wds/wds' },
  pairs: [
    { wds: '03272+0944', primary_hip: 16083, secondary_hip: 'gaia:gaia-60k:18262',
      separation_arcsec: 0.7, discoverer: 'RST', observations: 31 },
    { wds: '04002+1234', primary_hip: 'gaia:gaia-60k:100', secondary_hip: 'gaia:gaia-60k:200',
      separation_arcsec: 5.1, observations: 12 },
    { wds: '05000+0000', primary_hip: 999, secondary_hip: 888, separation_arcsec: 2.0 },
  ],
};

test('a tile component is recognised, a Hipparcos one is not', () => {
  assert.equal(tileIndexOf('gaia:gaia-60k:18262'), 18262);
  assert.equal(tileIndexOf(16083), null);
  assert.equal(tileIndexOf('not-a-gaia-id'), null);
});

test('a pair attaches to both of its tile rows', () => {
  const report = attachDoubles(payload);
  assert.equal(report.byStar.get(18262).length, 1);
  assert.equal(report.byStar.get(100).length, 1);
  assert.equal(report.byStar.get(200).length, 1);
});

test('the card names the companion and the separation, not an edge', () => {
  const report = attachDoubles(payload);
  const [row] = doublesCardRow(report.byStar.get(18262));
  assert.equal(row, 'catalogued doubles');
  assert.ok(doublesCardRow(report.byStar.get(18262))[1].includes('0.7'), 'separation is quoted');
  assert.ok(doublesCardRow(report.byStar.get(18262))[1].includes('WDS 03272+0944'));
});

test('a pair with no tile row is counted, not silently dropped', () => {
  const report = attachDoubles(payload);
  assert.equal(report.unresolved, 1, 'the Hipparcos-only pair is accounted for');
  assert.equal(report.pairs, 3);
});

test('a star with no doubles gets no row', () => {
  assert.equal(doublesCardRow(undefined), null);
  assert.equal(doublesCardRow([]), null);
});

test('the report carries the median separation, so the layer can say why it draws no edges', () => {
  const report = attachDoubles(payload);
  assert.equal(report.medianSeparationArcsec, 2.0);
  assert.equal(report.citation.catalogue, 'B/wds/wds');
});
