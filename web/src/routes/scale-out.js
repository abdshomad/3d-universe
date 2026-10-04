/**
 * "Scale out" — the default cinematic route.
 *
 * Data, not code: edit this file and the film changes. Each waypoint is a
 * radius, not a claimed position for a named star, so nothing here implies a
 * direction we have not measured.
 *
 * `lookAtDeg` is the directorial part: where the camera faces at each beat. It
 * points at the deep fields in `data/deep-fields.js`, using the same coordinates
 * that place their backdrop planes — so the camera looks at exactly where the
 * imagery it is seeing hangs. Waypoints without it look outward along the route.
 */

import { CameraPath } from '../core/camera-path.js';

export const SCALE_OUT_WAYPOINTS = [
  {
    name: 'sol',
    radiusPc: 0.01,
    bearingDeg: 0,
    segmentSeconds: 4,
    holdSeconds: 3,
    // Webb's first deep field: SIMBAD ICRS J2000.
    lookAtDeg: { ra: 110.8054, dec: -73.4569 },
  },
  {
    name: 'nearby-stars',
    radiusPc: 5,
    bearingDeg: 25,
    segmentSeconds: 8,
    holdSeconds: 2,
    // Hubble eXtreme Deep Field, authored placement.
    lookAtDeg: { ra: 145, dec: 0 },
  },
  {
    name: 'neighbourhood',
    radiusPc: 100,
    bearingDeg: 70,
    segmentSeconds: 10,
    holdSeconds: 2,
    lookAtDeg: { ra: 310, dec: 0 },
  },
  {
    name: 'open-cluster-scale',
    radiusPc: 1000,
    bearingDeg: 140,
    segmentSeconds: 12,
    holdSeconds: 2,
    // Sweep back up to the Webb field as the sky widens.
    lookAtDeg: { ra: 110.8054, dec: -73.4569 },
  },
  { name: 'kpc', radiusPc: 10_000, bearingDeg: 200, segmentSeconds: 14, holdSeconds: 3 },
];

export function createScaleOutPath() {
  return new CameraPath(SCALE_OUT_WAYPOINTS);
}