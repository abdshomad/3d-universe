/**
 * Onboarding: teach by doing, not by interrupting.
 *
 * A tutorial wall is a confession that the interface is unclear. This is a set
 * of single-line hints that appear only when they are relevant and retire the
 * moment the thing they describe has been done. Hints are independent timers,
 * not a queue: they share one slot in the HUD, and the most recent one wins, so
 * a long-lived hint never blocks the next thing worth saying.
 *
 * Pure logic: the HUD renders whatever comes back, which may be nothing.
 */

export class Onboarding {
  /**
   * @param {Array<{id: string, text: string, showAfter?: number, showFor?: number,
   *                hideOn?: string}>} steps
   * @param {{now?: () => number}} options
   */
  constructor(steps = [], { now = () => 0 } = {}) {
    if (!Array.isArray(steps)) throw new RangeError('steps must be a list');
    this.steps = steps.map((step) => ({
      showAfter: 0,
      showFor: 14,
      ...step,
      retired: false,
    }));
    this.now = now;
    this.startedAt = null;
    this.dismissed = false;
    this.actions = new Set();
  }

  start() {
    this.startedAt = this.now();
    return this;
  }

  get elapsed() {
    return this.startedAt === null ? 0 : this.now() - this.startedAt;
  }

  /** Record that the viewer did something; hints about it retire. */
  record(actionId) {
    if (actionId) this.actions.add(actionId);
    return this;
  }

  /** Never show hints again — the viewer asked, or they have flown enough. */
  dismiss() {
    this.dismissed = true;
    return this;
  }

  get finished() {
    return this.dismissed || this.steps.every((step) => this._retired(step));
  }

  /**
   * The one hint to show right now, or null.
   * @returns {{id: string, text: string}|null}
   */
  current() {
    if (this.dismissed || this.startedAt === null) return null;
    const elapsed = this.elapsed;
    let best = null;
    for (const step of this.steps) {
      if (this._retired(step)) continue;
      if (elapsed > step.showAfter + step.showFor) {
        step.retired = true;
        continue;
      }
      if (elapsed < step.showAfter) continue;
      if (!best || step.showAfter > best.showAfter) best = step;
    }
    return best ? { id: best.id, text: best.text } : null;
  }

  _retired(step) {
    return step.retired === true || Boolean(step.hideOn && this.actions.has(step.hideOn));
  }
}
