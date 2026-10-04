/**
 * Deep fields as parallax planes.
 *
 * Not a skybox. A skybox is painted onto a sphere locked to the camera, so the
 * sky never changes as you move — which is exactly the lie a 3D atlas cannot
 * tell. Here each field is stacked on several planes at real distances, so
 * moving the camera parallaxes the layers against each other and the void gains
 * depth.
 *
 * Placement is ICRS degrees in, unit direction out — the same numbers the route
 * uses to aim the camera at the field it is looking at.
 *
 * Three things the first attempt got wrong, all visible on screen:
 * - the texture was decoded as linear, washing a dark field out to khaki;
 * - four additive copies of the same image summed the JPEG noise floor into a
 *   flat grey wall instead of a faint wash, so the stack is dimmer per plane;
 * - the plane's own edge was inside the frame, drawing a hard rectangle, so the
 *   plane is now larger than the field it covers.
 */

import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from 'three/webgpu';
import { celestialDirection } from '../core/celestial.js';
import { FIELD_DEPTHS } from '../data/deep-fields.js';

const DEGREE = Math.PI / 180;
const FRAME_MARGIN = 1.8;
const PLANE_OPACITY = 0.5;

export { celestialDirection as icrsDirection };

/** Every field is placed the same way: ICRS degrees in, unit direction out. */
export function fieldDirection(field) {
  return celestialDirection(field.raDeg, field.decDeg);
}

/** Distance in metres at which a field of `extentDeg` covers the frame. */
export function planeDistance(field, frameScaleMetres, depth) {
  const halfAngleRad = ((field.extentDeg ?? 5) / 2) * DEGREE;
  return Math.max((frameScaleMetres * depth) / Math.tan(halfAngleRad), 1);
}

/**
 * Build the stacked planes for one field.
 * @param {object} field catalogue entry
 * @param {{textureUrl: string, frameScaleMetres: number, depths?: number[],
 *          opacity?: number, margin?: number}} options
 */
export function createFieldPlanes(field, {
  textureUrl,
  frameScaleMetres,
  depths = FIELD_DEPTHS,
  opacity = PLANE_OPACITY,
  margin = FRAME_MARGIN,
}) {
  const group = new Group();
  group.name = `deep-field:${field.id}`;
  const direction = fieldDirection(field);
  const texture = new Texture();
  texture.colorSpace = SRGBColorSpace;

  const planes = depths.map((depth, index) => {
    const distance = planeDistance(field, frameScaleMetres, depth);
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      // Farther planes are dimmer, so the stack reads as depth rather than as a
      // smear of the same image.
      opacity: opacity * (depths.length - index) / depths.length,
    });
    const mesh = new Mesh(geometry, material);
    mesh.scale.setScalar(distance * margin);
    mesh.position.set(direction[0], direction[1], direction[2]).multiplyScalar(distance);
    mesh.lookAt(0, 0, 0);
    mesh.renderOrder = -100 + index;
    mesh.userData = { depth, distance, margin, opacity: material.opacity };
    group.add(mesh);
    return mesh;
  });

  group.userData = { field, direction, planes, texture, textureUrl, margin };
  return group;
}

/** Load the texture for a field group; resolves once the image is decoded. */
export function loadFieldTexture(group, loader) {
  const texture = group.userData.texture;
  return new Promise((resolve, reject) => {
    loader.load(group.userData.textureUrl, (loaded) => {
      texture.image = loaded.image;
      texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
      for (const plane of group.userData.planes) {
        plane.material.map = texture;
        plane.material.needsUpdate = true;
      }
      resolve(texture);
    }, undefined, reject);
  });
}