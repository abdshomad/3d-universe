/**
 * The deep-field backdrop: real telescope imagery, stacked on parallax planes.
 *
 * The stack is rebuilt only when the camera's scale leaves its band. Rebuilding
 * every frame would move the planes with the camera and quietly turn a skybox
 * into a skybox wearing a disguise; keeping them fixed in world space between
 * rebuilds is what makes the parallax real.
 */

import { Group, TextureLoader } from 'three/webgpu';

import { createFieldPlanes, loadFieldTexture, planeDistance } from './deep-field.js';

const SCALE_BAND = 3; // rebuild when the view scale changes by 3x or more

export class Backdrop {
  /**
   * @param {{fields: object[], urlFor: (field: object) => string,
   *          scene: object, opacity?: number}} options
   */
  constructor({ fields, urlFor, scene, opacity }) {
    this.fields = fields;
    this.urlFor = urlFor;
    this.scene = scene;
    this.opacity = opacity;
    this.loader = new TextureLoader();
    this.root = new Group();
    this.root.name = 'deep-field-backdrop';
    scene.add(this.root);
    this.groups = [];
    this.loaded = false;
    this.builtScale = null;
  }

  /** Download and decode every field texture once. */
  async load() {
    this.groups = this.fields.map((field) => {
      const group = createFieldPlanes(field, {
        textureUrl: this.urlFor(field),
        frameScaleMetres: 1,
        opacity: this.opacity,
      });
      this.root.add(group);
      return group;
    });
    await Promise.all(this.groups.map((group) => loadFieldTexture(group, this.loader)));
    this.loaded = true;
    return this;
  }

  /** True when the camera has left the band this stack was built for. */
  needsRebuild(scaleMetres) {
    if (!this.loaded || !Number.isFinite(scaleMetres) || scaleMetres <= 0) return false;
    if (this.builtScale === null) return true;
    return scaleMetres > this.builtScale * SCALE_BAND || scaleMetres < this.builtScale / SCALE_BAND;
  }

  /**
   * Re-place the planes for the current view scale, in render space.
   * @param {{frameScaleMetres: number, originMetres: number[]}} options
   */
  rebuild({ frameScaleMetres, originMetres }) {
    this.builtScale = frameScaleMetres;
    for (const group of this.groups) {
      const { direction, planes, field } = group.userData;
      for (const plane of planes) {
        const distance = planeDistance(field, frameScaleMetres, plane.userData.depth);
        plane.scale.setScalar(distance * plane.userData.margin);
        plane.position.set(
          direction[0] * distance - originMetres[0],
          direction[1] * distance - originMetres[1],
          direction[2] * distance - originMetres[2],
        );
        // The plane faces the camera, which sits at the render-space origin.
        plane.lookAt(0, 0, 0);
      }
    }
    return this;
  }

  dispose() {
    for (const group of this.groups) {
      for (const plane of group.userData.planes) {
        plane.geometry.dispose();
        plane.material.dispose();
      }
    }
    this.scene.remove(this.root);
  }
}