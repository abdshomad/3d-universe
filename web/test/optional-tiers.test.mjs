/**
 * The frame budget sheds optional tiers, and only optional
 * tiers: a layer that is not registered is never deferred,
 * and each registered layer keeps its own flag.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { OptionalTiers } from '../src/core/optional-tiers.js';

const layer = () => ({ visible: true });

test('a deferral flips every registered layer, each on its own flag', () => {
  const tiers = new OptionalTiers();
  const first = layer();
  const second = layer();
  tiers.register(first);
  tiers.register(second);
  tiers.applyBudget(true);
  assert.equal(first.visible, false);
  assert.equal(second.visible, false);
});

test('a layer that is not registered is never deferred', () => {
  const tiers = new OptionalTiers();
  const registered = layer();
  const outside = layer();
  tiers.register(registered);
  tiers.applyBudget(true);
  assert.equal(registered.visible, false);
  assert.equal(outside.visible, true, 'the budget reaches only what it was given');
});

test('headroom restores every tier', () => {
  const tiers = new OptionalTiers();
  const first = layer();
  tiers.register(first);
  tiers.applyBudget(true);
  tiers.applyBudget(false);
  assert.equal(first.visible, true);
});

test('restore is the same verdict as headroom', () => {
  const tiers = new OptionalTiers();
  const registered = layer();
  tiers.register(registered);
  tiers.applyBudget(true);
  tiers.restore();
  assert.equal(registered.visible, true);
});

test('a rebuild stops the old layer being deferred', () => {
  const tiers = new OptionalTiers();
  const stale = layer();
  const fresh = layer();
  tiers.register(stale);
  tiers.unregister(stale);
  tiers.register(fresh);
  tiers.applyBudget(true);
  assert.equal(stale.visible, true, 'the replaced layer is no longer the budget\'s to shed');
  assert.equal(fresh.visible, false);
});

test('register refuses something that is not a layer', () => {
  const tiers = new OptionalTiers();
  assert.throws(() => tiers.register({}), TypeError);
  assert.throws(() => tiers.register(null), TypeError);
});
