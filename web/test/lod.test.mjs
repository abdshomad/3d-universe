/**
 * LOD selection checks.
 *
 * The questions the tree asks every frame: is the tile inside the view pyramid,
 * is it in front of the camera, and are its stars bright enough to earn a point
 * of budget.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { LodTree, fractionVisible } from '../src/core/lod-tree.js';
import { planesFromCamera, pointInFrustum } from '../src/core/frustum.js';
import { METRES_PER_PC } from '../src/core/units.js';

const pc = (value) => value * METRES_PER_PC;
const DOWN_X = [1, 0, 0];

/** A manifest-shaped entry: origin and extent in parsecs. */
function manifestEntry(tileId, { centrePc, extentPc, count, magRange }) {
  const half = extentPc / 2;
  return {
    tile_id: tileId,
    unit: 'pc',
    origin: [centrePc - half, -half, -half],
    extent: [extentPc, extentPc, extentPc],
    count,
    mag_range: magRange,
  };
}

function treeWith(entries) {
  const tree = new LodTree();
  for (const entry of entries) tree.addFromManifest(entry);
  return tree;
}

const nearTile = manifestEntry('near', { centrePc: 10, extentPc: 5, count: 2000, magRange: [6, 12] });
const farTile = manifestEntry('far', { centrePc: 2000, extentPc: 50, count: 5000, magRange: [8, 12] });

const lookingDownX = (position) => planesFromCamera({ position, direction: DOWN_X });

const select = (tree, position, options = {}) =>
  tree.select({ planes: lookingDownX(position), position, direction: DOWN_X, ...options });

test('manifest units become metres', () => {
  const tree = treeWith([nearTile]);
  const box = tree.tiles[0].box;
  assert.ok(Math.abs(box.size[0] - 5 * METRES_PER_PC) / box.size[0] < 1e-9);
});

test('the tree keeps every tile it was given', () => {
  const tree = treeWith([nearTile, farTile]);
  const stored = tree.populatedNodes().reduce((total, node) => total + node.tiles.length, 0);
  assert.equal(tree.tileCount, 2);
  assert.equal(stored, 2);
});

test('a tile behind the camera is culled', () => {
  const behind = manifestEntry('behind', { centrePc: -4000, extentPc: 50, count: 4000, magRange: [4, 12] });
  const result = select(treeWith([nearTile, behind]), [0, 0, 0]);
  const ids = result.visible.map((item) => item.id);
  assert.ok(ids.includes('near'));
  assert.ok(!ids.includes('behind'));
  assert.equal(result.culled, 1);
});

test('a tile keeps full brightness at the distance it was measured from', () => {
  const result = select(treeWith([farTile]), [0, 0, 0]);
  assert.equal(result.visible.length, 1);
  assert.equal(result.visible[0].fraction, 1);
  assert.equal(result.visible[0].drawCount, 5000);
});

test('moving away from a tile makes it fade out, then vanish', () => {
  const tree = treeWith([farTile]);
  const lookingBack = (x) => {
    const position = [x, 0, 0];
    const direction = [-1, 0, 0];
    return tree.select({ planes: planesFromCamera({ position, direction }), position, direction });
  };
  const partial = lookingBack(pc(5000));
  const gone = lookingBack(pc(50000));
  assert.ok(
    partial.visible[0] && partial.visible[0].fraction > 0 && partial.visible[0].fraction < 1,
    'partial at 5000 pc',
  );
  assert.equal(gone.culled, 1);
  assert.equal(gone.points, 0);
});

test('an explicit distance limit culls tiles', () => {
  const result = select(treeWith([farTile]), [0, 0, 0], { maxDistanceMetres: pc(1000) });
  assert.equal(result.culled, 1);
  assert.equal(result.points, 0);
});

test('the budget is never exceeded', () => {
  const result = select(treeWith([nearTile, farTile]), [0, 0, 0], { budgetPoints: 1500 });
  assert.ok(result.points <= 1500, `spent ${result.points}`);
  for (const item of result.visible) {
    assert.ok(item.drawCount <= item.count);
    assert.ok(item.stride >= 1);
  }
});

test('stride sampling thins a tile evenly', () => {
  const result = select(treeWith([nearTile]), [0, 0, 0], { budgetPoints: 200 });
  const item = result.visible[0];
  assert.equal(item.drawCount, 200);
  assert.equal(item.stride, Math.floor(item.count / item.drawCount));
});

test('fractionVisible follows the magnitude law', () => {
  const reference = 100;
  const atReference = fractionVisible({
    magRange: [6, 12], distanceMetres: reference, referenceMetres: reference, limit: 12,
  });
  assert.equal(atReference, 1);

  // A hundred times further is ten magnitudes fainter: only the brightest end survives.
  const farAway = fractionVisible({
    magRange: [6, 12], distanceMetres: reference * 100, referenceMetres: reference, limit: 12,
  });
  assert.ok(farAway < 0.05 && farAway >= 0, `fraction ${farAway}`);
});

test('a flat magnitude tile is all or nothing', () => {
  // Seen from ten times further, a G=6 star looks like G=11 and survives the
  // limit of 12; a G=9 star looks like G=14 and does not.
  const bright = fractionVisible({
    magRange: [6, 6], distanceMetres: pc(100), referenceMetres: pc(10), limit: 12,
  });
  const faint = fractionVisible({
    magRange: [9, 9], distanceMetres: pc(100), referenceMetres: pc(10), limit: 12,
  });
  assert.equal(bright, 1);
  assert.equal(faint, 0);
});

test('the view pyramid has the right shape', () => {
  const planes = lookingDownX([0, 0, 0]);
  assert.equal(pointInFrustum(planes, [pc(100), 0, 0]), true);
  assert.equal(pointInFrustum(planes, [pc(100), pc(1000), 0]), false);
  assert.equal(pointInFrustum(planes, [pc(1e12), 0, 0]), true, 'the pyramid has no far plane');
});