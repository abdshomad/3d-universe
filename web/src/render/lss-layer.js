/**
 * The modelled large-scale tier.
 *
 * It is a **model**, flagged `SIMULATED` end to end, and its card says so. The
 * geometry is additive points on a coarse grid — the same language as the star
 * field — so the seam between measured stars and modelled structure carries no
 * special case: brightness is density², which makes filaments and sheets glow and
 * leaves voids empty without drawing anything "on top".
 */

import { createAdditivePoints } from './point-layer.js';

// One megaparsec in metres: a million parsecs, each 3.0857e16 m.
export const MPC_METRES = 3.0856775814913673e22;
export const DEFAULT_THRESHOLD = 120;
export const DEFAULT_GAIN = 0.55;
const MIN_PIXELS = 1.1;
const MAX_PIXELS = 4.2;

/**
 * Parse the field header and cube.
 * @param {object} header as written by ingest's lss_field
 * @param {ArrayBuffer} cube raw quantised densities
 */
export function parseField(header, cube) {
  if (!header?.grid || !header?.radius_mpc || typeof header?.quantise?.max !== 'number') {
    throw new RangeError('field header is missing its shape');
  }
  const expected = header.grid ** 3;
  if (cube.byteLength !== expected) {
    throw new RangeError(`field cube is ${cube.byteLength} bytes, expected ${expected}`);
  }
  const flag = header.dataset?.flag;
  if (flag !== 'SIMULATED') {
    // A tier that claims to be measured without proof is the one failure this
    // project cannot have.
    throw new RangeError(`field must be flagged SIMULATED, got ${flag}`);
  }
  return {
    header,
    cells: new Uint8Array(cube),
    grid: header.grid,
    radiusMpc: header.radius_mpc,
    cellMpc: header.cell_mpc,
    flag,
    seed: header.dataset?.seed,
    method: header.dataset?.method,
    quantise: header.quantise,
    scienceReference: header.dataset.science_reference,
  };
}

/** Centre of a cell, in metres, relative to the scene origin. */
export function cellPosition(field, index, originMetres = [0, 0, 0]) {
  const { grid, cellMpc } = field;
  const side = Math.floor(index / (grid * grid));
  const row = Math.floor(index / grid) % grid;
  const column = index % grid;
  const offset = (grid - 1) / 2;
  const step = cellMpc * MPC_METRES;
  return [
    (column - offset) * step - originMetres[0],
    (row - offset) * step - originMetres[1],
    (side - offset) * step - originMetres[2],
  ];
}

/** Relative brightness of a cell: density², so only real over-density glows. */
export function cellBrightness(quantised, threshold, gain = DEFAULT_GAIN) {
  const span = Math.max(255 - threshold, 1);
  const excess = Math.max(quantised - threshold, 0) / span;
  return excess * excess * gain;
}

/** Angular size of one cell as seen from `cameraRadiusMetres`, in radians. */
export function angularCellSize(field, cameraRadiusMetres) {
  const cell = field.cellMpc * MPC_METRES;
  return cell / Math.max(cameraRadiusMetres, cell);
}

/**
 * Which level of detail the view earns: 1 is every cell, 2 samples one in
 * eight. Chosen by how large a cell looks, not by a magic distance.
 */
export function levelForView(field, cameraRadiusMetres, { fineCellRadians = 0.01 } = {}) {
  // A cell large on screen means we are close enough for its detail to matter.
  return angularCellSize(field, cameraRadiusMetres) >= fineCellRadians ? 1 : 2;
}

/**
 * Seam fade between the measured-star zone and the modelled zone, 0 to 1.
 * Ramps over a band rather than switching, so crossing it cannot pop.
 */
export function fadeForView(cameraRadiusMetres, { fadeStartMpc = 1, fadeEndMpc = 8 } = {}) {
  const mpc = cameraRadiusMetres / MPC_METRES;
  if (mpc <= fadeStartMpc) return 0;
  if (mpc >= fadeEndMpc) return 1;
  const t = (mpc - fadeStartMpc) / (fadeEndMpc - fadeStartMpc);
  return t * t * (3 - 2 * t); // smoothstep
}

/** Is this cell part of a stride-sampled level? */
export function isSampledCell(field, index, stride) {
  if (stride <= 1) return true;
  const grid = field.grid;
  const side = Math.floor(index / (grid * grid));
  const row = Math.floor(index / grid) % grid;
  const column = index % grid;
  return side % stride === 0 && row % stride === 0 && column % stride === 0;
}

/**
 * Build the drawable layer.
 * @param {object} field as returned by parseField
 * @param {{threshold?: number, gain?: number, originMetres?: number[],
 *          maxCells?: number, stride?: number, opacity?: number}} options
 */
export function createLssLayer(field, {
  threshold = DEFAULT_THRESHOLD,
  gain = DEFAULT_GAIN,
  originMetres = [0, 0, 0],
  maxCells = 120000,
  stride = 1,
  opacity = 1,
} = {}) {
  const positions = [];
  const colours = [];
  const sizes = [];
  const kept = [];

  for (let index = 0; index < field.cells.length && kept.length < maxCells; index += 1) {
    const quantised = field.cells[index];
    if (quantised < threshold || !isSampledCell(field, index, stride)) continue;
    const [x, y, z] = cellPosition(field, index, originMetres);
    // The cube's corners fall outside a ball of radius_mpc: the tier is a ball,
    // and a corner filament would stick out past the horizon it declares.
    if (Math.hypot(x, y, z) > field.radiusMpc * MPC_METRES) continue;
    kept.push(index);
    const weight = cellBrightness(quantised, threshold, gain);
    positions.push(x, y, z);
    // Dense regions run slightly blue-white, like the brightest star cores.
    colours.push(weight * 0.82, weight * 0.88, weight);
    sizes.push(MIN_PIXELS + (MAX_PIXELS - MIN_PIXELS) * Math.min(weight, 1));
  }

  const layer = createAdditivePoints({
    positions: new Float32Array(positions),
    colours: new Float32Array(colours),
    sizes: new Float32Array(sizes),
    name: 'lss-field',
  });
  layer.material.opacity = opacity;
  layer.userData = {
    ...layer.userData,
    flag: field.flag,
    threshold,
    stride,
    opacity,
    // The geometry is compacted to the cells worth drawing, so a vertex index
    // is not a field index. A pick needs the way back.
    cellIndices: kept,
    quantise: field.quantise,
    scienceReference: field.scienceReference,
    radiusMpc: field.radiusMpc,
    honesty: field.header.dataset.honesty,
  };
  return layer;
}
