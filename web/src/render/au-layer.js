/**
 * The solar-system point primitive, shared by every AU-quantized
 * kind: small bodies, comets, planets and satellites.
 *
 * These bodies shine by reflected sunlight, so a blackbody ramp
 * would lie — a colour temperature is a property these surfaces do
 * not have. Each kind is one flat colour, chosen so the kinds stay
 * distinguishable on screen; the size keys on the apparent magnitude
 * the tile carries, which is measured.
 */

import { assertCited } from '../data/relations.js';
import { createAdditivePoints } from './point-layer.js';

export const AU_KINDS = {
  small_body: { colour: [1.0, 0.69, 0.12], label: 'small body' },
  comet: { colour: [0.55, 0.9, 0.95], label: 'comet' },
  planet: { colour: [0.95, 0.82, 0.58], label: 'planet' },
  satellite: { colour: [0.62, 0.72, 0.88], label: 'satellite' },
};

/**
 * Size from the apparent magnitude the tile carries: a rendering
 * choice keyed to a measured brightness, not an invented angular
 * diameter. The faintest body is still a point, never a dot that
 * reads as zero.
 */
export function auSizeForMag(apparent) {
  return Math.max(2, Math.min(8, 10 - 0.6 * apparent));
}

/**
 * One AU-tier layer.
 *
 * The provenance is the layer's flag: every row in a tile came from
 * one query against one catalogue, so the header's provenance block
 * answers "measured?" for every point in the layer, in O(1) — and a
 * tile without its citation refuses to draw at all.
 *
 * @param {{positions: Float64Array, tile: object, kind: string}} options
 */
export function createAuLayer({ positions, tile, kind }) {
  const style = AU_KINDS[kind];
  if (!style) throw new RangeError(`no au kind ${kind}`);
  assertCited({ citation: tile.header.provenance });

  const count = tile.count;
  const colours = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    colours.set(style.colour, 3 * index);
    const apparent = tile.magnitudes ? tile.magnitudes[index] / 1000 : 12;
    sizes[index] = auSizeForMag(apparent);
  }
  // The decoder hands back float64 for precision on the
  // way here; the GPU uploads float32, so the conversion
  // happens at the attribute, not at every caller.
  const layer = createAdditivePoints({
    positions: new Float32Array(positions),
    colours,
    sizes,
    name: `au:${kind}`,
  });
  layer.userData.kind = kind;
  layer.userData.label = style.label;
  layer.userData.count = count;
  layer.userData.tileId = tile.header.tile_id;
  layer.userData.flag = tile.header.provenance.flag;
  layer.userData.citation = tile.header.provenance;
  layer.userData.tile = tile;
  return layer;
}
