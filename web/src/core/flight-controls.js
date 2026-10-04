/**
 * Free flight: the same keys at every scale, only the speed law changes.
 *
 * Forward moves your radius geometrically — `d·e^(rate·t)` — so a held key
 * covers the same fraction of the view whether the step is a second or a
 * millisecond, and whether you sit at 1 AU or drift past 100 kpc. That is what
 * makes the controls feel identical across twenty-five decades, and it is the
 * same law the cinematic camera uses, so free flight and the film agree.
 *
 * Strafing and lifting change bearing and elevation at the same angular rate,
 * which leaves the radius alone.
 */

const DEFAULT_RATE = 0.35;
const DEFAULT_BOOST = 8;
const MIN_SPEED_METRES = 1;
const POLE_LIMIT = Math.PI / 2 - 1e-6;

export class FlightController {
  /**
   * @param {{ratePerSecond?: number, boostMultiplier?: number,
   *          minSpeedMetres?: number}} options
   */
  constructor({
    ratePerSecond = DEFAULT_RATE,
    boostMultiplier = DEFAULT_BOOST,
    minSpeedMetres = MIN_SPEED_METRES,
  } = {}) {
    if (!(ratePerSecond > 0)) throw new RangeError('ratePerSecond must be positive');
    if (!(boostMultiplier >= 1)) throw new RangeError('boostMultiplier must be at least 1');
    this.ratePerSecond = ratePerSecond;
    this.boostMultiplier = boostMultiplier;
    this.minSpeedMetres = minSpeedMetres;

    this.forward = 0;
    this.strafe = 0;
    this.lift = 0;
    this.boost = false;
  }

  /** Set the current input. Each axis is in [-1, 1]; boost is a held modifier. */
  input({ forward = 0, strafe = 0, lift = 0, boost = this.boost } = {}) {
    this.forward = clampAxis(forward);
    this.strafe = clampAxis(strafe);
    this.lift = clampAxis(lift);
    this.boost = Boolean(boost);
    return this;
  }

  get engaged() {
    return this.forward !== 0 || this.strafe !== 0 || this.lift !== 0;
  }

  /** Radial gain from the forward axis over a step: exact, not an Euler step. */
  radialGain(deltaSeconds) {
    return Math.exp(this.ratePerSecond * this._scale() * deltaSeconds);
  }

  /** How far a held forward key moves you, as a multiple of your distance. */
  distanceGainPerSecond() {
    return this.radialGain(1);
  }

  /**
   * Advance the position by one step.
   * @param {number} deltaSeconds
   * @param {number[]} positionMetres
   * @returns {number[]} the new position
   */
  step(deltaSeconds, positionMetres) {
    if (!(deltaSeconds >= 0)) throw new RangeError('deltaSeconds must not be negative');
    if (!this.engaged || deltaSeconds === 0) return positionMetres;

    const angular = this.ratePerSecond * this._scale() * deltaSeconds;
    let [x, y, z] = positionMetres;

    const radius = Math.hypot(x, y, z);
    if (this.forward !== 0) {
      if (radius > 0) {
        const gained = Math.exp(this.forward * angular);
        [x, y, z] = [x * gained, y * gained, z * gained];
      } else {
        // At the origin there is no radius to scale, so leave along the view.
        x = this.forward * this.minSpeedMetres * deltaSeconds;
      }
    }

    if (this.strafe !== 0) {
      const cosine = Math.cos(this.strafe * angular);
      const sine = Math.sin(this.strafe * angular);
      [x, z] = [x * cosine - z * sine, x * sine + z * cosine];
    }

    if (this.lift !== 0) {
      const length = Math.hypot(x, y, z) || 1;
      const horizontal = Math.hypot(x, z);
      const elevation = Math.asin(clamp(y / length, -1, 1)) + this.lift * angular;
      const clamped = Math.max(-POLE_LIMIT, Math.min(POLE_LIMIT, elevation));
      const horizontalNow = length * Math.cos(clamped);
      y = length * Math.sin(clamped);
      if (horizontal > 0) {
        x *= horizontalNow / horizontal;
        z *= horizontalNow / horizontal;
      }
    }

    return [x, y, z];
  }

  _scale() {
    return this.boost ? this.boostMultiplier : 1;
  }
}

function clampAxis(value) {
  const number = Number(value) || 0;
  return Math.min(Math.max(number, -1), 1);
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

/** Keyboard state to a flight input, so the mapping can be tested. */
export function inputFromKeys(keys, { boostKey = 'shift' } = {}) {
  const down = (name) => Boolean(keys.has(name));
  return {
    forward: (down('w') || down('arrowup') ? 1 : 0) - (down('s') || down('arrowdown') ? 1 : 0),
    strafe: (down('d') || down('arrowright') ? 1 : 0) - (down('a') || down('arrowleft') ? 1 : 0),
    lift: (down('e') ? 1 : 0) - (down('q') ? 1 : 0),
    boost: down(boostKey),
  };
}
