/**
 * Guided journeys: a route through landmarks that have a measured distance.
 *
 * The route is data, not choreography: give it a list of places and it works
 * out the legs, the holds and where to look on each one. The camera faces the
 * next destination rather than drifting outward, so a journey reads as intent.
 */

import { CameraPath } from './camera-path.js';

const START_PC = 1e-4;
const DEFAULT_SEGMENT_SECONDS = 10;
const DEFAULT_HOLD_SECONDS = 4;

export class UnplacedLandmarkError extends Error {}

/** A landmark is only flyable if the catalogue measured how far away it is. */
export function assertPlaced(landmark) {
  const distance = landmark?.distance_pc;
  if (typeof distance !== 'number' || !(distance > 0)) {
    throw new UnplacedLandmarkError(
      `${landmark?.name ?? 'landmark'} has no measured distance and will not be visited`,
    );
  }
  return landmark;
}

/**
 * Build a camera path through landmarks, nearest first.
 *
 * @param {object[]} landmarks with `name`, `ra_deg`, `dec_deg`, `distance_pc`
 * @param {{startPc?: number, segmentSeconds?: number, holdSeconds?: number}} options
 */
export function journeyFromLandmarks(landmarks, {
  startPc = START_PC,
  segmentSeconds = DEFAULT_SEGMENT_SECONDS,
  holdSeconds = DEFAULT_HOLD_SECONDS,
} = {}) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    throw new RangeError('a journey needs at least one landmark');
  }
  const ordered = [...landmarks].sort((a, b) => a.distance_pc - b.distance_pc);
  ordered.forEach(assertPlaced);

  const first = ordered[0];
  const waypoints = [{
    name: 'sol',
    radiusPc: startPc,
    segmentSeconds,
    holdSeconds: 1,
    lookAtDeg: { ra: first.ra_deg, dec: first.dec_deg },
  }];

  ordered.forEach((landmark, index) => {
    const next = ordered[index + 1];
    waypoints.push({
      name: landmark.name,
      radiusPc: landmark.distance_pc,
      segmentSeconds,
      holdSeconds,
      lookAtDeg: next
        ? { ra: next.ra_deg, dec: next.dec_deg }
        : { ra: landmark.ra_deg, dec: landmark.dec_deg },
    });
  });

  return new CameraPath(waypoints);
}
