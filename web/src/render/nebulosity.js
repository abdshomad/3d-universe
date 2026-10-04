/**
 * Nebulosity: low-frequency 3D noise, additive, on a near-black floor.
 *
 * Placed as a dense field of soft points rather than a raymarched volume: the
 * medium has to read as luminous dust at 60 fps on hardware we have not measured
 * yet, and points cost what the star field already costs. Where the noise is
 * faint nothing is drawn at all, so the cloud has holes instead of a wash.
 *
 * Placement is deterministic — same seed, same cloud — so two machines show the
 * same sky and a screenshot can be cited.
 */

import { fbm3, mulberry32 } from '../core/noise.js';
import { createAdditivePoints } from './point-layer.js';

const DEFAULTS = {
  count: 40000,
  seed: 20261004,
  frequency: 1.2,
  gamma: 2.2,
  threshold: 0.34,
  gain: 0.45,
  colour: [0.62, 0.58, 0.86],
  sizeRange: [1.6, 7.0],
  cameraMetres: [0, 0, 0],
};

/**
 * @param {{radiusMetres: number, count?: number, seed?: number, frequency?: number,
 *          gamma?: number, threshold?: number, gain?: number, colour?: number[],
 *          sizeRange?: number[], cameraMetres?: number[]}} options
 */
export function createNebulosity({
  radiusMetres,
  count = DEFAULTS.count,
  seed = DEFAULTS.seed,
  frequency = DEFAULTS.frequency,
  gamma = DEFAULTS.gamma,
  threshold = DEFAULTS.threshold,
  gain = DEFAULTS.gain,
  colour = DEFAULTS.colour,
  sizeRange = DEFAULTS.sizeRange,
  cameraMetres = DEFAULTS.cameraMetres,
}) {
  if (!(radiusMetres > 0)) throw new RangeError('radiusMetres must be positive');

  const random = mulberry32(seed);
  const positions = [];
  const colours = [];
  const sizes = [];

  for (let i = 0; i < count; i += 1) {
    // Uniform in the ball: the cube root keeps density even instead of piling
    // blobs at the centre.
    const radius = radiusMetres * Math.cbrt(random());
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    const density = fbm3(x * frequency, y * frequency, z * frequency, { seed });
    if (density < threshold) continue;

    const weight = ((density - threshold) / (1 - threshold)) ** gamma;
    positions.push(x - cameraMetres[0], y - cameraMetres[1], z - cameraMetres[2]);
    colours.push(weight * gain * colour[0], weight * gain * colour[1], weight * gain * colour[2]);
    sizes.push(sizeRange[0] + (sizeRange[1] - sizeRange[0]) * weight);
  }

  const layer = createAdditivePoints({
    positions: new Float32Array(positions),
    colours: new Float32Array(colours),
    sizes: new Float32Array(sizes),
    name: `nebulosity:${seed}`,
  });
  layer.userData.considered = count;
  layer.userData.kept = sizes.length;
  layer.userData.seed = seed;
  layer.userData.radiusMetres = radiusMetres;
  return layer;
}