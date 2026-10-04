/**
 * Additive points: the one place a point cloud is built.
 *
 * Stars and nebulosity are the same primitive with different numbers, so the
 * material lives here once. It is a node material because three's WebGPU
 * renderer rejects GLSL ShaderMaterial outright, and sizes in screen space
 * because a world-sized point attenuates to a millionth of a pixel at 1e12 m.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  PointsNodeMaterial,
} from 'three/webgpu';
import { attribute } from 'three/tsl';

/**
 * @param {{positions: Float32Array, colours: Float32Array, sizes: Float32Array,
 *          name?: string}} options
 */
export function createAdditivePoints({ positions, colours, sizes, name = 'points' }) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  geometry.setAttribute('size', new BufferAttribute(sizes, 1));

  const material = new PointsNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });
  material.colorNode = attribute('color', 'vec3');
  material.sizeNode = attribute('size', 'float');

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.name = name;
  points.userData.pointCount = positions.length / 3;
  return points;
}