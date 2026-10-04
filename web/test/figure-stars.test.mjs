/**
 * An endpoint with no distance would be placed somewhere invented.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { figureCitation, figureStarPositions, toDirection } from '../src/data/figure-stars.js';
import { METRES_PER_PC } from '../src/core/units.js';

test('a direction is a unit vector', () => {
  for (const [ra, dec] of [[0, 0], [90, 0], [180, -45], [37, 89]]) {
    const [x, y, z] = toDirection(ra, dec);
    assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-12, `not unit at ${ra},${dec}`);
  }
});

test('a star is placed at its own distance from the Sun', () => {
  const positions = figureStarPositions({
    stars: [{ hip: 1, ra: 0, dec: 0, parallax_mas: 100, distance_pc: 10 }],
  });
  assert.equal(positions.length, 3);
  const metres = Math.hypot(positions[0], positions[1], positions[2]);
  assert.ok(Math.abs(metres - 10 * METRES_PER_PC) < 1, `got ${metres}`);
  assert.ok(positions[0] > 0, 'RA 0 points along +x');
});

test('a parallax gives the distance when the row lacks one', () => {
  const positions = figureStarPositions({
    stars: [{ hip: 1, ra: 0, dec: 0, parallax_mas: 200 }], // 5 pc
  });
  const metres = Math.hypot(...positions);
  assert.ok(Math.abs(metres - 5 * METRES_PER_PC) < 1, `got ${metres}, wanted ${5 * METRES_PER_PC}`);
});

test('a star with no parallax is refused, not placed at a guess', () => {
  const positions = figureStarPositions({
    stars: [
      { hip: 1, ra: 10, dec: 10, parallax_mas: 0, distance_pc: null },
      { hip: 2, ra: 20, dec: 20, parallax_mas: 100, distance_pc: 10 },
    ],
  });
  assert.equal(positions.length, 3, 'one star, three coordinates');
});

test('an empty or missing payload yields nothing rather than throwing', () => {
  assert.equal(figureStarPositions({ stars: [] }).length, 0);
  assert.equal(figureStarPositions(null).length, 0);
});

test('the citation travels with the set', () => {
  const citation = { catalogue: 'I/239/hip_main' };
  assert.equal(figureCitation({ citation }), citation);
  assert.equal(figureCitation(null), null);
});
