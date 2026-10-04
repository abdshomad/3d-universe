/**
 * Floating origin: the world moves, the camera never does.
 *
 * World coordinates reach 1e25 m, where a float32 has no integral part left.
 * So the scene keeps a float64 world position and re-centres it on a coarse
 * quantum whenever the camera leaves the current cell; only render-space
 * offsets, which stay small, are ever written into float32 buffers.
 */

import { F32_SAFE_METRES } from './units.js';

export class FloatingOrigin {
  /**
   * @param {{quantumMetres?: number, safeMetres?: number}} options
   */
  constructor({ quantumMetres = 1e6, safeMetres = F32_SAFE_METRES } = {}) {
    if (quantumMetres <= 0) throw new RangeError('quantumMetres must be positive');
    if (safeMetres <= quantumMetres) throw new RangeError('safeMetres must exceed quantumMetres');
    this.quantumMetres = quantumMetres;
    this.safeMetres = safeMetres;
    this.originMetres = [0, 0, 0];
    this.recentredAt = 0;
  }

  /**
   * Re-centre if the camera has left the safe box. Jumps are always a whole
   * number of quanta, so nothing drifts and nothing pops in render space.
   * @param {number[]} cameraMetres
   * @returns {boolean} true when the origin moved this call
   */
  update(cameraMetres) {
    let moved = false;
    for (let axis = 0; axis < 3; axis += 1) {
      const delta = cameraMetres[axis] - this.originMetres[axis];
      if (Math.abs(delta) < this.safeMetres) continue;
      const steps = Math.trunc(delta / this.quantumMetres);
      this.originMetres[axis] += steps * this.quantumMetres;
      moved = true;
    }
    if (moved) this.recentredAt += 1;
    return moved;
  }

  /** World metres to render-space metres, small enough for float32. */
  toRenderSpace(worldMetres) {
    return [
      worldMetres[0] - this.originMetres[0],
      worldMetres[1] - this.originMetres[1],
      worldMetres[2] - this.originMetres[2],
    ];
  }

  /** Render-space metres back to world metres. */
  toWorld(renderMetres) {
    return [
      renderMetres[0] + this.originMetres[0],
      renderMetres[1] + this.originMetres[1],
      renderMetres[2] + this.originMetres[2],
    ];
  }

  /** Largest render-space magnitude currently possible, for float32 checks. */
  get renderSpanMetres() {
    return this.safeMetres + this.quantumMetres;
  }
}