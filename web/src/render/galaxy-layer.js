/**
 * Galaxies as points: the one primitive this catalogue supports.
 *
 * A galaxy is not a star. It is extended, and its distance is a
 * redshift, not a parallax — the card states the method, and this
 * layer claims nothing it cannot. What the tile carries is measured:
 * the catalogue's own BT brightness keys the size, and its own B-VT
 * colour keys the pixel, through the same B-V language the star
 * layer speaks. A tile without its citation refuses to draw.
 */

import { assertCited } from '../data/relations.js';
import { createAdditivePoints } from './point-layer.js';

/** BT to a point size: RC3's redshift rows span about 8 to 17. */
export function galaxySizeForMag(bt) {
  return Math.max(1.5, Math.min(7, 9 - 0.5 * bt));
}

/** Render-space positions above ~1e22 m fail the software renderer's
  * point pipeline; the catalogue's far side is 768 Mpc = 2.4e25 m. */
const RENDER_SCALE = 1 / 8192;

/**
 * @param {{positions: Float64Array, tile: object}} options
 */
export function createGalaxyLayer({ positions, tile }) {
  assertCited({ citation: tile.header.provenance });

  const count = tile.count;
  const colours = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    // The tile's own colour bytes: the catalogue's B-VT, baked at
    // ingest — not a ramp invented here.
    colours[3 * index] = tile.colours[3 * index] / 255;
    colours[3 * index + 1] = tile.colours[3 * index + 1] / 255;
    colours[3 * index + 2] = tile.colours[3 * index + 2] / 255;
    const bt = tile.magnitudes ? tile.magnitudes[index] / 1000 : 14;
    sizes[index] = galaxySizeForMag(bt);
  }
  // Render-space scale. The catalogue spans 768 Mpc, and the point
  // pipeline of the software renderer — the only renderer this has
  // been measured on — fails its program validation once render-space
  // positions pass roughly 1e22 m. A uniform scale is invisible on
  // screen: the perspective divide cancels it, so every galaxy keeps
  // its true direction, and the floating origin keeps parallax true.
  // Depth is the only thing compressed, and at these distances every
  // galaxy already sits at the far plane, where depth is flat anyway.
  const scaled = new Float64Array(positions.length);
  for (let index = 0; index < positions.length; index += 1) {
    scaled[index] = positions[index] * RENDER_SCALE;
  }
  const layer = createAdditivePoints({
    positions: new Float32Array(scaled),
    colours,
    sizes,
    name: 'galaxies',
  });
  layer.userData.kind = 'galaxy';
  layer.userData.count = count;
  layer.userData.tileId = tile.header.tile_id;
  layer.userData.flag = tile.header.provenance.flag;
  layer.userData.citation = tile.header.provenance;
  layer.userData.tile = tile;
  return layer;
}
