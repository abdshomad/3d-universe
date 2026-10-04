/**
 * Figure stars: the naked-eye Hipparcos set the constellation endpoints resolve
 * against.
 *
 * These are measured rows with measured parallaxes, so an endpoint gets the
 * position of the star the figure names. Resolving a figure point against the
 * neighbourhood tile instead — which is what E4 had to do — finds *a* nearby
 * star, and often not the one named.
 */

import { METRES_PER_PC } from '../core/units.js';

/** Sky position to a unit vector, in the frame the renderer uses. */
export function toDirection(raDeg, decDeg) {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/**
 * World positions in metres, flat xyz, ready for the star index.
 * Stars with no usable parallax are refused: an endpoint with no distance would
 * be placed somewhere invented.
 */
export function figureStarPositions(payload) {
  const stars = payload?.stars ?? [];
  const out = new Float64Array(stars.length * 3);
  let kept = 0;
  for (const star of stars) {
    const distancePc = star.distance_pc ?? (star.parallax_mas > 0 ? 1000 / star.parallax_mas : null);
    if (!Number.isFinite(distancePc) || distancePc <= 0) continue;
    const [x, y, z] = toDirection(star.ra, star.dec);
    const metres = distancePc * METRES_PER_PC;
    out[3 * kept] = x * metres;
    out[3 * kept + 1] = y * metres;
    out[3 * kept + 2] = z * metres;
    kept += 1;
  }
  return kept === stars.length ? out : out.subarray(0, kept * 3);
}

/** The citation this set came from, for the ribbon that cites it. */
export function figureCitation(payload) {
  return payload?.citation ?? null;
}
