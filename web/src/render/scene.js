/**
 * The atlas scene: renderer, camera, and the frame loop.
 *
 * The renderer is three's WebGPU renderer, which falls back to WebGL 2 where
 * WebGPU is missing — verified in a headless browser, where it reports
 * `webgl2` and still draws.
 *
 * Near and far bracket the *visible content*, not the camera's distance from
 * the origin: at 360 AU with a far plane set from that distance, every star
 * within a parsec is clipped and the frame comes out black.
 */

import { PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu';

import { CameraRig } from '../core/camera-rig.js';
import { FloatingOrigin } from '../core/floating-origin.js';
import { PerfRecorder } from '../core/perf-recorder.js';
import { PostChain } from './post.js';

const DEFAULT_FOV = 60;
const NEAR_SAFETY = 4;
const FAR_MARGIN = 4;
const FAR_CEILING = 1e26;

export class AtlasScene {
  constructor({ canvas, fovDegrees = DEFAULT_FOV, aspect = 1 } = {}) {
    this.canvas = canvas;
    this.scene = new Scene();
    // No scene background: the void is the page's #05060a, which no tone map or
    // sRGB round trip can crush to black.
    this.scene.background = null;
    this.camera = new PerspectiveCamera(fovDegrees, aspect, 1, FAR_CEILING);
    this.rig = new CameraRig();
    this.origin = new FloatingOrigin();
    this.layers = [];
    this.viewRange = null;
    this.stats = { fps: 0, points: 0, drawCount: 0, backend: 'unknown', frames: 0, near: 0, far: 0 };
    this._frames = 0;
    this.perf = new PerfRecorder();
    this._windowStart = 0;
  }

  async init() {
    this.renderer = new WebGPURenderer({ canvas: this.canvas, antialias: true, alpha: true });
    await this.renderer.init();
    this.stats.backend = this.renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';
    this.post = new PostChain({ renderer: this.renderer, scene: this.scene, camera: this.camera });
    return this;
  }

  addPoints(points) {
    this.scene.add(points);
    this.layers.push(points);
    this.stats.points += points.userData.pointCount ?? 0;
    return points;
  }

  clearPoints() {
    for (const layer of this.layers) {
      this.scene.remove(layer);
      layer.geometry.dispose();
      layer.material.dispose();
    }
    this.layers = [];
    this.stats.points = 0;
    return this;
  }

  resize(width, height) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Distance range of what is drawn, in metres. The depth range follows it.
   * @param {number} minMetres
   * @param {number} maxMetres
   */
  setViewRange(minMetres, maxMetres) {
    this.viewRange = { min: minMetres, max: maxMetres };
    return this;
  }

  depthRange() {
    if (!this.viewRange) return { near: 1e-3, far: FAR_CEILING };
    const near = Math.max(this.viewRange.min / NEAR_SAFETY, 1e-3);
    const far = Math.min(this.viewRange.max * FAR_MARGIN, FAR_CEILING);
    return { near, far: Math.max(far, near * 1000) };
  }

  /** Point the camera and re-centre the origin so render space stays small. */
  syncCamera() {
    const position = this.rig.positionMetres;
    this.origin.update(position);
    const render = this.origin.toRenderSpace(position);
    this.camera.position.set(render[0], render[1], render[2]);
    this.camera.rotation.set(this.rig.pitch, this.rig.yaw, 0, 'YXZ');
    const { near, far } = this.depthRange();
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
    this.stats.near = near;
    this.stats.far = far;
  }

  /** Advance the rig, resync, render a frame. `measured` is the real frame
   *  time when the caller clamps the step for simulation stability. */
  frame(deltaSeconds, measured = deltaSeconds) {
    this.rig.autoDrift(0.004).update(deltaSeconds);
    this.syncCamera();
    this.post.render(this.renderer, this.scene, this.camera);
    this.perf.record(measured);
    this._frames += 1;
    return this;
  }

  /** Frames per second over the last window. */
  measure(nowMs) {
    if (!this._windowStart) this._windowStart = nowMs;
    const elapsed = nowMs - this._windowStart;
    if (elapsed >= 1000) {
      this.stats.fps = (this._frames * 1000) / elapsed;
      this.stats.frames = this._frames;
      this._frames = 0;
      this._windowStart = nowMs;
    }
    return this.stats;
  }
}