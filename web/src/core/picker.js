/**
 * Picking: turning a click into a catalogue identity.
 *
 * Everything here is pure. The raycast itself belongs to three.js and to the
 * scene, but the decisions worth testing — is this a click or a drag, which hit
 * wins, and what a hit *is* — do not need a GPU and must not go untested.
 */

import { METRES_PER_AU, METRES_PER_PC } from './units.js';

const UNIT_METRES = { pc: METRES_PER_PC, au: METRES_PER_AU, m: 1 };

/** A drag is a camera move, not a click. */
export function isClick(down, up, { maxPixels = 6, maxMs = 500 } = {}) {
  if (!down || !up) return false;
  if (up.time - down.time > maxMs) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) <= maxPixels;
}

/**
 * The nearest hit we can actually name. Points are raycast with a depth-scaled
 * threshold, so `distance` is the honest ranking: a nearer spark is the one the
 * viewer aimed at.
 */
export function pickFromHits(hits, { tileId = null } = {}) {
  let best = null;
  for (const hit of hits) {
    if (tileId && hit.tileId !== tileId) continue; // not this tile: unnameable
    if (hit.index === undefined || hit.index < 0) continue; // no vertex, no identity
    if (!best || hit.distance < best.distance) best = hit;
  }
  return best;
}

/** Decode one position into metres, relative to `originMetres`. */
export function positionAt(tile, index, originMetres) {
  const scale = UNIT_METRES[tile.header.unit];
  if (!scale) throw new RangeError(`unsupported unit ${tile.header.unit}`);
  return [0, 1, 2].map((axis) => tile.header.origin[axis] * scale
    + ((tile.positions[3 * index + axis] / 65535) * tile.header.extent[axis] * scale)
    - originMetres[axis]);
}

/**
 * What a hit is: the same fields the search path produces, so a click and a
 * typed name resolve to one identity rather than two.
 * @param {{tile: object, index: number, originMetres?: number[]}} target
 */
export function identityAt({ tile, index, originMetres = [0, 0, 0] }) {
  if (!tile || index < 0 || index >= tile.count) return null;
  const raw = tile.ids?.[index];
  if (raw === undefined || raw === null) return null;
  const metres = Math.hypot(...positionAt(tile, index, originMetres));
  return {
    kind: 'star',
    id: raw.toString(),
    pointIndex: index,
    distancePc: metres / METRES_PER_PC,
    magnitude: tile.magnitudes ? tile.magnitudes[index] / 1000 : null,
    colorIndex: null,
    provenance: `${tile.header.provenance.catalog} ${tile.header.provenance.release} · U3DTILE2 · measured`,
  };
}

/**
 * What a clicked cell is: a quantised value in a seeded random field.
 *
 * Deliberately not "an overdensity" or "a void" — those are units that imply a
 * survey found something. This is one number from a generator, and the card says
 * exactly that.
 */
export function cellIdentity({ field, cellIndex }) {
  if (!field || !Number.isInteger(cellIndex)) return null;
  if (cellIndex < 0 || cellIndex >= field.cells.length) return null;

  const grid = field.grid;
  const side = Math.floor(cellIndex / (grid * grid));
  const row = Math.floor(cellIndex / grid) % grid;
  const column = cellIndex % grid;
  const quantised = field.cells[cellIndex];

  return {
    kind: 'field',
    // Every selection carries an id, so a picked cell can be shared and exported
    // the same way a star can.
    id: `lss:${cellIndex}`,
    name: 'Large-scale structure',
    radiusMpc: field.radiusMpc,
    cellMpc: field.cellMpc,
    grid: field.grid,
    seed: field.seed,
    flag: field.flag,
    provenance: `generated · ${field.flag} · ${field.scienceReference} is the science reference, not the source`,
    cell: {
      index: cellIndex,
      x: column,
      y: row,
      z: side,
      quantised,
      floor: field.quantise?.floor ?? null,
      ceiling: field.quantise?.ceiling ?? null,
      method: field.method ?? null,
    },
  };
}

/**
 * The cell drawn nearest the click, in pixels.
 *
 * A world-space ray threshold is the wrong tool here: the tier draws one point
 * per 10 Mpc cell across a 500 Mpc ball, so any threshold tight enough to be
 * honest misses almost every click and any threshold that hits picks the wrong
 * neighbour. Screen space is where "you pointed at that one" is a question with
 * a real answer.
 *
 * @param {Float64Array|number[]} projected flat x,y,z triples in NDC, z in [-1,1]
 * @param {{x: number, y: number}} clickNdc
 */
export function nearestCellOnScreen(projected, clickNdc, { width, height, maxPixels = 16 } = {}) {
  let best = -1;
  let bestPixels = Infinity;
  for (let i = 0; i < projected.length / 3; i += 1) {
    const z = projected[3 * i + 2];
    if (z < -1 || z > 1) continue; // behind the camera, or past the far plane
    const dx = ((projected[3 * i] - clickNdc.x) * width) / 2;
    const dy = ((projected[3 * i + 1] - clickNdc.y) * height) / 2;
    const pixels = Math.hypot(dx, dy);
    if (pixels < bestPixels) {
      bestPixels = pixels;
      best = i;
    }
  }
  if (best < 0 || bestPixels > maxPixels) return null;
  return { index: best, pixels: bestPixels };
}
