/**
 * Relation ribbons: tapered, curved, additive strips between two objects.
 *
 * Shaped like light painting rather than vector strokes: the width tapers to
 * nothing at both ends, the path bulges away from its chord, and the alpha is
 * modulated by the same deterministic noise that draws the nebulosity, so a
 * ribbon has grain instead of looking extruded.
 *
 * Width is in world units. At 1e17 m that needs a deliberate choice rather than
 * a constant, so callers pass one; screen-space ribbons that hold a pixel width
 * at every distance are a later step.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three/webgpu';

import { fbm3 } from '../core/noise.js';

const UP = new Vector3(0, 1, 0);
const DEFAULT_SAMPLES = 12;

/** Quadratic bulge: a straight chord lifted off the line joining its ends. */
function bulgePoints(from, to, curve, samples) {
  const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5);
  const offset = mid.clone().normalize().multiplyScalar(from.distanceTo(to) * curve);
  const control = mid.add(offset);
  const points = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const point = new Vector3()
      .addVectors(from.clone().multiplyScalar((1 - t) ** 2), control.clone().multiplyScalar(2 * (1 - t) * t))
      .add(to.clone().multiplyScalar(t * t));
    points.push(point);
  }
  return points;
}

/**
 * Build ribbon geometry for one relation path.
 *
 * @param {{points: Vector3[], colour: number[], width: number, alpha?: number,
 *          curve?: number, seed?: number, noiseFrequency?: number, samples?: number}} options
 * @returns {{geometry: BufferGeometry, vertexCount: number, alphaRange: [number, number]}}
 */
export function buildRibbonGeometry({
  points,
  colour,
  width,
  alpha = 1,
  curve = 0.12,
  seed = 0,
  noiseFrequency = 1e-4,
  samples = DEFAULT_SAMPLES,
}) {
  if (points.length < 2) throw new RangeError('a ribbon needs at least two points');

  const positions = [];
  const colours = [];
  let minimum = Infinity;
  let maximum = -Infinity;

  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const path = bulgePoints(points[segment], points[segment + 1], curve, samples);
    const count = path.length;

    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      // Taper to nothing at both ends: a ribbon that stops flat looks like a box.
      const taper = Math.sin(Math.PI * t);
      const centre = path[i];
      const next = path[Math.min(i + 1, count - 1)];
      const previous = path[Math.max(i - 1, 0)];
      const tangent = next.clone().sub(previous).normalize();
      const side = new Vector3()
        .crossVectors(tangent, UP)
        .normalize()
        .multiplyScalar(width * taper * 0.5);

      const grain = fbm3(
        centre.x * noiseFrequency,
        centre.y * noiseFrequency,
        centre.z * noiseFrequency,
        { seed },
      );
      const brightness = alpha * (0.6 + 0.8 * grain);
      minimum = Math.min(minimum, brightness);
      maximum = Math.max(maximum, brightness);

      for (const sign of [1, -1]) {
        positions.push(
          centre.x + side.x * sign,
          centre.y + side.y * sign,
          centre.z + side.z * sign,
        );
        colours.push(colour[0] * brightness, colour[1] * brightness, colour[2] * brightness);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));

  return { geometry, vertexCount: positions.length / 3, alphaRange: [minimum, maximum] };
}

/** A drawable ribbon mesh: additive, unlit, and visible from either side. */
export function createRibbonMesh(options) {
  const { geometry } = buildRibbonGeometry(options);
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.name = `ribbon:${options.name ?? 'relation'}`;
  mesh.renderOrder = 10;
  return mesh;
}