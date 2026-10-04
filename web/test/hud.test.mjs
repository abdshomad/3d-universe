/**
 * HUD: the badge has to tell the truth about what is on screen.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { NAV_ITEMS, hudModel, provenanceBadge, starFactCard } from '../src/ui/hud.js';

test('the badge names the strongest provenance claim on screen', () => {
  assert.equal(provenanceBadge({ MEASURED: true }), 'MEASURED');
  assert.equal(provenanceBadge({ MEASURED: true, UNRESOLVED: true }), 'UNRESOLVED');
  assert.equal(
    provenanceBadge({ MEASURED: true, UNRESOLVED: true, SIMULATED: true }),
    'SIMULATED',
    'a simulated object outranks everything else',
  );
  assert.equal(provenanceBadge({}), 'EMPTY');
});

test('the chrome is a fixed, small set of items', () => {
  const model = hudModel();
  assert.equal(model.nav.length, 4);
  assert.deepEqual(model.nav, NAV_ITEMS);
  assert.equal(model.title, '3D UNIVERSE');
});

test('with nothing selected there is no fact card', () => {
  const model = hudModel({ stats: { points: 1200 } });
  assert.equal(model.factCard, null);
  assert.equal(model.readout.objects, 1200);
});

test('a selected star gets parameters and a provenance line', () => {
  const card = starFactCard({
    id: '5853498713190525696',
    distancePc: 1.302,
    magnitude: 8.98,
    colorIndex: 3.8,
  });
  assert.equal(card.rows.length, 4);
  assert.deepEqual(card.rows[0], ['catalogue id', '5853498713190525696']);
  assert.match(card.rows[1][1], /1\.30 pc/);
  assert.match(card.provenance, /esa\.gaia/, 'a card without a source is not a fact');
});
test('distances are shown in sensible units', () => {
  const at = (pc) => starFactCard({ id: 'x', distancePc: pc }).rows[1][1];
  assert.match(at(0.5), /AU$/);
  assert.match(at(2500), /kpc$/);
  assert.match(at(5e7), /Mpc$/);
  assert.equal(starFactCard({ id: 'x', distancePc: null }).rows[1][1], '—');
});

test('a missing magnitude is shown as unknown, not as zero', () => {
  const card = starFactCard({ id: 'x', magnitude: null, colorIndex: undefined });
  assert.equal(card.rows[2][1], '—');
  assert.equal(card.rows[3][1], '—');
});

test('the readout carries objects, distance range and source', () => {
  const model = hudModel({
    stats: { points: 3000, fps: 59.94, backend: 'webgl2', waypoint: 'sol' },
    minPc: 0.1,
    maxPc: 500,
    sources: ['esa.gaia DR3'],
  });
  assert.equal(model.readout.objects, 3000);
  assert.equal(model.readout.distance, '20626.5 AU – 500.00 pc');
  assert.equal(model.readout.source, 'esa.gaia DR3');
  assert.equal(model.fps, 59.9);
  assert.equal(model.waypoint, 'sol');
});
