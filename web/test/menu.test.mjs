/**
 * The menu's view model. The rules that matter run
 * without a browser: a kind is an entry only when the
 * scene loaded its dataset, the provenance flag rides
 * through on the entry, and a kind with no dataset is
 * not held, with the reason — an honest absence is
 * information, and a silent one looks like a bug.
 *
 * A held kind is one level deeper: its bodies, brightest
 * first, capped — with the cap stated beside the total,
 * because a silent cap is a missing sky.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { BODY_LIMIT } from '../src/core/celestial-index.js';
import { MENU_KINDS, menuModel, subtitleFor } from '../src/ui/menu.js';

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

/** A body entry, as the celestial index builds them: the
 * row rides whole, so the kind's magnitude field is
 * there under its own name. */
function body(id, name, magnitude, unit = 'AU') {
  return {
    id, name, kind: 'comet', flag: 'MEASURED',
    ra_deg: 0, dec_deg: 0, distance_pc: 1,
    visual_magnitude: magnitude, H: magnitude,
    distance_au: 1, unit,
  };
}

test('a kind lists its bodies, brightest first, with the flag it holds', () => {
  const model = menuModel({
    loaded: [{ kind: 'comet', count: 3, flag: 'MEASURED' }],
    bodies: new Map([['comet', [
      body('sbdb:3', 'faint', 12),
      body('sbdb:1', 'bright', 2),
      body('sbdb:2', 'mid', 7),
    ]]]),
  });
  const list = model.lists.get('comet');
  assert.deepEqual(
    list.bodies.map((entry) => entry.name),
    ['bright', 'mid', 'faint'],
  );
  assert.equal(list.total, 3);
  assert.equal(list.unit, 'AU');
  assert.equal(list.flag, 'MEASURED');
});

test('the cap is stated beside the total, never silently', () => {
  const many = Array.from({ length: 250 }, (_, index) =>
    body(`sbdb:${index}`, `body ${index}`, index));
  const model = menuModel({
    loaded: [{ kind: 'comet', count: 250, flag: 'MEASURED' }],
    bodies: new Map([['comet', many]]),
  });
  const list = model.lists.get('comet');
  assert.equal(list.bodies.length, BODY_LIMIT);
  assert.equal(list.total, 250);
  assert.equal(
    subtitleFor(model, { level: 'bodies', kind: 'comet' }),
    'comets — 100 brightest of 250',
  );
});

test('a kind holding fewer than the cap says how many it holds', () => {
  const model = menuModel({
    loaded: [{ kind: 'planet', count: 8, flag: 'MEASURED' }],
    bodies: new Map([['planet', [body('horizons:1', 'Earth', -3, 'AU')]]]),
  });
  assert.equal(subtitleFor(model, { level: 'kinds' }), '1 of 6 kinds held');
  assert.equal(
    subtitleFor(model, { level: 'bodies', kind: 'planet' }),
    'planets — 1 held',
  );
});

test('a kind whose dataset loaded but yielded no body lists none', () => {
  const model = menuModel({
    loaded: [{ kind: 'comet', count: 1769, flag: 'MEASURED' }],
    bodies: new Map([['comet', []]]),
  });
  const list = model.lists.get('comet');
  assert.equal(list.total, 0);
  assert.equal(list.bodies.length, 0);
  assert.equal(
    subtitleFor(model, { level: 'bodies', kind: 'comet' }),
    'comets — 0 held',
  );
});
