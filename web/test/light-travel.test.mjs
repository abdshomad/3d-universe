/**
 * Light-travel time: the sky is a composite of epochs, and the maths is exact.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIGHT_YEARS_PER_PC,
  emissionYear,
  epochSpan,
  formatLookback,
  formatYear,
  lookbackYears,
} from '../src/core/light-travel.js';

test('one parsec is 3.26 light years', () => {
  assert.ok(Math.abs(LIGHT_YEARS_PER_PC - 3.26156) < 1e-4);
  assert.ok(Math.abs(lookbackYears(1) - 3.26156) < 1e-4);
});

test('a kiloparsec is three thousand years of lookback', () => {
  assert.ok(Math.abs(lookbackYears(1000) - 3261.56) < 0.1);
  assert.ok(Math.abs(lookbackYears(2.637) - 8.6) < 0.1, 'Sirius: 8.6 years');
});

test('an unknown distance yields unknown time, not zero', () => {
  assert.equal(lookbackYears(null), null);
  assert.equal(lookbackYears(undefined), null);
  assert.equal(lookbackYears(Number.NaN), null);
  assert.equal(formatLookback(null), '—');
  assert.equal(formatYear(null), '—');
});

test('emission year is the observer year minus the lookback', () => {
  assert.ok(Math.abs(emissionYear(1, 2026) - 2022.74) < 0.01);
  assert.ok(Math.abs(emissionYear(1000, 2026) - (2026 - 3261.56)) < 0.01);
});

test('moving the observer into the future gives arrivals, not departures', () => {
  assert.equal(emissionYear(1, 2020) < 2020, true, 'light seen earlier left later in the past');
  const future = lookbackYears(1) * -1;
  assert.match(formatLookback(future), /from now$/);
});

test('phrasing scales with the size of the interval', () => {
  assert.equal(formatLookback(8.6), '8.6 yr ago');
  assert.equal(formatLookback(900), '900 yr ago');
  assert.equal(formatLookback(3261), '3.3 kyr ago');
  assert.equal(formatLookback(1.5e6), '1.5 Myr ago');
});

test('a set of distances spans a range of epochs', () => {
  const span = epochSpan([0.5, 100, 1000], 2026);
  assert.ok(Math.abs(span.oldestYear - (2026 - 3261.56)) < 0.1);
  assert.ok(Math.abs(span.newestYear - (2026 - 1.63)) < 0.1);
  assert.ok(span.spanYears > 3200);
  assert.equal(epochSpan([], 2026).oldestYear, null);
});

test('the scrubber moves the whole sky, near and far together', () => {
  const now = epochSpan([0.5, 1000], 2026);
  const later = epochSpan([0.5, 1000], 3000);
  assert.ok(Math.abs((later.oldestYear - now.oldestYear) - 974) < 0.1, 'both shift by the same amount');
});
