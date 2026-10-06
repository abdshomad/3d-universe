/**
 * The feature tour: a walked line through what the atlas can do.
 *
 * The onboarding hints teach by doing; the tour is the opposite — a
 * short, explicit walk a new visitor is offered once, pointing at the
 * HUD's own pieces in the order they matter. Pure logic: the UI paints
 * whatever comes back and wires the buttons, which is why the rules
 * (where the walk is, where it ends) live here and not in the chrome.
 */

/**
 * @param {Array<{id: string, target: string, title: string, text: string}>} steps
 */
export class Tour {
  constructor(steps = []) {
    if (!Array.isArray(steps)) throw new RangeError('steps must be a list');
    this.steps = steps.map((step) => {
      for (const field of ['id', 'target', 'title', 'text']) {
        if (typeof step?.[field] !== 'string' || !step[field]) {
          throw new RangeError(`every step needs a ${field}`);
        }
      }
      return { ...step };
    });
    this.active = false;
    this.skipped = false;
    this.index = 0;
  }

  /** Begin (or begin again) at the first stop. */
  start() {
    if (!this.steps.length) return this;
    this.active = true;
    this.skipped = false;
    this.index = 0;
    return this;
  }

  /** The walk is over when it is not running — finished or skipped. */
  get finished() {
    return !this.active;
  }

  /**
   * The stop to show, or null when the walk is over.
   * @returns {{index: number, total: number, id: string, target: string,
   *           title: string, text: string}|null}
   */
  current() {
    if (!this.active || this.index >= this.steps.length) return null;
    return { index: this.index, total: this.steps.length, ...this.steps[this.index] };
  }

  /**
   * Move to the next stop. Returns false when that was the last one,
   * so a caller knows to close the chrome and remember the visitor.
   */
  next() {
    if (!this.active) return false;
    this.index += 1;
    if (this.index >= this.steps.length) {
      this.active = false;
      return false;
    }
    return true;
  }

  /** Move back one stop; refused at the first, where there is nothing before. */
  back() {
    if (!this.active || this.index === 0) return false;
    this.index -= 1;
    return true;
  }

  /** End the walk early. The visitor asked, so the walk does not insist. */
  skip() {
    this.active = false;
    this.skipped = true;
  }
}
