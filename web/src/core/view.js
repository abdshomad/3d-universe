/**
 * Camera angles, in three.js convention, in one place.
 *
 * A three.js camera looks down its local -Z axis, so yaw θ and pitch φ look
 * toward (-sin θ·cos φ, sin φ, -cos θ·cos φ). Assuming the opposite convention
 * points the camera away from everything it aims at, and silently mirrors the
 * frustum used for culling — which is exactly what happened once already.
 */

const EPSILON = 1e-9;

/** Unit direction the camera faces for a yaw and pitch. */
export function directionFromAngles(yaw, pitch) {
  const cosPitch = Math.cos(pitch);
  return [-Math.sin(yaw) * cosPitch, Math.sin(pitch), -Math.cos(yaw) * cosPitch];
}

/** Yaw and pitch that aim the camera along a direction. */
export function anglesFromDirection(direction) {
  const length = Math.hypot(...direction);
  if (length < EPSILON) throw new RangeError('cannot aim at the zero vector');
  const [x, y, z] = [direction[0] / length, direction[1] / length, direction[2] / length];
  return {
    yaw: Math.atan2(-x, -z),
    pitch: Math.asin(Math.min(1, Math.max(-1, y))),
  };
}