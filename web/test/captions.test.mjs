/**
 * A caption is a claim. It has to carry its source and get its numbers right.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { captionFor } from '../src/data/captions.js';
import { LIGHT_YEARS_PER_PC } from '../src/core/light-travel.js';

/** The five waypoints of the scale-out route, at the radii it actually uses. */
const ROUTE = [
  { id: 'sol', radiusPc: 0.01 },
  { id: 'nearby-stars', radiusPc: 5 },
  { id: 'neighbourhood', radiusPc: 100 },
  { id: 'open-cluster-scale', radiusPc: 1000 },
  { id: 'kpc', radiusPc: 10000 },
];

test('every step in the tour has a caption with a source', () => {
  for (const step of ROUTE) {
    const caption = captionFor(step);
    assert.ok(caption, `${step.id} has no caption`);
    assert.ok(caption.text.length > 20, `${step.id} caption is too thin`);
    assert.ok(caption.source && caption.source.length > 0, `${step.id} caption cites nothing`);
  }
});

test('the number in the caption is the number the radius implies', () => {
  // 100 pc must read as 326 light years, because that is what 100 pc is.
  const caption = captionFor({ id: 'neighbourhood', radiusPc: 100 });
  assert.ok(caption.text.includes('326'), caption.text);
  const five = captionFor({ id: 'nearby-stars', radiusPc: 5 });
  assert.ok(five.text.includes((5 * LIGHT_YEARS_PER_PC).toFixed(1)), five.text);
});

test('the modelled tier says simulated in the text, not just in a badge', () => {
  const caption = captionFor({ id: 'large-scale-structure', kind: 'field', radiusMpc: 500 });
  assert.ok(caption.text.includes('SIMULATED'), caption.text);
  assert.ok(caption.text.includes('not a survey'), caption.text);
  assert.ok(caption.text.includes('500 megaparsecs'), caption.text);
  assert.ok(caption.source.includes('DESI'), caption.source);
});

test('nothing honest to say means no caption, not a filler one', () => {
  assert.equal(captionFor(null), null);
  assert.equal(captionFor({ id: 'mystery' }), null);
  assert.equal(captionFor({ id: 'mystery', radiusPc: null }), null);
});

test('a caption hedges about nothing', () => {
  const hedges = ['probably', 'roughly', 'approximately', 'maybe', 'perhaps', 'i think'];
  for (const step of [...ROUTE, { id: 'x', kind: 'field', radiusMpc: 500 }]) {
    const text = captionFor(step).text.toLowerCase();
    for (const hedge of hedges) {
      assert.ok(!text.includes(hedge), `${step.id}: "${hedge}" in ${text}`);
    }
  }
});

test('a caption about a named place does not talk about another one', () => {
  // The Alpha Centauri clause is context for the scale-out route. Printed under
  // a caption about Barnard's Star it is true and beside the point.
  const barner = captionFor({ id: "Barnard's Star", radiusPc: 1.8215, name: "Barnard's Star" });
  assert.ok(barner.text.includes("Barnard's Star"), barner.text);
  assert.ok(!barner.text.includes('Alpha Centauri'), barner.text);
  assert.ok(barner.source.includes('guided journey'), barner.source);

  // The outward-looking route keeps its clause.
  const outward = captionFor({ id: 'nearby-stars', radiusPc: 5 });
  assert.ok(outward.text.includes('Alpha Centauri'), outward.text);
});

test('a measured distance reads as a measured distance', () => {
  const alpha = captionFor({ radiusPc: 1.3475, name: 'Alpha Centauri A' });
  assert.ok(alpha.text.includes('measured parallax'), alpha.text);
  assert.ok(alpha.text.includes('1.35'), 'the radius is not printed to four decimals: ' + alpha.text);
});
