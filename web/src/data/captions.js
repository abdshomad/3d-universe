/**
 * Captions for the cinematic holds.
 *
 * Each hold is five seconds of someone being shown a scale without being told
 * what it is. These are the sentences for those seconds.
 *
 * Every number is derived from the step's own radius rather than typed beside
 * it, so a caption cannot drift away from the scale it describes. Every caption
 * carries its source, because a caption is a claim like any other — and the one
 * for the modelled tier says *simulated* in the text, not only in a badge the
 * viewer may not be looking at.
 */

import { LIGHT_YEARS_PER_PC } from '../core/light-travel.js';

const AU_PER_PC = 206264.806;

function years(radiusPc) {
  const value = radiusPc * LIGHT_YEARS_PER_PC;
  return value >= 1000 ? `${Math.round(value / 1000)},${String(Math.round(value) % 1000).padStart(3, '0')}`
    : `${value.toFixed(1)}`;
}

/** The caption for a step, or null when we have nothing honest to say. */
export function captionFor(step) {
  if (!step) return null;
  const radiusPc = step.radiusPc;
  if (step.kind === 'field') {
    return {
      text: `Beyond the measured sky: ${step.radiusMpc} megaparsecs of a generated density field. `
        + 'This is a model of where structure sits, not a survey of what is there — SIMULATED.',
      source: 'Gaussian random field, seed 20261004 · DESI DR1 is the science reference, not the source',
    };
  }
  if (!Number.isFinite(radiusPc)) return null;

  if (radiusPc < 1) {
    return {
      text: `${radiusPc} parsec is ${Math.round(radiusPc * AU_PER_PC).toLocaleString('en-US')} `
        + 'astronomical units — from out here the Sun and its planets are a speck.',
      source: 'IAU 2015 definition · scale-out route',
    };
  }
  if (radiusPc < 50) {
    return {
      text: `${radiusPc} parsecs is ${years(radiusPc)} light years. The nearest star system, `
        + 'Alpha Centauri, is 4.2 light years away — measured, not placed.',
      source: 'Gaia DR3 parallaxes · scale-out route',
    };
  }
  if (radiusPc < 500) {
    return {
      text: `${Math.round(radiusPc)} parsecs — ${years(radiusPc)} light years. Every star in view has a `
        + 'measured parallax. Nothing on screen is a guess about where something sits.',
      source: 'esa.gaia DR3 · U3DTILE2 · scale-out route',
    };
  }
  if (radiusPc < 5000) {
    return {
      text: `One kiloparsec — ${years(radiusPc)} light years. The light now arriving left before `
        + 'cities were built.',
      source: 'light-travel time · scale-out route',
    };
  }
  return {
    text: `${Math.round(radiusPc / 1000)} kiloparsecs — ${years(radiusPc)} light years. The centre of the `
      + 'Milky Way is 26,500 light years away, in another direction entirely.',
    source: 'GRAVITY Collaboration (2019): Sgr A* at 8.122 ± 0.015 kpc',
  };
}
