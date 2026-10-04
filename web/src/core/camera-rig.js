/**
 * Camera rig: exponential travel and scale-independent rotation.
 *
 * Orientation is two parts: where the route points (`baseYaw`, `basePitch`) and
 * the slow drift layered on top (`driftYaw`, `driftPitch`). Keeping them apart
 * is what lets a cinematic flight keep breathing — assigning `yaw` outright every
 * frame silently cancels the drift.
 *
 * Distance interpolates geometrically between waypoints, so travelling from
 * 1 parsec to 10 kiloparsec feels like one move rather than a crawl followed by
 * a fall. Bearings interpolate along the shortest arc.
 */

const EPSILON = 1e-9;
const MIN_START_RADIUS_FRACTION = 1e-9;
const MAX_PITCH_DRIFT = 0.25;

export class CameraRig {
  /**
   * @param {{positionMetres?: number[], maxSpeedMetresPerSecond?: number}} options
   */
  constructor({ positionMetres = [0, 0, 0], maxSpeedMetresPerSecond = Infinity } = {}) {
    this.positionMetres = [...positionMetres];
    this.maxSpeedMetresPerSecond = maxSpeedMetresPerSecond;
    this.velocityMetresPerSecond = [0, 0, 0];

    this.baseYaw = 0;
    this.basePitch = 0;
    this.driftYaw = 0;
    this.driftPitch = 0;
    this.yawRate = 0;
    this.pitchRate = 0;

    this._travel = null;
  }

  /** Where the camera looks: the route's gaze plus the accumulated drift. */
  get yaw() {
    return wrapAngle(this.baseYaw + this.driftYaw);
  }

  get pitch() {
    return clamp(this.basePitch + this.driftPitch, -Math.PI / 2, Math.PI / 2);
  }

  set yaw(value) {
    this.baseYaw = value;
    this.driftYaw = 0;
  }

  set pitch(value) {
    this.basePitch = value;
    this.driftPitch = 0;
  }

  get isTravelling() {
    return this._travel !== null;
  }

  get travelProgress() {
    return this._travel ? this._travel.u : 1;
  }

  /** Point the camera without disturbing the drift. */
  lookAtAngles(yaw, pitch) {
    this.baseYaw = yaw;
    this.basePitch = pitch;
    return this;
  }

  /** Bring the drift back to zero, e.g. when the user takes control. */
  resetDrift() {
    this.driftYaw = 0;
    this.driftPitch = 0;
    return this;
  }

  /**
   * Fly to a world position over time.
   * @param {number[]} targetMetres
   * @param {{durationSeconds?: number, arc?: number}} options
   */
  travelTo(targetMetres, { durationSeconds = 8, arc = 0 } = {}) {
    if (!(durationSeconds > 0)) throw new RangeError('durationSeconds must be positive');
    const r0 = radius(this.positionMetres);
    const r1 = radius(targetMetres);
    // Only a start exactly at the origin makes the growth ratio undefined.
    const startRadius = r0 > 0 ? r0 : Math.max(r1 * MIN_START_RADIUS_FRACTION, EPSILON);
    this._travel = {
      from: [...this.positionMetres],
      to: [...targetMetres],
      durationSeconds,
      elapsed: 0,
      arc,
      u: 0,
      startRadius,
      logGrowth: Math.log(r1 / startRadius),
    };
    return this;
  }

  cancelTravel() {
    this._travel = null;
  }

  /** Spin at a constant angular rate, independent of scale. */
  setAngularRate(yawRate = 0, pitchRate = 0) {
    this.yawRate = yawRate;
    this.pitchRate = pitchRate;
    return this;
  }

  /** The slow idle drift the art direction asks for, in radians per second. */
  autoDrift(radiansPerSecond = 0.004) {
    return this.setAngularRate(radiansPerSecond, radiansPerSecond * 0.12);
  }

  /** Advance by a wall-clock delta, so behaviour does not depend on frame rate. */
  update(deltaSeconds) {
    if (!(deltaSeconds >= 0)) throw new RangeError('deltaSeconds must not be negative');
    const previous = [...this.positionMetres];
    this._advanceTravel(deltaSeconds);
    this._applyRotation(deltaSeconds);
    const step = deltaSeconds || EPSILON;
    this.velocityMetresPerSecond = [
      (this.positionMetres[0] - previous[0]) / step,
      (this.positionMetres[1] - previous[1]) / step,
      (this.positionMetres[2] - previous[2]) / step,
    ];
    return this;
  }

  /** Speed relative to distance from the origin: the apparent sweep rate. */
  sweepRate() {
    const distance = radius(this.positionMetres);
    if (distance < EPSILON) return 0;
    return Math.hypot(...this.velocityMetresPerSecond) / distance;
  }

  _advanceTravel(deltaSeconds) {
    const travel = this._travel;
    if (!travel) return;
    travel.elapsed = Math.min(travel.elapsed + deltaSeconds, travel.durationSeconds);
    const u = travel.elapsed / travel.durationSeconds;
    travel.u = u;

    if (u >= 1) {
      this.positionMetres = [...travel.to];
      this._travel = null;
      return;
    }

    const radiusNow = travelRadius(travel.startRadius, travel.logGrowth, u);
    const direction = travelDirection(travel.from, travel.to, u);
    const bulge = arcOffset(travel.from, travel.to, travel.arc, u);
    this.positionMetres = direction.map((component, axis) => component * radiusNow + bulge[axis]);
  }

  _applyRotation(deltaSeconds) {
    this.driftYaw = wrapAngle(this.driftYaw + this.yawRate * deltaSeconds);
    this.driftPitch = clamp(
      this.driftPitch + this.pitchRate * deltaSeconds,
      -MAX_PITCH_DRIFT,
      MAX_PITCH_DRIFT,
    );
  }
}

/** Radius along an exponential travel: geometric interpolation in log space. */
export function travelRadius(startRadius, logGrowth, progress) {
  return startRadius * Math.exp(logGrowth * progress);
}

/**
 * Direction of travel: interpolate the unit vectors, never the raw
 * coordinates. Lerping coordinates across 25 decades lets the huge component
 * swallow the small one on the very first frame.
 */
export function travelDirection(from, to, progress) {
  const a = normalise(from);
  const b = normalise(to);
  return normalise(a.map((component, axis) => component + (b[axis] - component) * progress));
}

export function radius(point) {
  return Math.hypot(point[0], point[1], point[2]);
}

export function distanceFrom(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Sideways bulge so long journeys are not dead straight. */
function arcOffset(from, to, arc, progress) {
  if (arc === 0) return [0, 0, 0];
  const span = distanceFrom(from, to);
  if (span < EPSILON) return [0, 0, 0];
  const lateral = perpendicularOffset(from, to);
  const weight = Math.sin(Math.PI * progress) * arc * span;
  return lateral.map((component) => component * weight);
}

function perpendicularOffset(from, to) {
  const span = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length = Math.hypot(...span);
  if (length < EPSILON) return [0, 0, 0];
  const along = span.map((value) => value / length);
  const reference = Math.abs(along[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const side = normalise(cross(along, reference));
  return normalise(cross(side, along));
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalise(vector) {
  const length = Math.hypot(...vector);
  if (length < EPSILON) return [0, 0, 0];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function wrapAngle(degrees) {
  return ((degrees % 360) + 360) % 360;
}
