/**
 * Magnitude to brightness, and colour index to RGB — a mirror of
 * `ingest/astro/photometry.py`.
 *
 * The tile stores magnitudes and B-V; this is what turns them into light. The
 * two implementations must agree to the last bit, so `photometry.test.mjs`
 * runs the Python side and compares. Drift here means a star looks different
 * from the value the catalog recorded.
 *
 * Display exposure lives here too: physical flux alone puts a magnitude-12
 * star at 1.6e-5, which is black on any screen.
 */

export const MAGNITUDE_ZERO_POINT_FLUX = 1;
export const FAINT_MAGNITUDE = 12;
export const BRIGHT_MAGNITUDE = 0;
export const MIN_PIXELS = 0.9;
export const MAX_PIXELS = 9;
export const EXPOSURE = 8000;
export const MAX_BRIGHTNESS = 40;
export const NEUTRAL_COLOUR = [0.8, 0.82, 0.86];

const isMissing = (value) => value === null || value === undefined || Number.isNaN(value);

/** Relative flux against a reference magnitude. */
export function fluxRatio(magnitude, referenceMagnitude = 0) {
  if (isMissing(magnitude)) return null;
  return MAGNITUDE_ZERO_POINT_FLUX * 10 ** (-0.4 * (magnitude - referenceMagnitude));
}

/** Point size in pixels: magnitudes run backwards, pixels do not. */
export function spriteScale(magnitude, {
  faintMagnitude = FAINT_MAGNITUDE,
  brightMagnitude = BRIGHT_MAGNITUDE,
  minPixels = MIN_PIXELS,
  maxPixels = MAX_PIXELS,
} = {}) {
  if (isMissing(magnitude)) return minPixels;
  const span = Math.max(faintMagnitude - brightMagnitude, 1e-6);
  const t = Math.min(Math.max((faintMagnitude - magnitude) / span, 0), 1);
  return minPixels + (maxPixels - minPixels) * Math.sqrt(t);
}

/** Apparent magnitude to a linear display brightness. */
export function brightness(magnitude) {
  if (isMissing(magnitude)) return 0.5 * EXPOSURE;
  return Math.min(10 ** (-0.4 * (magnitude - BRIGHT_MAGNITUDE)) * EXPOSURE, MAX_BRIGHTNESS);
}

/** Effective temperature from B-V, via the Ballesteros relation. */
export function temperatureK(colorIndex) {
  if (isMissing(colorIndex)) return null;
  let bv = Number(colorIndex);
  if (bv <= -0.4 || bv >= 2.0) bv = Math.min(Math.max(bv, -0.4), 2.0);
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Blackbody colour in sRGB, gamma-space approximation: it drives sprites, not photometry. */
export function temperatureToRgb(temperature) {
  const t = Math.min(Math.max(temperature, 1000), 40000) / 100;
  let red;
  let green;
  let blue;
  if (t <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(t) - 161.1195681661;
    blue = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * (t - 60) ** -0.1332047592;
    green = 288.1221695283 * (t - 60) ** -0.0755148492;
    blue = 255;
  }
  return [red, green, blue].map((channel) => Math.min(Math.max(channel, 0), 255) / 255);
}

/** B-V straight to sRGB, with a neutral fallback when the colour is unknown. */
export function colorToRgb(colorIndex) {
  const temperature = temperatureK(colorIndex);
  return temperature === null ? [...NEUTRAL_COLOUR] : temperatureToRgb(temperature);
}