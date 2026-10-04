/**
 * Frame timing recorder and budget check.
 *
 * Pure functions: the harness feeds it frame durations and gets back numbers it
 * can decide on. Percentiles rather than an average, because the average hides
 * exactly the stutter people notice.
 */

const DEFAULT_BUDGET = {
  budgetFrameSeconds: 1 / 60,
  stallSeconds: 0.25,
};

/**
 * @param {number[]} samples frame durations in seconds
 * @param {{budgetFrameSeconds?: number, stallSeconds?: number}} options
 */
export function summarise(samples, options = {}) {
  const { budgetFrameSeconds, stallSeconds } = { ...DEFAULT_BUDGET, ...options };
  if (!Array.isArray(samples) || samples.length === 0) {
    return {
      count: 0,
      medianSeconds: null,
      p95Seconds: null,
      p99Seconds: null,
      worstSeconds: null,
      fpsFromMedian: null,
      overBudget: 0,
      stalls: 0,
      passed: false,
      budgetFrameSeconds,
      stallSeconds,
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);
  const worst = sorted[sorted.length - 1];
  const overBudget = sorted.filter((value) => value > budgetFrameSeconds).length;
  const stalls = sorted.filter((value) => value > stallSeconds).length;

  return {
    count: sorted.length,
    medianSeconds: median,
    p95Seconds: p95,
    p99Seconds: p99,
    worstSeconds: worst,
    fpsFromMedian: median > 0 ? 1 / median : null,
    overBudget,
    stalls,
    // A frame or two over budget is noise; a run where a quarter of the frames
    // are late is a regression.
    passed: stalls === 0 && overBudget <= Math.max(1, Math.floor(sorted.length * 0.05)),
    budgetFrameSeconds,
    stallSeconds,
  };
}

/** Linear-interpolated percentile over a pre-sorted array. */
export function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const position = fraction * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Rolling recorder the page feeds one frame at a time. */
export class PerfRecorder {
  constructor() {
    this.samples = [];
    this.recording = false;
  }

  start() {
    this.samples = [];
    this.recording = true;
    return this;
  }

  stop() {
    this.recording = false;
    return this.samples;
  }

  record(frameSeconds) {
    if (this.recording) this.samples.push(frameSeconds);
  }

  report(options) {
    return summarise(this.samples, options);
  }
}