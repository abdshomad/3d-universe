/**
 * The per-kind layers. Each one refuses to draw without its
 * citation, and each answers "measured?" from the tile it
 * was built from — the flag rides on the layer, in O(1),
 * not in a table someone has to keep in their head.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera, Vector3 } from 'three/webgpu';

import { identityAt } from '../src/core/picker.js';
import { UncitedRelationError } from '../src/data/relations.js';
import { createAuLayer, auSizeForMag } from '../src/render/au-layer.js';
import { createGalaxyLayer, galaxySizeForMag } from '../src/render/galaxy-layer.js';
import {
  createBlackHoleMarkers,
  updateBlackHoleMarkers,
} from '../src/render/marker-layer.js';

const CITATION = {
  catalog: 'test.catalog',
  release: '1',
  flag: 'MEASURED',
  query: 'SELECT * FROM test',
  source_url: 'https://example.test/catalog',
  retrieved: '2026-01-01T00:00:00Z',
};

/** A tile a test can predict: two bodies, 100-unit extent. */
function tile({ unit = 'au', kind = 'comet', count = 2 } = {}) {
  return {
    header: {
      tile_id: `test-${unit}-${kind ?? 'legacy'}`,
      unit,
      count,
      origin: [0, 0, 0],
      extent: [100, 100, 100],
      provenance: { ...CITATION },
      extra: kind ? { dataset_kind: kind } : {},
    },
    ids: [1n, 2n].slice(0, count),
    positions: new Uint16Array(count * 3),
    magnitudes: [12000, 15000].slice(0, count),
    colours: new Uint8Array([200, 180, 160, 190, 170, 150].slice(0, count * 3)),
    count,
  };
}

const POSITIONS = new Float64Array([0, 0, 0, 1e11, 1e11, 1e11]);

/** Float32 colour bytes are not float64 values: compare
  * within the width of the storage, not exactly. */
const nearly = (actual, expected) => Math.abs(actual - expected) < 1e-6;

test('an au layer carries its kind, its colour and its flag', () => {
  const layer = createAuLayer({ positions: POSITIONS, tile: tile({ kind: 'comet' }), kind: 'comet' });
  assert.equal(layer.userData.kind, 'comet');
  assert.equal(layer.userData.flag, 'MEASURED');
  assert.equal(layer.userData.count, 2);
  const colours = layer.geometry.getAttribute('color').array;
  assert.ok(
    nearly(colours[0], 0.55) && nearly(colours[1], 0.9) && nearly(colours[2], 0.95),
    'the kind\'s own colour',
  );
});

test('an au layer without its citation refuses to draw', () => {
  const uncited = tile({ kind: 'planet' });
  uncited.header.provenance = undefined;
  assert.throws(
    () => createAuLayer({ positions: POSITIONS, tile: uncited, kind: 'planet' }),
    UncitedRelationError,
  );
});

test('the au size law keys on apparent magnitude', () => {
  assert.equal(auSizeForMag(0), 8, 'a bright body is the largest point');
  assert.equal(auSizeForMag(20), 2, 'a faint body is the smallest');
  assert.ok(auSizeForMag(10) > auSizeForMag(15), 'brighter means larger, always');
});

test('the galaxy layer reads the tile\'s own colour bytes', () => {
  const galaxyTile = tile({ unit: 'pc', kind: 'galaxy' });
  const layer = createGalaxyLayer({ positions: POSITIONS, tile: galaxyTile });
  assert.equal(layer.userData.kind, 'galaxy');
  assert.equal(layer.userData.flag, 'MEASURED');
  const colours = layer.geometry.getAttribute('color').array;
  assert.ok(nearly(colours[0], galaxyTile.colours[0] / 255), 'the tile\'s own B-VT');
  assert.ok(nearly(colours[1], galaxyTile.colours[1] / 255));
});

test('the galaxy layer without its citation refuses to draw', () => {
  const uncited = tile({ unit: 'pc', kind: 'galaxy' });
  uncited.header.provenance = undefined;
  assert.throws(
    () => createGalaxyLayer({ positions: POSITIONS, tile: uncited }),
    UncitedRelationError,
  );
});

test('the galaxy size law keys on BT', () => {
  assert.equal(galaxySizeForMag(8), 5);
  assert.equal(galaxySizeForMag(20), 1.5, 'the faintest galaxy is still a point');
  assert.ok(galaxySizeForMag(10) > galaxySizeForMag(15));
});

test('one ring per placed row, and none for a row the tile cannot name', () => {
  const bhTile = tile({ unit: 'pc', kind: 'black_hole' });
  const rows = new Map([['1', { recno: '1', name: 'A' }]]);
  const markers = createBlackHoleMarkers({
    tile: bhTile, positions: POSITIONS, rows, citation: CITATION,
  });
  assert.equal(markers.length, 1, 'a marker without its row is not drawn');
  assert.equal(markers[0].userData.kind, 'black_hole');
  assert.deepEqual(markers[0].userData.row, rows.get('1'));
  assert.equal(markers[0].userData.tileIndex, 0);
});

test('a marker layer without its citation refuses to draw', () => {
  const bhTile = tile({ unit: 'pc', kind: 'black_hole' });
  const rows = new Map([['1', { recno: '1', name: 'A' }]]);
  assert.throws(
    () => createBlackHoleMarkers({ tile: bhTile, positions: POSITIONS, rows }),
    UncitedRelationError,
  );
});

test('a marker faces the camera and holds its angular size', () => {
  const bhTile = tile({ unit: 'pc', kind: 'black_hole' });
  const rows = new Map([
    ['1', { recno: '1', name: 'near' }],
    ['2', { recno: '2', name: 'far' }],
  ]);
  // One body a metre away, one ten metres away: the near
  // ring must be the smaller one to hold the same angle.
  const near = new Float64Array([1, 0, 0, 10, 0, 0]);
  const markers = createBlackHoleMarkers({
    tile: bhTile, positions: near, rows, citation: CITATION,
  });
  const camera = new PerspectiveCamera(60, 1, 0.1, 1e12);
  camera.position.set(0, 0, 0);
  updateBlackHoleMarkers(markers, camera, { fovDegrees: 60, viewportHeight: 800 });
  const [first, second] = markers;
  assert.ok(first.scale.x > 0, 'the ring has a size');
  assert.ok(first.scale.x < second.scale.x, 'the nearer ring is the smaller one');
  const facing = new Vector3();
  first.getWorldDirection(facing);
  assert.ok(Math.abs(facing.x + 1) < 1e-6, 'the ring faces the camera');
});

test('identity names the tile\'s dataset kind', () => {
  const planet = identityAt({ tile: tile({ kind: 'planet' }), index: 0 });
  assert.equal(planet.kind, 'planet');
  const legacy = identityAt({ tile: tile({ kind: null }), index: 0 });
  assert.equal(legacy.kind, 'small_body', 'a tile from before kinds existed');
  const star = identityAt({ tile: tile({ unit: 'pc', kind: null }), index: 0 });
  assert.equal(star.kind, 'star');
});
