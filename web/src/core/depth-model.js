/**
 * Depth: 1 m and 500 Mpc without z-fighting.
 *
 * One depth buffer across the whole range cannot work. A 24-bit buffer spread
 * over 29 decades spends its precision evenly per decade, which at 1 AU leaves
 * roughly 600 km per depth step — the Earth becomes a dozen pixels of mush. So
 * the scene is split into contiguous scale bands, each with its own logarithmic
 * mapping of a few decades, and each rendered as its own pass.
 */

import { F32_MAX } from './units.js';

/** Depth precision of a standard 24-bit depth buffer. */
export const DEPTH_STEPS = 2 ** 24;

export const DEFAULT_BANDS = [
  { name: 'surface', nearMetres: 1e-3, farMetres: 1e6 },
  { name: 'low-orbit', nearMetres: 1e6, farMetres: 1e10 },
  { name: 'high-orbit', nearMetres: 1e10, farMetres: 1e12 },
  { name: 'planetary', nearMetres: 1e12, farMetres: 1e16 },
  { name: 'stellar', nearMetres: 1e16, farMetres: 1e21 },
  { name: 'galactic', nearMetres: 1e21, farMetres: 1e24 },
  { name: 'cosmic', nearMetres: 1e24, farMetres: 1e26 },
];

export class DepthModel {
  /**
   * @param {{nearMetres?: number, farMetres?: number}} options
   */
  constructor({ nearMetres = 1e-3, farMetres = 1e26 } = {}) {
    if (nearMetres <= 0) throw new RangeError('nearMetres must be positive');
    if (farMetres <= nearMetres) throw new RangeError('farMetres must exceed nearMetres');
    if (farMetres > F32_MAX) throw new RangeError('farMetres exceeds float32 range');
    this.nearMetres = nearMetres;
    this.farMetres = farMetres;
    this.logRange = Math.log(farMetres / nearMetres);
  }

  /** View distance in metres to normalized device depth in [0, 1]. */
  ndc(viewDistanceMetres) {
    if (viewDistanceMetres <= 0) return 0;
    const clamped = Math.min(viewDistanceMetres, this.farMetres);
    return Math.log(clamped / this.nearMetres) / this.logRange;
  }

  /** Inverse of {@link ndc}. */
  metresFromNdc(depth) {
    if (depth <= 0) return this.nearMetres;
    return this.nearMetres * Math.exp(depth * this.logRange);
  }

  /** Metres resolved per depth-buffer step at a given distance. */
  resolutionMetres(viewDistanceMetres, steps = DEPTH_STEPS) {
    return this.metresFromNdc(this.ndc(viewDistanceMetres) + 1 / steps) - viewDistanceMetres;
  }

  /** Depth separation between two distances: zero means they will fight. */
  isResolvable(near, far) {
    return this.ndc(far) - this.ndc(near) > 1 / DEPTH_STEPS;
  }

  get decades() {
    return this.logRange / Math.LN10;
  }
}

/**
 * Contiguous scale bands, each with its own depth mapping. The last band owns
 * its far edge; every other band is half-open.
 */
export class DepthBands {
  /**
   * @param {Array<{name: string, nearMetres: number, farMetres: number}>} bands
   */
  constructor(bands = DEFAULT_BANDS) {
    if (!bands.length) throw new RangeError('at least one band is required');
    this.bands = bands.map((band, index) => {
      if (index > 0 && band.nearMetres !== bands[index - 1].farMetres) {
        throw new RangeError(`band ${band.name} must start where the previous one ends`);
      }
      return Object.freeze({
        ...band,
        model: new DepthModel({ nearMetres: band.nearMetres, farMetres: band.farMetres }),
      });
    });
  }

  get nearMetres() {
    return this.bands[0].nearMetres;
  }

  get farMetres() {
    return this.bands[this.bands.length - 1].farMetres;
  }

  /** Index of the band that owns a view distance. */
  bandIndexFor(viewDistanceMetres) {
    const clamped = Math.min(Math.max(viewDistanceMetres, this.nearMetres), this.farMetres);
    const index = this.bands.findIndex(
      (band) => clamped >= band.nearMetres && clamped < band.farMetres,
    );
    return index === -1 ? this.bands.length - 1 : index;
  }

  bandFor(viewDistanceMetres) {
    return this.bands[this.bandIndexFor(viewDistanceMetres)];
  }

  modelFor(viewDistanceMetres) {
    return this.bandFor(viewDistanceMetres).model;
  }

  /** Metres resolved at this distance, given the band that owns it. */
  resolutionAt(viewDistanceMetres, steps = DEPTH_STEPS) {
    return this.modelFor(viewDistanceMetres).resolutionMetres(viewDistanceMetres, steps);
  }
}