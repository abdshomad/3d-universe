/**
 * Frame budget: the atlas sheds stars before it drops frames, and does not
 * breathe while doing it.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { FrameBudgetController } from '../src/core/frame-budget.js';

const FRAME_60 = 1 / 60;
const FRAME_20 = 1 / 20;

function run(controller, seconds, frameSeconds, fps = 60) {
  const frames = Math.round(seconds * fps);
  let changed = 0;
  for (let i = 0; i < frames; i += 1) {
    if (controller.sample(frameSeconds).changed) changed += 1;
  }
  return changed;
}

test('a comfortable frame rate keeps the whole sky', () => {
  const controller = new FrameBudgetController({ maxPoints: 100000, window: 5 });
  run(controller, 5, FRAME_60 / 2);
  assert.equal(controller.budgetPoints, 100000);
  assert.equal(controller.drops, 0);
});

test('slow frames cut the budget quickly', () => {
  const controller = new FrameBudgetController({ maxPoints: 100000, minPoints: 1000, window: 5 });
  run(controller, 2, FRAME_20);
  assert.ok(controller.budgetPoints < 100000 * 0.2, `budget ${controller.budgetPoints}`);
  assert.ok(controller.drops > 2);
});

test('the budget never falls below the floor', () => {
  const controller = new FrameBudgetController({ maxPoints: 100000, minPoints: 1000, window: 5 });
  run(controller, 60, FRAME_20);
  assert.equal(controller.budgetPoints, 1000);
});

test('a single slow frame does not move the budget', () => {
  const controller = new FrameBudgetController({ maxPoints: 100000, window: 10 });
  run(controller, 1, FRAME_60 / 2);
  const before = controller.budgetPoints;
  controller.sample(FRAME_20);
  assert.equal(controller.budgetPoints, before);
});

test('the budget recovers slowly and never overshoots', () => {
  const controller = new FrameBudgetController({ maxPoints: 50000, minPoints: 1000, window: 5 });
  run(controller, 2, FRAME_20);
  const thinned = controller.budgetPoints;
  const fastFrames = Math.round(3 * 60);
  for (let i = 0; i < fastFrames; i += 1) controller.sample(FRAME_60 / 2);
  assert.ok(controller.budgetPoints > thinned, 'points come back');
  assert.ok(controller.budgetPoints <= 50000, 'never above the ceiling');
});

test('warm-up frames are ignored', () => {
  const controller = new FrameBudgetController({ window: 10 });
  for (let i = 0; i < 9; i += 1) controller.sample(FRAME_20);
  assert.equal(controller.budgetPoints, controller.maxPoints);
  assert.equal(controller.meanFrameSeconds, null);
});

test('overshoot reports how far the frame rate has drifted', () => {
  const controller = new FrameBudgetController({ window: 4 });
  run(controller, 1, FRAME_60, 60);
  assert.ok(Math.abs(controller.overshoot()) < 1e-9, `overshoot ${controller.overshoot()}`);
});

test('nonsense configuration is refused', () => {
  assert.throws(() => new FrameBudgetController({ dropFactor: 1.5 }), /below 1/);
  assert.throws(() => new FrameBudgetController({ recoverFactor: 0.9 }), /above 1/);
  assert.throws(() => new FrameBudgetController({ minPoints: 0 }), /bounds/);
  assert.throws(() => new FrameBudgetController().sample(-1), /negative/);
});