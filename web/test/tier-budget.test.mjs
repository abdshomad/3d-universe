/**
 * The budget judges steady state, not startup jank.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { createTierBudget } from '../src/core/tier-budget.js';

/** Feed `count` frames of `ms`, returning the budget. */
function feed(budget, ms, count) {
  for (let i = 0; i < count; i += 1) budget.sample(ms);
  return budget;
}

test('it does not judge during warmup', () => {
  const budget = createTierBudget({ budgetMs: 20, window: 10, warmup: 5 });
  assert.equal(budget.mean(), null, 'no evidence means no mean');
  assert.equal(budget.overBudget(), false, 'and no verdict');
  assert.equal(budget.warm, true);
  feed(budget, 200, 5); // five terrible frames, all inside warmup
  assert.equal(budget.deferred, false, 'startup jank is not a verdict');
  assert.equal(budget.warm, true);
});

test('sustained slow frames defer the tier', () => {
  const budget = createTierBudget({ budgetMs: 20, window: 10, warmup: 2 });
  feed(budget, 33, 20);
  assert.equal(budget.deferred, true);
  assert.equal(budget.overBudget(), true);
  assert.ok(budget.mean() > 20);
});

test('a comfortable budget leaves the tier alone', () => {
  const budget = createTierBudget({ budgetMs: 20, window: 10, warmup: 2 });
  feed(budget, 16.7, 20);
  assert.equal(budget.deferred, false);
  assert.equal(budget.overBudget(), false);
});

test('it recovers once there is headroom again', () => {
  const budget = createTierBudget({ budgetMs: 20, window: 10, warmup: 2 });
  feed(budget, 33, 20);
  assert.equal(budget.deferred, true);
  feed(budget, 8, 20);
  assert.equal(budget.deferred, false, 'cheap frames bring the tier back');
});

test('near the line it holds its verdict rather than flickering', () => {
  const budget = createTierBudget({ budgetMs: 20, window: 10, warmup: 2 });
  feed(budget, 33, 20);
  assert.equal(budget.deferred, true);
  // 18 ms is under budget but within the 15% hysteresis band.
  feed(budget, 18, 20);
  assert.equal(budget.deferred, true, 'still deferred inside the band');
});

test('nonsense samples are ignored', () => {
  const budget = createTierBudget({ budgetMs: 20, window: 10, warmup: 2 });
  feed(budget, -5, 5);
  feed(budget, Number.NaN, 5);
  budget.sample(0);
  assert.equal(budget.warm, true, 'a bad number is not evidence');
});

test('the budget can be tightened at runtime', () => {
  const budget = createTierBudget({ budgetMs: 20, window: 10, warmup: 2 });
  feed(budget, 12, 20);
  assert.equal(budget.deferred, false);
  budget.budgetMs = 8;
  feed(budget, 12, 20);
  assert.equal(budget.deferred, true, 'a tighter budget defers the same frames');
  budget.budgetMs = -1; // nonsense is refused
  assert.equal(budget.budgetMs, 8);
});

test('reset clears the evidence', () => {
  const budget = createTierBudget({ budgetMs: 20, window: 10, warmup: 2 });
  feed(budget, 33, 20);
  budget.reset();
  assert.equal(budget.warm, true);
  assert.equal(budget.deferred, false);
});
