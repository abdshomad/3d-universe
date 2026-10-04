/**
 * The modelled large-scale tier: additive, flagged, and never claiming to be data.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_THRESHOLD,
  MPC_METRES,
  angularCellSize,
  fadeForView,
  levelForView,
  cellBrightness,
  cellPosition,
  createLssLayer,
  parseField,
} from '../src/render/lss-layer.js';

const GRID = 4;

function header(flag = 'SIMULATED') {
  return {
    grid: GRID,
    radius_mpc: 500,
    cell_mpc: 1000 / GRID,
    quantise: { floor: 0.35, ceiling: 4.5, max: 255 },
    dataset: {
      flag,
      honesty: 'a model, not a survey map',
      science_reference: 'DESI DR1, arXiv:2503.14745',
    },
  };
}

const cube = (values) => new Uint8Array(values).buffer;
const ramp = () => Array.from({ length: GRID ** 3 }, (_, i) => (i * 7) % 256);

test('a field that does not declare itself simulated is refused', () => {
  assert.throws(() => parseField(header('MEASURED'), cube(ramp())), /must be flagged SIMULATED/);
  assert.throws(() => parseField(header('SURVEY'), cube(ramp())), /must be flagged SIMULATED/);
});

test('a cube of the wrong size is refused', () => {
  assert.throws(() => parseField(header(), new ArrayBuffer(10)), /expected 64/);
  assert.ok(parseField(header(), cube(ramp())));
});

test('cells are centred on the origin and the layer stays inside the radius', () => {
  const field = parseField(header(), cube(ramp()));
  const centre = cellPosition(field, Math.floor(GRID ** 3 / 2));
  for (const axis of centre) assert.ok(Math.abs(axis) < field.radiusMpc * MPC_METRES);

  // A coarse cube has corners outside a ball; the tier must not draw them.
  const radius = field.radiusMpc * MPC_METRES;
  for (const layer of [createLssLayer(field, { threshold: 0 })]) {
    const positions = layer.geometry.getAttribute('position').array;
    for (let i = 0; i < positions.length; i += 3) {
      assert.ok(Math.hypot(positions[i], positions[i + 1], positions[i + 2]) <= radius + 1,
        'a cell escaped the horizon');
    }
  }
});

test('brightness rises with density, and nothing below the threshold glows', () => {
  assert.equal(cellBrightness(119, DEFAULT_THRESHOLD), 0);
  assert.ok(cellBrightness(255, DEFAULT_THRESHOLD) > cellBrightness(180, DEFAULT_THRESHOLD));
  assert.ok(cellBrightness(200, 200) < cellBrightness(200, 120), 'a thin window dims');
});

test('a higher threshold keeps fewer cells', () => {
  const field = parseField(header(), cube(ramp()));
  const low = createLssLayer(field, { threshold: 40, maxCells: 100000 });
  const high = createLssLayer(field, { threshold: 200, maxCells: 100000 });
  assert.ok(low.userData.pointCount > high.userData.pointCount);
});

test('the layer carries its flag and its science reference', () => {
  const field = parseField(header(), cube(ramp()));
  const layer = createLssLayer(field, { threshold: 40 });
  assert.equal(layer.userData.flag, 'SIMULATED');
  assert.match(layer.userData.scienceReference, /arXiv:2503\.14745/);
  assert.match(layer.userData.honesty, /not a survey map/);
  assert.equal(layer.name, 'lss-field');
});

test('an empty field draws nothing rather than a black wall', () => {
  const field = parseField(header(), cube(new Array(GRID ** 3).fill(0)));
  const layer = createLssLayer(field, { threshold: 40 });
  assert.equal(layer.userData.pointCount, 0);
});

test('the cell budget is honoured', () => {
  const field = parseField(header(), cube(ramp()));
  const layer = createLssLayer(field, { threshold: 0, maxCells: 25 });
  assert.ok(layer.userData.pointCount <= 25);
});

test('a coarse level keeps one cell in eight', () => {
  const field = parseField(header(), cube(ramp()));
  const fine = createLssLayer(field, { threshold: 0, stride: 1, maxCells: 100000 });
  const coarse = createLssLayer(field, { threshold: 0, stride: 2, maxCells: 100000 });
  const ratio = fine.userData.pointCount / coarse.userData.pointCount;
  assert.ok(ratio > 6 && ratio < 9, `expected about 8x, got ${ratio.toFixed(2)}x`);
});

test('level follows how large a cell looks, not a magic distance', () => {
  const field = parseField(header(), cube(ramp()));
  field.cellMpc = 10; // survey-scale cells; the fixture's 4-cell grid is coarse
  assert.equal(levelForView(field, 2 * MPC_METRES), 1, 'a nearby cell earns the fine level');
  assert.equal(levelForView(field, 5000 * MPC_METRES), 2, 'a distant cell earns the coarse one');
  assert.ok(angularCellSize(field, 2 * MPC_METRES) > angularCellSize(field, 5000 * MPC_METRES));
});

test('the seam fades rather than switches', () => {
  assert.equal(fadeForView(0.5 * MPC_METRES), 0, 'hidden inside the measured zone');
  assert.equal(fadeForView(50 * MPC_METRES), 1, 'fully present well outside it');
  const mid = fadeForView(4.5 * MPC_METRES);
  assert.ok(mid > 0 && mid < 1, `mid-band should be partial, got ${mid}`);
  const earlier = fadeForView(2 * MPC_METRES);
  assert.ok(earlier < mid, 'and it must rise with distance');
});

test('opacity reaches the material', () => {
  const field = parseField(header(), cube(ramp()));
  const layer = createLssLayer(field, { threshold: 40, opacity: 0.42 });
  assert.equal(layer.material.opacity, 0.42);
  assert.equal(layer.userData.opacity, 0.42);
});
