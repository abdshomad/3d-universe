/**
 * Frame budget: shed stars before the frame rate suffers.
 *
 * Star count is the only dial the renderer has, so the controller spends it in
 * the one direction that matters. When frames run long it drops points quickly,
 * because a stuttering atlas is worse than a thinner one; when frames recover
 * it adds points slowly, because a budget that oscillates is visible as
 * breathing.
 */

const DEFAULT_TARGET_FPS = 60;
const DEFAULT_WINDOW = 20;

export class FrameBudgetController {
  /**
   * @param {{targetFps?: number, minPoints?: number, maxPoints?: number,
   *          dropFactor?: number, recoverFactor?: number, window?: number}} options
   */
  constructor({
    targetFps = DEFAULT_TARGET_FPS,
    minPoints = 2000,
    maxPoints = 300000,
    dropFactor = 0.7,
    recoverFactor = 1.1,
    window = DEFAULT_WINDOW,
  } = {}) {
    if (minPoints <= 0 || maxPoints < minPoints) throw new RangeError('bad point bounds');
    if (!(dropFactor > 0 && dropFactor < 1)) throw new RangeError('dropFactor must be below 1');
    if (!(recoverFactor > 1)) throw new RangeError('recoverFactor must be above 1');

    this.targetFrameSeconds = 1 / targetFps;
    this.minPoints = minPoints;
    this.maxPoints = maxPoints;
    this.dropFactor = dropFactor;
    this.recoverFactor = recoverFactor;
    this.window = window;

    this.budgetPoints = maxPoints;
    this.frames = [];
    this.drops = 0;
    this.recoveries = 0;
    this.meanFrameSeconds = null;
  }

  /**
   * Feed one frame's duration.
   * @param {number} frameSeconds
   * @returns {{changed: boolean, budgetPoints: number, meanFrameSeconds: number|null}}
   */
  sample(frameSeconds) {
    if (!(frameSeconds >= 0)) throw new RangeError('frameSeconds must not be negative');
    this.frames.push(frameSeconds);
    if (this.frames.length > this.window) this.frames.shift();
    if (this.frames.length < this.window) return this.result(false);

    const mean = this.frames.reduce((total, value) => total + value, 0) / this.frames.length;
    this.meanFrameSeconds = mean;

    const before = this.budgetPoints;
    if (mean > this.targetFrameSeconds * 1.1) {
      this.budgetPoints = Math.max(this.minPoints, this.budgetPoints * this.dropFactor);
      if (this.budgetPoints < before) this.drops += 1;
    } else if (mean < this.targetFrameSeconds * 0.7) {
      this.budgetPoints = Math.min(this.maxPoints, this.budgetPoints * this.recoverFactor);
      if (this.budgetPoints > before) this.recoveries += 1;
    }
    this.budgetPoints = Math.round(this.budgetPoints);
    return this.result(this.budgetPoints !== before);
  }

  result(changed) {
    return {
      changed,
      budgetPoints: this.budgetPoints,
      meanFrameSeconds: this.meanFrameSeconds,
    };
  }

  /** How far the frame rate has drifted from the target, for the HUD. */
  overshoot() {
    if (!this.meanFrameSeconds) return 0;
    return this.meanFrameSeconds / this.targetFrameSeconds - 1;
  }
}