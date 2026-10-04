/**
 * Reticles: thin, deterministic, and sized like an instrument.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  circlePoints,
  createReticle,
  crosshairPoints,
  ellipsePoints,
  reticleStrokes,
  tickPoints,
  worldWidthForPixels,
} from '../src/render/reticles.js';

test('a circle is a closed loop of segments', () => {
  const points = circlePoints(1, 64);
  assert.equal(points.length, 128);
  for (const [x, y, z] of points) {
    assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-12, 'every vertex sits on the circle');
    assert.equal(z, 0, 'a reticle lives in one plane');
  }
});

test('a partial arc stops where it is told', () => {
  const points = circlePoints(1, 8, 0, Math.PI);
  assert.equal(points.length, 16);
  assert.ok(points.every(([, y]) => y >= -1e-12), 'half circle stays above the axis');
});

test('ticks are radial and evenly spaced', () => {
  const points = tickPoints({ radius: 2, ticks: 4, tickLength: 0.5 });
  assert.equal(points.length, 8);
  for (let i = 0; i < 4; i += 1) {
    const [x0, y0] = points[2 * i];
    const [x1, y1] = points[2 * i + 1];
    assert.ok(Math.abs(Math.hypot(x0, y0) - 2) < 1e-12);
    assert.ok(Math.abs(Math.hypot(x1, y1) - 2.5) < 1e-12);
  }
});

test('the crosshair leaves a gap over the object', () => {
  const points = crosshairPoints({ size: 1, gap: 0.35 });
  assert.equal(points.length, 8);
  assert.ok(points.some(([x]) => Math.abs(x) === 1), 'arms reach the outer size');
  assert.ok(points.some(([x]) => Math.abs(x) === 0.35), 'and stop at the gap');
});

test('the uncertainty ellipse keeps its axes and rotation', () => {
  const flat = ellipsePoints({ semiMajor: 2, semiMinor: 1, segments: 64 });
  const radii = flat.map(([x, y]) => Math.hypot(x, y));
  assert.ok(Math.max(...radii) <= 2 + 1e-12);
  assert.ok(Math.min(...radii) >= 1 - 1e-12);

  const rotated = ellipsePoints({ semiMajor: 2, semiMinor: 1, rotationDeg: 90, segments: 4 });
  assert.ok(rotated.length > 0);
  assert.notDeepEqual(rotated[0], flat[0]);
});

test('a reticle draws a circle, ticks and a crosshair, and the ellipse only on request', () => {
  const plain = reticleStrokes({ radius: 1, tickCount: 8, tickLength: 0.1, crosshairSize: 1 });
  const withEllipse = reticleStrokes({
    radius: 1, tickCount: 8, tickLength: 0.1, crosshairSize: 1,
    uncertainty: { semiMajor: 1, semiMinor: 0.3, segments: 8 },
  });
  assert.ok(withEllipse.length > plain.length);
});

test('screen-space size converts to world size at a distance', () => {
  const near = worldWidthForPixels(1, 10);
  const far = worldWidthForPixels(100, 10);
  assert.ok(far > near * 99, 'ten times further needs a hundred times the world size');
  assert.ok(near > 0);
});

test('the reticle lands on its object and faces the camera', () => {
  const reticle = createReticle({
    position: [1e10, 0, 0], distance: 1e10, radius: 1e9, label: 'procyon',
  });
  assert.equal(reticle.name, 'reticle:procyon');
  assert.equal(reticle.position.x, 1e10);
  assert.equal(reticle.userData.strokePixels, 1, 'line width is a screen-space pixel');
  assert.ok(reticle.geometry.getAttribute('position').count > 0);
  assert.equal(reticle.material.depthTest, false, 'annotations are never occluded');
});