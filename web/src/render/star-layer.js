/**
 * Measured stars as additive points of light.
 *
 * Size and brightness come from apparent magnitude, colour from the baked B-V,
 * exactly as `ingest/astro/photometry.py` does, so the tile and the screen agree.
 * The point primitive itself — node material, additive, screen-space size — lives
 * in `point-layer.js`, shared with the nebulosity.
 */

import { colourAt, decodeAllPositions, magnitudeAt } from '../data/tile-reader.js';
import { createAdditivePoints } from './point-layer.js';

const EXPOSURE = 8000; // a magnitude-12 star must read as a faint dot, not black
const FAINT_MAGNITUDE = 12;
const BRIGHT_MAGNITUDE = 0;
const MIN_PIXELS = 1.2;
const MAX_PIXELS = 9;

/** Apparent magnitude to a point size in pixels. */
export function spriteScale(magnitude) {
  if (magnitude === null || Number.isNaN(magnitude)) return MIN_PIXELS;
  const span = Math.max(FAINT_MAGNITUDE - BRIGHT_MAGNITUDE, 1e-6);
  const t = Math.min(Math.max((FAINT_MAGNITUDE - magnitude) / span, 0), 1);
  return MIN_PIXELS + (MAX_PIXELS - MIN_PIXELS) * Math.sqrt(t);
}

/** Apparent magnitude to a linear brightness multiplier. */
export function brightness(magnitude) {
  if (magnitude === null || Number.isNaN(magnitude)) return 0.5 * EXPOSURE;
  return Math.min(Math.pow(10, -0.4 * (magnitude - BRIGHT_MAGNITUDE)) * EXPOSURE, 40);
}

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