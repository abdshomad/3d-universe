/**
 * Post-processing settings, free of any three.js import.
 *
 * Kept separate from `post.js` so the values can be tested in Node: the module
 * that builds the GPU chain imports `three/tsl` and `three/addons/`, which only
 * resolve through the browser's import map.
 */

export const VOID_COLOUR = 0x05060a;

export const DEFAULT_BLOOM = {
  strength: 0.9,
  radius: 0.6,
  threshold: 0.05,
};

export const VIGNETTE = {
  radius: 0.75,
  strength: 0.45,
};

/** Vignette strength at a normalised distance from the frame centre. */
export function vignetteAt(
  distanceFromCentre,
  { radius = VIGNETTE.radius, strength = VIGNETTE.strength } = {},
) {
  // The tail flattens rather than crushing the corners to black.
  const t = Math.min(distanceFromCentre / radius, 1.2);
  return 1 - strength * t * t;
}