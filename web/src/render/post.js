/**
 * Post chain: bloom, and a void that stays #05060a.
 *
 * Bloom is what makes stars read as light rather than pixels: the reference
 * frames bleed, and a hard dot never does. The threshold is deliberately low so
 * faint stars glow too — the medium is supposed to look luminous.
 *
 * Three findings shaped this file, all measured in a browser rather than
 * assumed:
 *
 * - A void set as a scene background colour is crushed to `#000000` by the
 *   colour round trip. So the floor is applied last, in display space.
 * - The scene pass already carries display-encoded colour. Adding ACES and an
 *   sRGB encode on top darkened every star twice: 92 bright pixels fell to 0
 *   while the frame got dimmer instead of richer. Tone mapping returns when the
 *   scene carries HDR content, where highlights need rolling off.
 * - The pass node is **RGBA**. `vec4(max(vec4, vec3), 1)` is five components;
 *   the node builder rejects it and the entire chain silently disappears,
 *   including the floor. Take the colour channels and keep the alpha.
 */

import { PostProcessing } from 'three/webgpu';
import { max, pass, vec3, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

import { DEFAULT_BLOOM, VOID_COLOUR } from './post-settings.js';

export { DEFAULT_BLOOM, VOID_COLOUR, vignetteAt } from './post-settings.js';

/** The void as a display-space colour, applied after everything else. */
export const VOID_DISPLAY = vec3(
  ((VOID_COLOUR >> 16) & 255) / 255,
  ((VOID_COLOUR >> 8) & 255) / 255,
  (VOID_COLOUR & 255) / 255,
);

export class PostChain {
  /**
   * @param {{renderer: object, scene: object, camera: object,
   *          bloom?: {strength: number, radius: number, threshold: number}}} options
   */
  constructor({ renderer, scene, camera, bloom: settings = DEFAULT_BLOOM }) {
    const colour = pass(scene, camera).getTextureNode();
    this.bloomNode = bloom(colour, settings.strength, settings.radius, settings.threshold);
    const lit = colour.add(this.bloomNode);

    this.post = new PostProcessing(renderer);
    this.post.outputColorTransform = false;
    this.post.outputNode = vec4(max(lit.rgb, VOID_DISPLAY), lit.a);
    this.settings = settings;
    this.enabled = true;
  }

  /** Turn the chain off to see the raw frame; used to compare in a browser. */
  setEnabled(enabled) {
    this.enabled = enabled;
    return this;
  }

  render(renderer, scene, camera) {
    if (!this.enabled) {
      renderer.render(scene, camera);
      return;
    }
    this.post.render();
  }

  dispose() {
    this.post.dispose?.();
  }
}