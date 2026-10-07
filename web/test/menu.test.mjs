/**
 * The menu's view model. The rules that matter run
 * without a browser: a kind is an entry only when the
 * scene loaded its dataset, the provenance flag rides
 * through on the entry, and a kind with no dataset is
 * not held, with the reason — an honest absence is
 * information, and a silent one looks like a bug.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { MENU_KINDS, menuModel } from '../src/ui/menu.js';

test('a kind is an entry only when its dataset is loaded', () => {
  const model = menuModel({
    loaded: [
      { kind: 'comet', count: 1769, flag: 'MEASURED' },
      { kind: 'galaxy', count: 10618, flag: 'MEASURED' },
    ],
  });
  assert.deepEqual(
    model.entries.map((entry) => entry.kind),
    ['comet', 'galaxy'],
  );
  assert.equal(model.held, 2);
});

test('the provenance flag rides through on the entry', () => {
  const model = menuModel({
    loaded: [{ kind: 'galaxy', count: 10, flag: 'SIMULATED' }],
  });
  assert.equal(model.entries[0].flag, 'SIMULATED');
});

test('notHeld names its reason', () => {
  const model = menuModel({ loaded: [] });
  assert.equal(model.held, 0);
  assert.equal(model.notHeld.length, MENU_KINDS.length);
  const satellite = model.notHeld.find((entry) => entry.kind === 'satellite');
  assert.equal(satellite.reason, 'no satellites catalogue is loaded');
});

test('entries keep menu order, not load order', () => {
  const model = menuModel({
    loaded: [
      { kind: 'galaxy', count: 1, flag: 'MEASURED' },
      { kind: 'comet', count: 2, flag: 'MEASURED' },
    ],
  });
  assert.deepEqual(
    model.entries.map((entry) => entry.kind),
    ['comet', 'galaxy'],
  );
});

test('a loaded entry without a flag carries none, never a guess', () => {
  const model = menuModel({ loaded: [{ kind: 'planet', count: 8 }] });
  assert.equal(model.entries[0].flag, null);
});

test('the count and label are the dataset\'s own and the menu\'s own', () => {
  const model = menuModel({
    loaded: [{ kind: 'black_hole', count: 33, flag: 'MEASURED' }],
  });
  assert.equal(model.entries[0].count, 33);
  assert.equal(model.entries[0].label, 'black holes');
});
