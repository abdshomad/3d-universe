/**
 * Measured stars as additive points of light.
 *
 * The photometry lives in `core/photometry.js`, which is a verified mirror of
 * `ingest/astro/photometry.py`: magnitude to size and brightness, B-V to RGB.
 * This module turns a tile into geometry and hands it to the shared point
 * primitive in `point-layer.js`.
 */

import { colourAt, decodeAllPositions, magnitudeAt } from '../data/tile-reader.js';
import { brightness, spriteScale } from '../core/photometry.js';
import { createAdditivePoints } from './point-layer.js';

/**
 * Build a points object for one tile.
 *
 * `worldPositions` lets the caller decode a tile once and rebase it whenever
 * the floating origin moves, rather than re-decoding every tile per frame.
 *
 * @param {object} tile as returned by readTile
 * @param {{cameraMetres?: number[], stride?: number, drawCount?: number,
 *          gain?: number, worldPositions?: Float64Array|null}} options
 */
export function createStarLayer(tile, {
  cameraMetres = [0, 0, 0],
  stride = 1,
  drawCount,
  gain = 1,
  worldPositions = null,
} = {}) {
  const total = tile.count;
  const count = Math.min(drawCount ?? total, total);
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const decoded = worldPositions ?? decodeAllPositions(tile, cameraMetres);
  for (let slot = 0; slot < count; slot += 1) {
    const source = Math.min(slot * stride, total - 1);
    const magnitude = magnitudeAt(tile, source);
    const colour = colourAt(tile, source);
    const weight = brightness(magnitude) * gain;
    positions[3 * slot] = decoded[3 * source] - cameraMetres[0];
    positions[3 * slot + 1] = decoded[3 * source + 1] - cameraMetres[1];
    positions[3 * slot + 2] = decoded[3 * source + 2] - cameraMetres[2];
    colours[3 * slot] = colour[0] * weight;
    colours[3 * slot + 1] = colour[1] * weight;
    colours[3 * slot + 2] = colour[2] * weight;
    sizes[slot] = spriteScale(magnitude);
  }

  const points = createAdditivePoints({
    positions,
    colours,
    sizes,
    name: `stars:${tile.header.tile_id}`,
  });
  points.userData.tileId = tile.header.tile_id;
  points.userData.provenance = 'MEASURED';
  return points;
}

/** Centre of a tile in metres, for aiming the camera at it. */
export function centroid(tile) {
  const header = tile.header;
  const scale = header.unit === 'pc' ? 3.0856775814913673e16 : 1;
  return {
    x: (header.origin[0] + header.extent[0] / 2) * scale,
    y: (header.origin[1] + header.extent[1] / 2) * scale,
    z: (header.origin[2] + header.extent[2] / 2) * scale,
  };
}