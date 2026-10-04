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
