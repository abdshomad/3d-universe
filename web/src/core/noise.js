/**
 * Deterministic 3D value noise.
 *
 * Nebulosity is a function of position, so it must be the same function on
 * every machine and every run: no Math.random anywhere, no dependence on load
 * order. Integer hashing keeps it reproducible across sessions and browsers.
 */

const UINT32 = 4294967296;

function hashInteger(x, y, z, seed) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d) >>> 0;
  h = Math.imul(h ^ (y | 0), 0x165667b1) >>> 0;
  h = Math.imul(h ^ (z | 0), 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Hash a lattice point to a value in [0, 1). */
export function hash3(x, y, z, seed = 0) {
  return hashInteger(Math.floor(x), Math.floor(y), Math.floor(z), seed) / UINT32;
}

/** Smoothstep, the classic interpolant for value noise. */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Value noise at a point, in [0, 1). */
export function valueNoise3(x, y, z, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);

  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);

  const x00 = c000 + (c100 - c000) * xf;
  const x10 = c010 + (c110 - c010) * xf;
  const x01 = c001 + (c101 - c001) * xf;
  const x11 = c011 + (c111 - c011) * xf;
  const y0 = x00 + (x10 - x00) * yf;
  const y1 = x01 + (x11 - x01) * yf;
  return y0 + (y1 - y0) * zf;
}

/**
 * Fractal sum: octaves of noise at doubling frequency and halving amplitude.
 * @returns {number} in [0, 1]
 */
export function fbm3(x, y, z, { octaves = 4, lacunarity = 2, gain = 0.5, seed = 0 } = {}) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * valueNoise3(x * frequency, y * frequency, z * frequency, seed + octave);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Seeded pseudo-random stream: same seed, same sequence, everywhere. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}