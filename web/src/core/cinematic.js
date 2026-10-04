/**
 * Cinematic auto-fly: an authored camera path the viewer can take back.
 *
 * This drives the machinery that already exists — a route of sampled poses and a
 * camera rig — rather than adding a camera system. What it adds is *timing*: a
 * hold at each scale, so the eye can catch up with what it is travelling through,
 * and an interrupt that is absolute. The observer is the point of this project;
 * a mode that keeps the pointer is the failure of it.
 *
 * Off by default. Never offered to someone who has asked for reduced motion.
 */

export class Cinematic {
  /**
   * @param {Array<{id: string, travel: number, hold?: number,
   *                positionMetres: number[], yaw: number, pitch: number,
   *                caption?: string}>} steps
   * @param {{now?: () => number}} options
   */
  constructor(steps = [], { now = () => 0 } = {}) {
    if (!Array.isArray(steps)) throw new RangeError('steps must be a list');
    this.steps = steps.map((step) => ({ travel: 6, hold: 4, ...step }));
    this.now = now;
    this.active = false;
    this.dismissed = false;
    this.finished = false;
    this.elapsed = 0;
    this.startedAt = 0;
    this.index = 0;
    this.stepElapsed = 0;
  }

  get duration() {
    return this.steps.reduce((total, step) => total + step.travel + step.hold, 0);
  }

  get current() {
    return this.active || this.finished ? this.steps[Math.min(this.index, this.steps.length - 1)] : null;
  }

  /** 0 to 1 across the whole path. */
  get progress() {
    const total = this.duration;
    return total === 0 ? 1 : Math.min(1, this.elapsed / total);
  }

  start() {
    if (this.steps.length === 0) return false;
    this.active = true;
    this.dismissed = false;
    this.finished = false;
    this.elapsed = 0;
    this.index = 0;
    this.stepElapsed = 0;
    this.startedAt = this.now();
    return true;
  }

  /**
   * Any interaction ends it. There is no grace period and no "are you sure":
   * a viewer who touches the controls has answered.
   * @returns {boolean} true if this call ended the mode
   */
  record(action) {
    if (!this.active) return false;
    if (action === 'start') return false;
    this.dismiss(action);
    return true;
  }

  /** End it. Returns true only if this call is what ended it. */
  dismiss(action = 'dismissed') {
    if (!this.active) return false;
    this.active = false;
    this.dismissed = true;
    this.dismissedBy = action;
    return true;
  }

  /**
   * Advance the clock. Returns the pose to hold, or null when not running.
   * A step's `travel` is the move, `hold` is the stillness that lets the eye read
   * the scale it has just arrived at.
   */
  update(deltaSeconds) {
    if (!this.active) return null;
    const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    this.elapsed += delta;
    this.stepElapsed += delta;

    let step = this.steps[this.index];
    while (step && this.stepElapsed >= step.travel + step.hold) {
      this.stepElapsed -= step.travel + step.hold;
      this.index += 1;
      step = this.steps[this.index];
      if (!step) {
        this.active = false;
        this.finished = true;
        return null;
      }
    }
    return step ?? null;
  }

  /** Where the camera is within the current step, 0 before the hold begins. */
  get stepPhase() {
    const step = this.steps[this.index];
    if (!step) return 1;
    return Math.min(1, this.stepElapsed / Math.max(step.travel, 1e-9));
  }

  get holding() {
    const step = this.steps[this.index];
    return Boolean(step) && this.stepElapsed > step.travel;
  }
}
