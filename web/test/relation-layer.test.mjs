/**
 * A ribbon is a claim that two specific stars are related. This is where that
 * claim is made, so the match quality is what gets tested.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { StarIndex, buildRelationRibbons } from '../src/render/relation-layer.js';

const PC = 3.0856775814913673e16;

/** Sky position to a world vector at `distancePc`, matching the layer's frame. */
function worldOf(raDeg, decDeg, distancePc = 100) {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const metres = distancePc * PC;
  return [Math.cos(dec) * Math.cos(ra) * metres, Math.cos(dec) * Math.sin(ra) * metres, Math.sin(dec) * metres];
}

/** Two stars: one at (10°, 10°), one at (10°, 20°). */
function indexOf(raDecs) {
  const flat = new Float64Array(raDecs.length * 3);
  raDecs.forEach(([ra, dec], i) => flat.set(worldOf(ra, dec), i * 3));
  return new StarIndex(flat);
}

function figures(segments) {
  return [{
    id: 'constellation:Test',
    type: 'constellation',
    name: 'Test',
    citation: 'test figures',
    segments,
  }];
}

test('a match reports how far off it was, not just that it matched', () => {
  const index = indexOf([[10, 10], [10, 20]]);
  const hit = index.nearest(10, 10);
  assert.ok(hit, 'an exact position must match');
  assert.ok(hit.separationArcsec < 1e-3, `expected ~0, got ${hit.separationArcsec}`);
  assert.ok(hit.position, 'and carry the star it matched');
});

test('a position away from its star reports the separation it drifted', () => {
  const index = indexOf([[10, 10]]);
  const near = index.nearest(10.05, 10);
  const far = index.nearest(10.2, 10);
  assert.ok(near.separationArcsec < far.separationArcsec, 'further off means a worse match');
  assert.ok(far.separationArcsec > 600, `0.2° is about 720″, got ${far.separationArcsec}`);
});

test('a position beyond tolerance matches nothing', () => {
  const index = indexOf([[10, 10]]);
  assert.equal(index.nearest(20, 10), null);
});

test('a figure drawn between two measured stars is reported as drawn', () => {
  const index = indexOf([[10, 10], [10, 20]]);
  const { meshes, report } = buildRelationRibbons({
    relations: figures([[[10, 10], [10, 20]]]),
    citation: 'test figures',
    index,
    widthMetres: 1e6,
  });
  assert.equal(meshes.length, 1);
  assert.equal(report.drawn, 1);
  assert.equal(report.droppedTooLoose, 0);
});

test('a ribbon joining stars the figure does not name is dropped, and counted', () => {
  // End 2 is 0.3° of RA away — inside nearest's 0.35° tolerance, so it does
  // match a star, but past the 10' the layer will claim.
  const index = indexOf([[10, 10], [10, 20]]);
  const { meshes, report } = buildRelationRibbons({
    relations: figures([[[10, 10], [10.3, 20]]]),
    citation: 'test figures',
    index,
    widthMetres: 1e6,
  });
  assert.equal(meshes.length, 0, 'a loose end must not be drawn');
  assert.equal(report.droppedTooLoose, 1);
  assert.equal(report.attempted, 1);
});

test('a ribbon within tolerance records its actual match quality', () => {
  const index = indexOf([[10, 10], [10, 20]]);
  const { meshes, report } = buildRelationRibbons({
    relations: figures([[[10.1, 10], [10, 20]]]), // 0.1° off, about 360″
    citation: 'test figures',
    index,
    widthMetres: 1e6,
  });
  assert.equal(meshes.length, 1, '0.1° is inside the stated tolerance');
  const separation = meshes[0].userData.endSeparationArcsec;
  assert.ok(separation > 300 && separation < 420, `expected about 360, got ${separation}`);
  assert.equal(report.worstSeparationArcsec, separation, 'the report names the worst match drawn');
});
