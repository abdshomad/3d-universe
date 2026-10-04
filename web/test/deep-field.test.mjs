/**
 * Deep fields: placement must be measured or declared, never invented.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { DEEP_FIELDS, FIELD_DEPTHS, fieldById } from '../src/data/deep-fields.js';
import { celestialDirection } from '../src/core/celestial.js';
import {
  createFieldPlanes,
  fieldDirection,
  icrsDirection,
  planeDistance,
} from '../src/render/deep-field.js';

const nearly = (actual, expected, tolerance = 1e-9) =>
  Math.abs(actual - expected) <= tolerance;

const isUnit = (vector) => nearly(Math.hypot(...vector), 1);

test('ICRS coordinates map to a unit direction', () => {
  assert.ok(isUnit(icrsDirection(110.8054, -73.4569)));
  const [x, y, z] = icrsDirection(0, 0);
  assert.ok(nearly(x, 1) && nearly(y, 0) && nearly(z, 0));
  const [x90, y90] = icrsDirection(90, 0);
  assert.ok(nearly(x90, 0) && nearly(y90, 1));
});

test('every field is placed by the same convention, measured or composed', () => {
  for (const field of DEEP_FIELDS) {
    assert.deepEqual(fieldDirection(field), celestialDirection(field.raDeg, field.decDeg));
    assert.ok(isUnit(fieldDirection(field)));
  }
});

test('every catalogue entry is honest about where its coordinates came from', () => {
  for (const field of DEEP_FIELDS) {
    assert.ok(field.credit.length > 10, `${field.id} needs a credit`);
    assert.ok(field.coordinateSource.length > 10, `${field.id} needs a coordinate source`);
    assert.ok(['icrs', 'authored'].includes(field.placement));
    assert.equal(typeof field.raDeg, 'number');
    assert.equal(typeof field.decDeg, 'number');
  }
});

test("Webb's first deep field keeps its SIMBAD coordinates", () => {
  // SIMBAD, ICRS J2000, 07 23 13.3 -73 27 25, queried 2026-10-04.
  const field = fieldById('jwst-first-deep-field');
  assert.equal(field.placement, 'icrs');
  assert.ok(nearly(field.raDeg, 110.8054, 1e-4), `ra ${field.raDeg}`);
  assert.ok(nearly(field.decDeg, -73.4569, 1e-4), `dec ${field.decDeg}`);
});

test('a wider field sits closer for the same frame', () => {
  const wide = { extentDeg: 10 };
  const narrow = { extentDeg: 1 };
  assert.ok(planeDistance(wide, 1e15, 0.5) < planeDistance(narrow, 1e15, 0.5));
});

test('a field is stacked on several planes that dim with depth', () => {
  const field = fieldById('jwst-first-deep-field');
  const group = createFieldPlanes(field, { textureUrl: 'x.jpg', frameScaleMetres: 1e15 });
  const planes = group.userData.planes;
  assert.ok(planes.length >= 3 && planes.length <= 5, `stack depth ${planes.length}`);

  const distances = planes.map((plane) => plane.userData.distance);
  const opacities = planes.map((plane) => plane.userData.opacity);
  assert.ok(distances[0] > distances[distances.length - 1], 'far plane first');
  assert.ok(
    opacities.every((value, index) => index === 0 || value < opacities[index - 1]),
    'farther planes are dimmer',
  );
  assert.ok(opacities.every((value) => value > 0 && value <= 0.5));
});

test('the default stack is three to five planes, far to near', () => {
  assert.ok(FIELD_DEPTHS.length >= 3 && FIELD_DEPTHS.length <= 5);
  assert.ok(FIELD_DEPTHS.every((depth, index) => index === 0 || depth < FIELD_DEPTHS[index - 1]));
});

test('a field points where the route looks when both use the same degrees', () => {
  const field = fieldById('hubble-extreme-deep-field');
  const look = { ra: field.raDeg, dec: field.decDeg };
  assert.deepEqual(fieldDirection(field), celestialDirection(look.ra, look.dec));
});

test('an unknown field is refused rather than drawn as nothing', () => {
  assert.throws(() => fieldById('no-such-field'), /no deep field/);
});