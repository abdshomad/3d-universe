/**
 * "Scale out" — the default cinematic route.
 *
 * Data, not code: edit this file and the film changes. Each waypoint is a
 * radius, not a claimed position for a named star, so nothing here can imply a
 * direction we have not measured. Bearings sweep as the radius grows, which is
 * what keeps the flight from feeling like a straight line.
 */

import { CameraPath } from '../core/camera-path.js';

export const SCALE_OUT_WAYPOINTS = [
  { name: 'sol', radiusPc: 0.01, bearingDeg: 0, segmentSeconds: 4, holdSeconds: 3 },
  { name: 'nearby-stars', radiusPc: 5, bearingDeg: 25, segmentSeconds: 8, holdSeconds: 2 },
  { name: 'neighbourhood', radiusPc: 100, bearingDeg: 70, segmentSeconds: 10, holdSeconds: 2 },
  { name: 'open-cluster-scale', radiusPc: 1000, bearingDeg: 140, segmentSeconds: 12, holdSeconds: 2 },
  { name: 'kpc', radiusPc: 10_000, bearingDeg: 200, segmentSeconds: 14, holdSeconds: 3 },
];

export function createScaleOutPath() {
  return new CameraPath(SCALE_OUT_WAYPOINTS);
}