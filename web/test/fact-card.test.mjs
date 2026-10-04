/**
 * Fact cards: claims with sources, and dashes where there is nothing to say.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  UnknownObjectKindError,
  cardFor,
  cardForField,
  cardForEvent,
  cardForLandmark,
  cardForStar,
  formatDistance,
  formatNumber,
} from '../src/ui/fact-card.js';

const rowValue = (card, label) => card.rows.find(([name]) => name === label)?.[1];

test('a star card carries its id, distance, magnitude and source', () => {
  const card = cardForStar({
    id: '5262578111591082240', distancePc: 90.19, magnitude: 9.38, colorIndex: null,
    provenance: 'esa.gaia DR3 · measured',
  });
  assert.equal(rowValue(card, 'catalogue id'), '5262578111591082240');
  assert.equal(rowValue(card, 'distance'), '90.190 pc');
  assert.equal(rowValue(card, 'apparent mag'), '9.38');
  assert.match(card.provenance, /esa\.gaia/);
});

test('an unknown value is a dash, not a zero', () => {
  const card = cardForStar({ id: 'x', distancePc: null, magnitude: null, colorIndex: undefined });
  assert.equal(rowValue(card, 'distance'), '—');
  assert.equal(rowValue(card, 'apparent mag'), '—');
  assert.equal(rowValue(card, 'colour index B-V'), '—');
});

test('a landmark card shows the parallax and its error, and the cross-check', () => {
  const card = cardForLandmark({
    name: 'Sirius', hip: 32349, distance_pc: 2.637, parallax_mas: 379.21,
    parallax_error_mas: 1.58, visual_magnitude: -1.44, colour_index: 0.0,
    cross_check_arcsec: 0.16,
  });
  assert.equal(rowValue(card, 'catalogue'), 'HIP 32349');
  assert.equal(rowValue(card, 'parallax'), '379.21 ± 1.58 mas');
  assert.match(rowValue(card, 'cross-check'), /0\.16″ vs SIMBAD/);
  assert.match(card.provenance, /I\/239\/hip_main/);
});

test('an event card states how its distance was derived', () => {
  const card = cardForEvent({
    id: 'pulsar:B0833-45', name: 'B0833-45', kind: 'pulsar', flux_mjy: 5000,
    period_s: 0.0893, age_yr: 3280, distance_pc: 280, distance_source: 'dispersion-measure',
  });
  assert.equal(rowValue(card, 'flux at 400 MHz'), '5000.0 mJy');
  assert.equal(rowValue(card, 'distance from'), 'dispersion-measure');
  assert.match(rowValue(card, 'period'), /0\.089300 s/);
});

test('every card names a source', () => {
  for (const card of [
    cardForStar({ id: 'a', provenance: 'src-a' }),
    cardForLandmark({ hip: 1 }),
    cardForEvent({ kind: 'pulsar', id: 'p' }),
  ]) {
    assert.ok(card.provenance.length > 3, 'a card without a source is not a fact');
    assert.ok(card.rows.length >= 3);
  }
});

test('distances read in sensible units', () => {
  assert.equal(formatDistance(0.2), '41253 AU');
  assert.equal(formatDistance(2.637), '2.637 pc');
  assert.equal(formatDistance(2540), '2.54 kpc');
  assert.equal(formatDistance(2.5e6), '2.50 Mpc');
  assert.equal(formatDistance(null), '—');
  assert.equal(formatNumber(null), '—');
});

test('dispatch refuses a kind it has no card for', () => {
  assert.throws(() => cardFor({ kind: 'black-hole' }), UnknownObjectKindError);
  assert.equal(cardFor(null), null);
});

test('an event of any kind routes to the event card', () => {
  assert.equal(cardFor({ kind: 'frb', id: 'f' }).name, 'f');
  assert.equal(cardFor({ kind: 'gravitational_wave', id: 'g' }).name, 'g');
});

test('the field card says what the tier is not', () => {
  const field = {
    kind: 'field',
    radiusMpc: 500,
    cellMpc: 10.42,
    grid: 96,
    seed: 20261004,
    flag: 'SIMULATED',
    provenance: 'generated · SIMULATED · DESI DR1 is the science reference, not the source',
    pointCount: 49410,
  };
  const card = cardFor(field, { observerYear: 2026 }); // the real call shape
  const label = (needle) => card.rows.find(([key]) => key === needle)?.[1];
  const denial = card.rows.find(([key]) => key === 'is not');
  assert.deepEqual(denial, ['is not', 'a survey map — no galaxy here is measured']);
  assert.equal(label('radius'), '500 Mpc');
  assert.equal(label('grid'), '96³');
  assert.equal(label('cells drawn'), '49410');
  assert.equal(label('seed'), '20261004');
  assert.ok(card.provenance.includes('SIMULATED'));
  assert.ok(card.provenance.includes('not the source'), 'DESI is a reference, not the pixels');
});

test('a star that hosts planets says so, and says the position is derived', () => {
  const card = cardForStar({
    id: '5853498713190525696',
    name: 'Proxima Cen',
    distancePc: 1.301,
    magnitude: 11.13,
    colorIndex: null,
    planets: [
      { pl_name: 'Proxima Cen b', disc_year: 2016 },
      { pl_name: 'Proxima Cen c', disc_year: 2020 },
    ],
  });
  const row = card.rows.find(([label]) => label === 'confirmed planets');
  assert.ok(row, 'a star with planets carries the row');
  assert.ok(row[1].includes('Proxima Cen b 2016'), row[1]);
  assert.ok(row[1].includes('Proxima Cen c 2020'));
  assert.ok(row[1].includes('not astrometric'), 'derived, not measured');
});

test('a star with no planets carries no planets row', () => {
  const card = cardForStar({ id: '1', name: 'Lonely', distancePc: 10, magnitude: 9, colorIndex: null });
  assert.equal(card.rows.find(([label]) => label === 'confirmed planets'), undefined);
});

test('a clicked cell says it is a quantised value, not an overdensity', () => {
  const card = cardFor({
    kind: 'field',
    radiusMpc: 500, cellMpc: 10.42, grid: 96, seed: 20261004, flag: 'SIMULATED',
    cell: {
      index: 3982, x: 38, y: 1, z: 0, quantised: 143,
      floor: 0.35, ceiling: 4.5, method: 'Gaussian random field',
    },
  });
  const label = (needle) => card.rows.find(([key]) => key === needle)?.[1];
  assert.ok(label('clicked cell').includes('x 38, y 1, z 0'), label('clicked cell'));
  assert.ok(label('quantised value').includes('143'), label('quantised value'));
  assert.ok(label('this is').includes('Gaussian random field'));
  // Only the cell rows: the card's own honesty row mentions galaxies on purpose.
  const cellText = [label('clicked cell'), label('quantised value'), label('this is')]
    .join(' ').toLowerCase();
  assert.ok(!cellText.includes('overdensity'), cellText);
  assert.ok(!cellText.includes('galaxy'), cellText);
  assert.ok(!cellText.includes('void'), cellText);
});
