/**
 * View pyramid planes as plain arrays, so the LOD tree stays engine-agnostic.
 *
 * Two deliberate choices, both forced by the 25-decade scale:
 *
 * - Only the four side planes are kept. Full near/far planes from a projection
 *   spanning 29 decades come back as NaN, and they carry nothing we need:
 *   distance culling is an explicit metre-based test done by the LOD tree.
 * - The pyramid is built at the origin from the view direction alone, never at
 *   the camera's real position. A projection is only well conditioned near its
 *   own origin; building it at 1e20 m returns the same garbage whatever
 *   direction you ask for.
 *
 * The consequence is that a symmetric pyramid also contains whatever sits
 * directly behind the camera, so callers must apply the forward test too.
 */

import { Frustum, PerspectiveCamera } from 'three';

const SIDE_PLANE_COUNT = 4;
const MATRIX_FOV_DEGREES = 45;
const MATRIX_NEAR_METRES = 1;
const MATRIX_FAR_METRES = 1e6;

/** Four inward side planes for a view direction. */
export function planesFromMatrix(viewProjectionMatrix) {
  const planes = new Frustum().setFromProjectionMatrix(viewProjectionMatrix).planes;
  return planes.slice(0, SIDE_PLANE_COUNT).map((plane) => {
    const length = Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z) || 1;
    return [
      plane.normal.x / length,
      plane.normal.y / length,
      plane.normal.z / length,
      plane.constant / length,
    ];
  });
}

/**
 * @param {{direction: number[], up?: number[], aspect?: number}} view
 * @returns {number[][]} four inward planes as [a, b, c, d]
 */
export function planesFromCamera({ direction, up = [0, 1, 0], aspect = 1 }) {
  const camera = new PerspectiveCamera(MATRIX_FOV_DEGREES, aspect, MATRIX_NEAR_METRES, MATRIX_FAR_METRES);
  camera.up.set(...up);
  camera.position.set(0, 0, 0);
  camera.lookAt(direction[0], direction[1], direction[2]);
  camera.updateMatrixWorld(true);
  return planesFromMatrix(camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse));
}

/** Is a point inside the pyramid the side planes describe? */
export function pointInFrustum(planes, point) {
  return planes.every(([a, b, c, d]) => a * point[0] + b * point[1] + c * point[2] + d >= 0);
}

/** Signed distance along the view direction; negative means behind the camera. */
export function forwardDistance(position, direction, point) {
  return (
    (point[0] - position[0]) * direction[0]
    + (point[1] - position[1]) * direction[1]
    + (point[2] - position[2]) * direction[2]
  );
}

/** Is a point inside the pyramid, measured from a camera at `origin`? */
export function pointInFrustumFrom(planes, point, origin) {
  return planes.every(([a, b, c, d]) =>
    a * (point[0] - origin[0]) + b * (point[1] - origin[1]) + c * (point[2] - origin[2]) + d >= 0);
}