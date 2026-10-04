/**
 * Frame timing: the harness must be able to fail, not just report.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { PerfRecorder, percentile, summarise } from '../src/core/perf-recorder.js';

const frames = (count, seconds) => Array.from({ length: count }, () => seconds);

test('percentiles interpolate between samples', () => {
  const sorted = [1, 2, 3, 4];
  assert.equal(percentile(sorted, 0), 1);
  assert.equal(percentile(sorted, 1), 4);
  assert.equal(percentile(sorted, 1 / 3), 2, 'a third of three gaps lands on index 1');
  assert.equal(percentile([], 0.5), null);
});

test('a clean run passes and reports its frame rate', () => {
  const report = summarise(frames(120, 1 / 60));
  assert.equal(report.count, 120);
  assert.equal(report.overBudget, 0);
  assert.equal(report.stalls, 0);
  assert.equal(report.passed, true);
  assert.ok(Math.abs(report.fpsFromMedian - 60) < 0.01);
});

test('percentiles hide what an average would hide', () => {
  const smooth = frames(99, 1 / 60);
  const report = summarise([...smooth, 0.5], { budgetFrameSeconds: 1 / 60, stallSeconds: 0.25 });
  const average = report.medianSeconds;
  assert.ok(report.worstSeconds > 25 * average, 'worst frame dwarfs the median');
  assert.equal(report.stalls, 1);
  assert.equal(report.passed, false, 'a stall fails the run');
});

test('a sustained regression fails even without a stall', () => {
  const report = summarise(frames(200, 0.05), { budgetFrameSeconds: 1 / 60, stallSeconds: 0.25 });
  assert.equal(report.overBudget, 200);
  assert.equal(report.passed, false);
});

test('a couple of slow frames in a long run is tolerated', () => {
  const report = summarise([...frames(200, 1 / 60), 0.03, 0.03], {
    budgetFrameSeconds: 1 / 60,
    stallSeconds: 0.25,
  });
  assert.equal(report.overBudget, 2);
  assert.equal(report.passed, true);
});

test('an empty run never passes silently', () => {
  const report = summarise([]);
  assert.equal(report.count, 0);
  assert.equal(report.passed, false);
});

test('the recorder only collects while recording', () => {
  const recorder = new PerfRecorder();
  recorder.record(0.5); // ignored: not recording yet
  recorder.start();
  recorder.record(0.016);
  recorder.record(0.016);
  recorder.stop();
  recorder.record(99); // ignored: stopped
  assert.equal(recorder.report().count, 2);
});