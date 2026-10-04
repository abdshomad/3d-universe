/**
 * Tier budget: decides whether an *optional* tier can still afford to draw.
 *
 * `FrameBudgetController` in `./frame-budget.js` spends the star count to hold
 * a frame rate. This answers a different question: should a tier that is pure
 * enhancement stay on screen at all? A rolling mean over the last `window`
 * frames, ignoring a warmup so first-paint and shader-compilation jank is not
 * mistaken for steady state. It reports one-way while over budget but recovers
 * once there is headroom, so a tier comes back rather than flickering.
 */

const DEFAULTS = {
  budgetMs: 20,
  window: 60,
  warmup: 20,
};

export function createTierBudget(options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const { window: size, warmup } = settings;
  let budget = settings.budgetMs;
  const samples = [];
  let seen = 0;
  let deferred = false;

  function mean() {
    if (samples.length === 0) return null;
    return samples.reduce((total, ms) => total + ms, 0) / samples.length;
  }

  return {
    get budgetMs() {
      return budget;
    },

    set budgetMs(value) {
      if (Number.isFinite(value) && value > 0) budget = value;
    },

    /** Feed one frame's duration in milliseconds. */
    sample(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return deferred;
      seen += 1;
      if (seen > warmup) {
        samples.push(ms);
        if (samples.length > size) samples.shift();
      }
      const current = mean();
      if (current === null) return deferred; // no evidence yet: do not judge
      if (current > budget) deferred = true;
      else if (current < budget * 0.85) deferred = false;
      return deferred;
    },

    /** Rolling mean, or null during warmup. */
    mean,

    get warm() {
      return samples.length === 0;
    },

    get deferred() {
      return deferred;
    },

    /** True only when we have evidence, never during warmup. */
    overBudget() {
      const current = mean();
      return current !== null && current > budget;
    },

    reset() {
      samples.length = 0;
      seen = 0;
      deferred = false;
    },
  };
}
