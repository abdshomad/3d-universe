/**
 * A link either restores what the sender was looking at, or says it could not.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSelection, selectionKindOf } from '../src/core/selection-resolver.js';

const field = {
  grid: 4,
  radiusMpc: 500,
  cellMpc: 125,
  flag: 'SIMULATED',
  seed: 20261004,
  method: 'Gaussian random field',
  quantise: { floor: 0.35, ceiling: 4.5 },
  scienceReference: 'DESI DR1',
  cells: new Uint8Array(64).fill(120),
};

test('an id names its kind before anything is loaded', () => {
  assert.equal(selectionKindOf('lss:21'), 'cell');
  assert.equal(selectionKindOf('pulsar:B0833-45'), 'event');
  assert.equal(selectionKindOf('hip:32349'), 'landmark');
  assert.equal(selectionKindOf('3891136711141807232'), 'star');
  assert.equal(selectionKindOf(''), 'none');
  assert.equal(selectionKindOf('what'), 'unknown');
});

test('a cell id restores the same shape a click produces', () => {
  const { kind, selection } = resolveSelection({ selectionId: 'lss:21', field });
  assert.equal(kind, 'cell');
  assert.equal(selection.kind, 'field');
  assert.deepEqual([selection.cell.x, selection.cell.y, selection.cell.z], [1, 1, 1]);
  assert.equal(selection.cell.quantised, 120);
});

test('an event id restores the catalogue row', () => {
  const event = { id: 'pulsar:B0833-45', kind: 'pulsar', period_s: 0.089, citation: { dataset: 'ATNF' } };
  const { kind, selection } = resolveSelection({ selectionId: 'pulsar:B0833-45', events: [event] });
  assert.equal(kind, 'event');
  assert.equal(selection.period_s, 0.089);
  assert.equal(selection.citation.dataset, 'ATNF');
});

test('a landmark id resolves through the search index', () => {
  const entries = [{ id: 'hip:32349', name: 'Sirius', distance_pc: 2.64 }];
  const { kind, selection } = resolveSelection({ selectionId: 'hip:32349', searchEntries: entries });
  assert.equal(kind, 'landmark');
  assert.equal(selection.name, 'Sirius');
});

test('a star id resolves through the tile ids', () => {
  const starIds = [100n, 200n];
  const { kind, selection } = resolveSelection({ selectionId: '200', starIds });
  assert.equal(kind, 'star');
  assert.equal(selection.pointIndex, 1);
});

test('an id that names nothing is reported, never dropped in silence', () => {
  const made = resolveSelection({ selectionId: 'lss:9999', field });
  assert.equal(made.kind, 'unknown');
  assert.equal(made.selection, null);
  assert.equal(made.requested, 'lss:9999', 'and it says what it was asked for');

  assert.equal(resolveSelection({ selectionId: 'pulsar:nope', events: [] }).kind, 'unknown');
  assert.equal(resolveSelection({ selectionId: 'nothing-like-this' }).kind, 'unknown');
});

test('a cell id with no field loaded is unknown, not a crash', () => {
  const { kind, selection } = resolveSelection({ selectionId: 'lss:21' });
  assert.equal(kind, 'unknown');
  assert.equal(selection, null);
});

test('an uncited event is refused: a number with no source is not a card', () => {
  const { kind } = resolveSelection({
    selectionId: 'pulsar:B0833-45',
    events: [{ id: 'pulsar:B0833-45', kind: 'pulsar', period_s: 0.089 }],
  });
  assert.equal(kind, 'unknown');
});

test('no selection is not an unknown selection', () => {
  const { kind, requested } = resolveSelection({ selectionId: '' });
  assert.equal(kind, 'none');
  assert.equal(requested, '');
});
