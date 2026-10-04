/**
 * Reticles: the annotation language around a selected object.
 *
 * Circles, tick arcs, a crosshair and an uncertainty ellipse — thin, unlit and
 * unblurred, so a selection reads as instrumentation rather than decoration.
 *
 * Drawn as line segments, which are a fixed pixel width on the GPU at every
 * scale: exactly the thin wireframe the art direction asks for, and free at
 * 1e17 m where a world-space stroke would be either invisible or a wall.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
} from 'three/webgpu';

const RETICLE_COLOUR = [0.72, 0.86, 0.95];

/**
 * Pixels to world units at a given distance for a camera's vertical field of
 * view: how large an annotation has to be in the world to hold a fixed size on
 * screen. Used for the reticle's *radius*, which is an angular size.
 */
export function worldWidthForPixels(distance, pixels, fovDegrees = 60, viewportHeight = 800) {
  const worldHeight = 2 * distance * Math.tan((fovDegrees * Math.PI) / 360);
  return (pixels / viewportHeight) * worldHeight;
}

/** A circle in the XY plane, as pairs of points. */
export function circlePoints(radius = 1, segments = 64, fromAngle = 0, toAngle = Math.PI * 2) {
  const points = [];
  const sweep = toAngle - fromAngle;
  for (let i = 0; i < segments; i += 1) {
    const a0 = fromAngle + (sweep * i) / segments;
    const a1 = fromAngle + (sweep * (i + 1)) / segments;
    points.push([Math.cos(a0) * radius, Math.sin(a0) * radius, 0]);
    points.push([Math.cos(a1) * radius, Math.sin(a1) * radius, 0]);
  }
  return points;
}

/** An arc of short radial ticks, the way a fine scale is drawn. */
export function tickPoints({
  radius = 1,
  ticks = 12,
  tickLength = 0.08,
  fromAngle = 0,
  toAngle = Math.PI * 2,
} = {}) {
  const points = [];
  for (let i = 0; i < ticks; i += 1) {
    const angle = fromAngle + ((toAngle - fromAngle) * i) / ticks;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push([cos * radius, sin * radius, 0]);
    points.push([cos * (radius + tickLength), sin * (radius + tickLength), 0]);
  }
  return points;
}

/** A crosshair with a gap in the middle, so it never sits on the object. */
export function crosshairPoints({ size = 1, gap = 0.35 } = {}) {
  const inner = size * gap;
  return [
    [-size, 0, 0], [-inner, 0, 0],
    [inner, 0, 0], [size, 0, 0],
    [0, -size, 0], [0, -inner, 0],
    [0, inner, 0], [0, size, 0],
  ];
}

/** An ellipse in the reticle plane: the shape of a real astrometric error. */
export function ellipsePoints({
  semiMajor = 1,
  semiMinor = 0.3,
  rotationDeg = 0,
  segments = 48,
} = {}) {
  const rotation = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points = [];
  for (let i = 0; i < segments; i += 1) {
    for (const step of [i, i + 1]) {
      const angle = (Math.PI * 2 * step) / segments;
      const x = Math.cos(angle) * semiMajor;
      const y = Math.sin(angle) * semiMinor;
      points.push([x * cos - y * sin, x * sin + y * cos, 0]);
    }
  }
  return points;
}

/** Every stroke of a reticle, in the local plane facing the camera. */
export function reticleStrokes({
  radius = 1,
  tickCount = 12,
  tickLength = 0.08,
  crosshairSize = 1,
  uncertainty = null,
} = {}) {
  const strokes = [
    ...circlePoints(radius),
    ...tickPoints({ radius, ticks: tickCount, tickLength }),
    ...crosshairPoints({ size: crosshairSize }),
  ];
  if (uncertainty) strokes.push(...ellipsePoints(uncertainty));
  return strokes;
}

/**
 * Build a reticle at a world position, facing the camera.
 *
 * @param {{position: number[], distance: number, radius: number, fovDegrees?: number,
 *          viewportHeight?: number, colour?: number[], tickCount?: number,
 *          tickLength?: number, crosshairSize?: number, uncertainty?: object,
 *          label?: string}} options
 */
export function createReticle({
  position,
  distance,
  radius,
  fovDegrees = 60,
  viewportHeight = 800,
  colour = RETICLE_COLOUR,
  tickCount = 12,
  tickLength = 0.08,
  crosshairSize = 1,
  uncertainty = null,
  label = 'selection',
}) {
  const strokes = reticleStrokes({ radius, tickCount, tickLength, crosshairSize, uncertainty });
  const positions = new Float32Array(strokes.length * 3);
  strokes.forEach(([x, y, z], index) => {
    positions[3 * index] = x;
    positions[3 * index + 1] = y;
    positions[3 * index + 2] = z;
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color: new Color(colour[0], colour[1], colour[2]),
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  const lines = new LineSegments(geometry, material);
  lines.name = `reticle:${label}`;
  lines.renderOrder = 20;
  lines.frustumCulled = false;
  lines.position.set(position[0], position[1], position[2]);
  lines.lookAt(0, 0, 0);
  lines.userData = {
    label,
    distance,
    radius,
    strokePixels: 1,
    worldWidth: worldWidthForPixels(distance, 1, fovDegrees, viewportHeight),
  };
  return lines;
}