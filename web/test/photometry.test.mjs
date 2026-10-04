/**
 * Photometry parity: the renderer and the bake must agree exactly.
 *
 * `ingest/astro/photometry.py` turns a catalog's magnitudes and B-V into light.
 * `web/src/core/photometry.js` turns the same numbers into pixels. If the two
 * drift, a star looks different from the value the catalog recorded — so this
 * runs the Python side and compares, rather than trusting a comment.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  colorToRgb,
  fluxRatio,
  spriteScale,
  temperatureK,
  temperatureToRgb,
} from '../src/core/photometry.js';

const MAGNITUDES = [-1.46, 0, 2.5, 6, 8.19, 12];
const COLOR_INDEXES = [-0.4, 0, 0.65, 1.5, 2];

function pythonPhotometry() {
  const script = `
import json
from ingest.astro.photometry import flux_ratio, sprite_scale, temperature_k, temperature_to_rgb, color_to_rgb
mags = ${JSON.stringify(MAGNITUDES)}
bvs = ${JSON.stringify(COLOR_INDEXES)}
print(json.dumps({
    "flux": [flux_ratio(m) for m in mags],
    "scale": [sprite_scale(m) for m in mags],
    "temperature": [temperature_k(b) for b in bvs],
    "rgb": [color_to_rgb(b) for b in bvs],
    "rgb_from_temperature": [list(temperature_to_rgb(temperature_k(b))) for b in bvs],
}))
`;
  const output = execFileSync('python3', ['-c', script], { encoding: 'utf8' });
  return JSON.parse(output.trim().split('\n').pop());
}

let reference;
try {
  reference = pythonPhotometry();
} catch (error) {
  reference = null;
  console.log(`python reference unavailable: ${error.message}`);
}

const close = (actual, expected, tolerance = 1e-9) =>
  Math.abs(actual - expected) <= tolerance;

test('magnitude to flux matches the bake', { skip: !reference }, () => {
  MAGNITUDES.forEach((magnitude, index) => {
    assert.ok(close(fluxRatio(magnitude), reference.flux[index]), `flux at ${magnitude}`);
  });
});

test('magnitude to point size matches the bake', { skip: !reference }, () => {
  MAGNITUDES.forEach((magnitude, index) => {
    assert.ok(close(spriteScale(magnitude), reference.scale[index]), `size at ${magnitude}`);
  });
});

test('B-V to temperature matches the bake', { skip: !reference }, () => {
  COLOR_INDEXES.forEach((colorIndex, index) => {
    assert.ok(
      close(temperatureK(colorIndex), reference.temperature[index], 1e-6),
      `temperature at ${colorIndex}`,
    );
  });
});

test('B-V to RGB matches the bake', { skip: !reference }, () => {
  COLOR_INDEXES.forEach((colorIndex, index) => {
    const ours = colorToRgb(colorIndex);
    const theirs = reference.rgb[index];
    ours.forEach((channel, axis) => {
      assert.ok(close(channel, theirs[axis], 1e-6), `rgb axis ${axis} at ${colorIndex}`);
    });
  });
});

test('blackbody colour follows temperature', { skip: !reference }, () => {
  COLOR_INDEXES.forEach((colorIndex, index) => {
    const ours = temperatureToRgb(temperatureK(colorIndex));
    const theirs = reference.rgb_from_temperature[index];
    ours.forEach((channel, axis) => {
      assert.ok(close(channel, theirs[axis], 1e-6), `axis ${axis} at ${colorIndex}`);
    });
  });
});

test('a missing magnitude or colour has a defined answer', () => {
  assert.equal(fluxRatio(null), null);
  assert.equal(spriteScale(null), 0.9);
  assert.equal(temperatureK(null), null);
  assert.deepEqual(colorToRgb(null), [0.8, 0.82, 0.86]);
});

test('sizes and brightness fall as stars get fainter', () => {
  assert.ok(spriteScale(-1.46) > spriteScale(6));
  assert.ok(fluxRatio(-1.46) > fluxRatio(6));
});

test('colours run from blue-white to orange-red across B-V', () => {
  const blue = colorToRgb(-0.4);
  const red = colorToRgb(2);
  assert.ok(blue[2] > blue[0], 'a blue star has more blue');
  assert.ok(red[0] > red[2], 'a red star has more red');
});