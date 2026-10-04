/**
 * Cinematic camera paths as data.
 *
 * A route is a list of waypoints — a radius, a bearing, a hold, and what the
 * camera should look at — evaluated deterministically: the same moment always
 * yields the same position and the same gaze, on any machine, at any frame rate.
 */

import { bearingDirection, celestialDirection } from './celestial.js';
import { travelRadius } from './camera-rig.js';
import { pcToMetres } from './units.js';

const DEFAULT_SEGMENT_SECONDS = 6;
const DEFAULT_HOLD_SECONDS = 2;

export class CameraPath {
  /**
   * @param {Array<{name?: string, radiusPc: number, bearingDeg?: number,
   *                holdSeconds?: number, segmentSeconds?: number,
   *                lookAtDeg?: {ra: number, dec: number}}>} waypoints
   */
  constructor(waypoints) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      throw new RangeError('a path needs at least two waypoints');
    }
    this.waypoints = waypoints.map((waypoint, index) => normalise(waypoint, index));
    for (let i = 1; i < this.waypoints.length; i += 1) {
      if (!(this.waypoints[i].radiusPc > this.waypoints[i - 1].radiusPc)) {
        throw new RangeError(
          `waypoint ${this.waypoints[i].name} must be further out than ${this.waypoints[i - 1].name}`,
        );
      }
    }
    this._buildTimeline();
  }

  get durationSeconds() {
    const last = this._timeline[this._timeline.length - 1];
    return last.start + last.seconds;
  }

  /** Waypoint names in order, for a HUD or a test. */
  names() {
    return this.waypoints.map((waypoint) => waypoint.name);
  }

  /**
   * Where the camera is, and what it faces, at a given moment.
   * @param {number} elapsedSeconds
   */
  sample(elapsedSeconds) {
    if (!(elapsedSeconds >= 0)) throw new RangeError('elapsedSeconds must not be negative');
    const span = this._segmentAt(elapsedSeconds);
    const u = span.holding ? 1 : easeExponential((elapsedSeconds - span.start) / span.seconds);

    const from = this.waypoints[span.from];
    const to = this.waypoints[span.to];
    const radiusPc = from.radiusPc * Math.pow(to.radiusPc / from.radiusPc, u);
    const bearingDeg = lerpBearing(from.bearingDeg, to.bearingDeg, u);

    return {
      positionMetres: polarToCartesian(radiusPc, bearingDeg),
      bearingDeg,
      lookDirection: this._gaze(u < 0.5 ? from : to, bearingDeg),
      name: u >= 1 ? to.name : from.name,
      segment: span.index,
      progress: u,
      holding: span.holding,
    };
  }

  /**
   * Gaze for a waypoint: whatever the route says to look at, or outward along
   * the route when it says nothing. Nearest waypoint wins — the gaze is a
   * directorial choice per beat, not something to interpolate.
   */
  _gaze(waypoint, bearingDeg) {
    return waypoint.lookAtDeg
      ? celestialDirection(waypoint.lookAtDeg.ra, waypoint.lookAtDeg.dec)
      : bearingDirection(bearingDeg);
  }

  _buildTimeline() {
    this._timeline = [];
    let cursor = 0;
    for (let i = 0; i < this.waypoints.length - 1; i += 1) {
      const seconds = this.waypoints[i].segmentSeconds;
      this._timeline.push({ index: i, from: i, to: i + 1, start: cursor, seconds, holding: false });
      cursor += seconds;
      const hold = this.waypoints[i + 1].holdSeconds;
      if (hold > 0) {
        this._timeline.push({
          index: i, from: i + 1, to: i + 1, start: cursor, seconds: hold, holding: true,
        });
        cursor += hold;
      }
    }
  }

  _segmentAt(elapsedSeconds) {
    for (const segment of this._timeline) {
      if (elapsedSeconds < segment.start + segment.seconds) return segment;
    }
    return this._timeline[this._timeline.length - 1];
  }
}

/** Bearing in degrees and a radius in parsecs to metres on the equatorial plane. */
export function polarToCartesian(radiusPc, bearingDeg) {
  const distance = pcToMetres(radiusPc);
  return bearingDirection(bearingDeg).map((component) => component * distance);
}

/** Exponential ease: near-constant apparent rate whatever the decades in between. */
export function easeExponential(progress) {
  const t = Math.min(Math.max(progress, 0), 1);
  const curve = Math.log(12);
  return (Math.exp(curve * t) - 1) / (Math.exp(curve) - 1);
}

function normalise(waypoint, index) {
  const radiusPc = Number(waypoint.radiusPc);
  if (!Number.isFinite(radiusPc) || radiusPc < 0) {
    throw new RangeError(`waypoint ${index} has an unusable radius`);
  }
  return {
    name: waypoint.name ?? `waypoint-${index}`,
    radiusPc,
    bearingDeg: Number(waypoint.bearingDeg ?? 0),
    holdSeconds: Number(waypoint.holdSeconds ?? DEFAULT_HOLD_SECONDS),
    segmentSeconds: Number(waypoint.segmentSeconds ?? DEFAULT_SEGMENT_SECONDS),
    lookAtDeg: waypoint.lookAtDeg ?? null,
  };
}

function lerpBearing(fromDeg, toDeg, progress) {
  const delta = ((toDeg - fromDeg + 540) % 360) - 180; // shortest arc
  return (((fromDeg + delta * progress) % 360) + 360) % 360;
}

// Re-exported so callers that only need the easing share one implementation.
export { travelRadius };
