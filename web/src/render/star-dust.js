/**
 * Star dust: the sky between the catalogue stars.
 *
 * Gaia gives us named, measured objects. The sky is mostly things it did not
 * resolve — faint field stars, distant blends, the unresolved granularity the
 * reference frames are made of. That is what these layers draw, and they say so:
 * `provenance: UNRESOLVED`. Dust is never presented as measurement, and a fact
 * card about it would have to admit there is nothing behind it.
 *
 * Two layers, because one size reads as wallpaper:
 *   far  — 1 px points, many of them, filling the shell. This is depth.
 *   near — larger soft sprites, fewer of them, closer in. This is granularity.
 *
 * Both are fixed by seed, so the sky is the same on every machine.
 */

import { mulberry32 } from '../core/noise.js';
import { createAdditivePoints } from './point-layer.js';

export const UNRESOLVED = 'UNRESOLVED';

export const DUST_LAYERS = [
  { name: 'far', share: 0.72, sizeRange: [1.0, 1.4], gain: 0.85 },
  { name: 'near', share: 0.28, sizeRange: [3.0, 9.0], gain: 0.6 },
];

/**
 * @param {{innerRadiusMetres: number, outerRadiusMetres: number, count?: number,
 *          seed?: number, cameraMetres?: number[], layers?: typeof DUST_LAYERS}} options
 */
export function createStarDust({
  innerRadiusMetres,
  outerRadiusMetres,
  count = 60000,
  seed = 20261004,
  cameraMetres = [0, 0, 0],
  layers = DUST_LAYERS,
}) {
  if (!(outerRadiusMetres > innerRadiusMetres)) {
    throw new RangeError('outerRadiusMetres must exceed innerRadiusMetres');
  }

  const random = mulberry32(seed);
  const built = [];

  for (const layer of layers) {
    const layerCount = Math.round(count * layer.share);
    const positions = [];
    const colours = [];
    const sizes = [];
    const [minSize, maxSize] = layer.sizeRange;

    for (let i = 0; i < layerCount; i += 1) {
      // Square root keeps the shell evenly filled per unit distance; a cube root
      // would crowd everything against the camera.
      const radius = innerRadiusMetres
        + (outerRadiusMetres - innerRadiusMetres) * Math.sqrt(random());
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      // Near dust must not outshine measured stars, so it dims with distance.
      const falloff = Math.min(innerRadiusMetres / (innerRadiusMetres + radius), 1);
      const weight = layer.gain * (0.35 + 0.65 * falloff);
      const t = random();

      positions.push(x - cameraMetres[0], y - cameraMetres[1], z - cameraMetres[2]);
      colours.push(weight * 0.82, weight * 0.86, weight);
      sizes.push(minSize + (maxSize - minSize) * t);
    }

    const points = createAdditivePoints({
      positions: new Float32Array(positions),
      colours: new Float32Array(colours),
      sizes: new Float32Array(sizes),
      name: `star-dust:${layer.name}`,
    });
    points.userData.provenance = UNRESOLVED;
    points.userData.layer = layer.name;
    built.push(points);
  }

  return built;
}