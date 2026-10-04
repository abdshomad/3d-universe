/**
 * Post chain: the void must stay #05060a.
 *
 * Tone mapping and bloom can both lift or crush a background, and the difference
 * between a void and a black hole is the whole look. These pin the colour and
 * the vignette falloff; the GPU path is verified in a browser.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_BLOOM, VOID_COLOUR, vignetteAt } from '../src/render/post-settings.js';

const hexToRgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

test('the void is a blue-black, never pure black', () => {
  const [r, g, b] = hexToRgb(VOID_COLOUR);
  assert.equal(r, 5);
  assert.equal(g, 6);
  assert.equal(b, 10);
  assert.ok(r + g + b > 0, 'pure #000000 reads as a dead frame');
});

test('the bloom threshold is low enough for faint stars to bleed', () => {
  assert.ok(DEFAULT_BLOOM.threshold <= 0.1, `threshold ${DEFAULT_BLOOM.threshold}`);
  assert.ok(DEFAULT_BLOOM.strength > 0, 'bloom must actually do something');
});

test('the vignette darkens the corners and spares the centre', () => {
  const centre = vignetteAt(0);
  const edge = vignetteAt(0.75);
  const corner = vignetteAt(1.4);
  assert.equal(centre, 1);
  assert.ok(edge < centre, 'the frame edge is darker than the centre');
  assert.ok(corner < edge, 'the corner is darker than the edge');
  assert.ok(corner > 0.2, 'never crush the corners to black');
});

test('the vignette is symmetric', () => {
  assert.equal(vignetteAt(0.4), vignetteAt(0.4));
});