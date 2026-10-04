/**
 * Cinematic camera paths as data.
 *
 * A route is a list of waypoints — a radius, a bearing and a hold — evaluated
 * deterministically: the same time always yields the same position, on any
 * machine, at any frame rate. A film is not something that drifts while you are
 * looking at it.
 *
 * Radius interpolates geometrically between waypoints, the same rule the rig
 * uses, so travelling from 1 parsec to 10 kiloparsec feels like one move rather
 * than a crawl followed by a fall. Bearings interpolate along the shortest arc.
 */

import { pcToMetres } from './units.js';

const DEFAULT_SEGMENT_SECONDS = 6;
const DEFAULT_HOLD_SECONDS = 2;

export class CameraPath {
  /**
   * @param {Array<{name?: string, radiusPc: number, bearingDeg?: number,
   *                holdSeconds?: number, segmentSeconds?: number}>} waypoints
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
    return this._timeline[this._timeline.length - 1].start + this._timeline[this._timeline.length - 1].seconds;
  }

  /** Waypoint names in order, for a HUD or a test. */
  names() {
    return this.waypoints.map((waypoint) => waypoint.name);
  }

  /**
   * Where the camera is at a given moment.
   * @param {number} elapsedSeconds
   * @returns {{positionMetres: number[], bearingDeg: number, name: string,
   *            segment: number, progress: number, holding: boolean}}
   */
  sample(elapsedSeconds) {
    if (!(elapsedSeconds >= 0)) throw new RangeError('elapsedSeconds must not be negative');
    const span = this._segmentAt(elapsedSeconds);
    const u = span.holding
      ? 1
      : easeExponential((elapsedSeconds - span.start) / span.seconds);

    const from = this.waypoints[span.from];
    const to = this.waypoints[span.to];
    const radiusPc = from.radiusPc * Math.pow(to.radiusPc / from.radiusPc, u);
    const bearingDeg = lerpBearing(from.bearingDeg, to.bearingDeg, u);

    return {
      positionMetres: polarToCartesian(radiusPc, bearingDeg),
      bearingDeg,
      name: u >= 1 ? to.name : from.name,
      segment: span.index,
      progress: u,
      holding: span.holding,
    };
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
        this._timeline.push({ index: i, from: i + 1, to: i + 1, start: cursor, seconds: hold, holding: true });
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
  const radius = pcToMetres(radiusPc);
  const angle = (bearingDeg * Math.PI) / 180;
  return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
}

/** Exponential ease: near-constant apparent rate whatever the decades in between. */
export function easeExponential(u) {
  const t = Math.min(Math.max(u, 0), 1);
  const curve = Math.log(12);
  return (Math.exp(curve * t) - 1) / (Math.exp(curve) - 1);
}


function wrapBearing(degrees) {
  return ((degrees % 360) + 360) % 360;
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
  };
}

function lerpBearing(fromDeg, toDeg, u) {
  const delta = ((toDeg - fromDeg + 540) % 360) - 180; // shortest arc
  return wrapBearing(fromDeg + delta * u);
}