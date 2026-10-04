/**
 * Accessibility: contrast maths and the motion decision.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contrastRatio,
  describeKeys,
  luminance,
  meetsAA,
  motionPolicy,
  prefersReducedMotion,
} from '../src/core/accessibility.js';

const VOID = '#05060a';

test('luminance is bounded and ordered', () => {
  assert.equal(luminance('#000000'), 0);
  assert.ok(Math.abs(luminance('#ffffff') - 1) < 1e-9);
  assert.ok(luminance('#8a8f98') > luminance('#5c626d'), 'lighter grey reads brighter');
});

test('contrast is symmetric and peaks at 21', () => {
  assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 1e-6);
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-6);
  assert.equal(contrastRatio('#123456', '#123456'), 1);
});

test('the HUD palette is measured, not assumed', () => {
  // These are the tokens in web/index.html: --ink and --ink-dim.
  const body = contrastRatio('#8a8f98', VOID);
  const dim = contrastRatio('#7c828d', VOID);
  assert.ok(body >= 4.5, `body text ${body.toFixed(2)}:1 must clear AA`);
  assert.ok(dim >= 4.5, `dim text ${dim.toFixed(2)}:1 must clear AA, not just large-text AA`);
});

test('the previous dim colour would have failed AA', () => {
  // The reason the token changed: --ink-dim used to be this, at 3.30:1.
  assert.equal(meetsAA('#5c626d', VOID), false, '3.30:1 clears large-text AA only');
});

test('reduced motion stops the app moving by itself', () => {
  const normal = motionPolicy({ reduced: false });
  assert.equal(normal.autoPlayRoute, true);
  assert.equal(normal.drift, true);

  const reduced = motionPolicy({ reduced: true });
  assert.equal(reduced.autoPlayRoute, false, 'it must not fly itself');
  assert.equal(reduced.drift, false, 'and it must not drift');
  assert.equal(reduced.onboarding, true, 'but hints stay: they are words, not motion');
});

test('reduced motion is detected defensively', () => {
  assert.equal(prefersReducedMotion({}), false);
  assert.equal(
    prefersReducedMotion({ matchMedia: () => ({ matches: true }) }),
    true,
  );
  assert.equal(
    prefersReducedMotion({ matchMedia: () => { throw new Error('nope'); } }),
    false,
  );
});

test('the key bindings are described from one source', () => {
  const described = describeKeys();
  assert.match(described, /w\/↑ fly out/);
  assert.match(described, /escape dismiss hints/);
});

test('the policy says whether it is a reduced-motion policy', () => {
  // A caller that asks `motion.reduced` must get a boolean, not undefined: an
  // always-undefined guard is a guard that never fires.
  assert.equal(motionPolicy({ reduced: true }).reduced, true);
  assert.equal(motionPolicy({ reduced: false }).reduced, false);
  assert.equal(motionPolicy().reduced, false);
  assert.equal(motionPolicy({ reduced: true }).autoPlayRoute, false);
});
