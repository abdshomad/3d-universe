/**
 * The celestial-body cards. Each leads with what its
 * catalogue measured, says how a derived distance was
 * derived, and reads a limit flag as a limit — a limit is
 * not a value.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { cardFor } from '../src/ui/fact-card.js';
import {
  cardForBlackHole,
  cardForComet,
  cardForGalaxy,
  cardForPlanet,
  cardForSatellite,
} from '../src/ui/celestial-cards.js';

const PROVENANCE = 'test.catalog 1 · U3DTILE2 · measured';
const AU_IN_PC = 1 / 206265;

const row = (card, label) => card.rows.find(([name]) => name === label)?.[1];

test('a planet card is an ephemeris row', () => {
  const card = cardForPlanet({
    kind: 'planet', id: '199', name: 'Mercury',
    distancePc: 1.378 * AU_IN_PC, apmag: 0.46, radius_km: 2439.4,
    mass_kg: 3.3e23, v_zero: -0.42, albedo: 0.106, delta_au: 1.378,
    epoch: '2026-01-01', ephemeris_source: 'DE441',
    provenance: PROVENANCE,
  }, { observerYear: 2026 });
  assert.equal(card.name, 'Mercury');
  assert.equal(card.provenance, PROVENANCE);
  assert.equal(row(card, 'ephemeris'), 'DE441');
  assert.equal(row(card, 'epoch'), '2026-01-01');
  assert.match(row(card, 'light left'), /min/, 'a planet is minutes of light travel away');
  assert.match(row(card, 'distance'), /1\.378 AU/);
});

test('a satellite card is the same ephemeris under its own name', () => {
  const card = cardForSatellite({
    kind: 'satellite', id: '301', name: 'Moon',
    distancePc: 0.0024 * AU_IN_PC, apmag: 0.99, radius_km: 1737.5,
    mass_kg: 7.3e22, v_zero: 0.21, albedo: 0.12, delta_au: 0.0024,
    epoch: '2026-01-01', ephemeris_source: 'DE441',
    provenance: PROVENANCE,
  }, { observerYear: 2026 });
  assert.equal(card.name, 'Moon');
  assert.match(row(card, 'radius'), /1737\.5 km/);
});

test('a comet card carries its orbit and epoch', () => {
  const card = cardForComet({
    kind: 'comet', id: '1000036', name: '1P/Halley', designation: '1P',
    H: 5.5, diameter_km: 11, distance_au: 28.12, a_au: 17.93, e: 0.9679,
    epoch: '1968-01-20', distancePc: 28.12 * AU_IN_PC,
    provenance: PROVENANCE,
  }, { observerYear: 2026 });
  assert.equal(card.name, '1P/Halley');
  assert.match(row(card, 'orbit'), /a 17\.93 AU, e 0\.9679/);
  assert.equal(row(card, 'epoch'), '1968-01-20', 'a comet position is an epoch, not a fact');
});

test('a galaxy card states how its distance was measured', () => {
  const card = cardForGalaxy({
    kind: 'galaxy', id: '11752', name: 'UGC 2556',
    distance_mpc: 87.16, distance_method: 'redshift, Hubble law with H0 = 70 km/s/Mpc',
    cz_km_s: 6101, type: '.SAS4*.', d25_arcmin: 1.08, bt_mag: 13.82,
    distancePc: 87.16e6, provenance: PROVENANCE,
  }, { observerYear: 2026 });
  assert.match(row(card, 'distance by'), /Hubble law with H0 = 70/, 'a redshift distance says so');
  assert.match(row(card, 'redshift cz'), /6101 km\/s/);
  assert.match(row(card, 'light left'), /yr/, 'a galaxy is years of light travel away');
});

test('a black-hole card reads a limit flag as a limit', () => {
  const card = cardForBlackHole({
    kind: 'black_hole', id: '5', name: 'SWIFT J174510.8-262411',
    distance_kpc: 7, distance_limit: '<',
    distance_source: 'corral-santana-tablea1-limit',
    distancePc: 7000, provenance: PROVENANCE,
  }, { observerYear: 2026 });
  assert.match(row(card, 'distance'), /≤ 7\.0 kpc/, 'a "<" is an upper limit, not a value');
  assert.equal(row(card, 'mass'), '—', 'a missing mass is a dash, not a zero');
});

test('an asymmetric mass uncertainty is shown as one', () => {
  const card = cardForBlackHole({
    kind: 'black_hole', id: '1', name: 'GS 2023+338',
    distance_kpc: 2.5, mass_sun: 9.6, mass_limit: null,
    mass_upper_sun: 0.2, mass_lower_sun: 0.6, mass_source: 'dynamical',
    distancePc: 2500, provenance: PROVENANCE,
  }, { observerYear: 2026 });
  assert.match(row(card, 'mass uncertainty'), /\+0\.2 \/ −0\.6 M☉/);
  assert.match(row(card, 'mass'), /9\.6 M☉/);
});

test('a missing value is a dash, never a zero', () => {
  const card = cardForPlanet({
    kind: 'planet', id: '1', name: 'X', radius_km: null, mass_kg: null,
    distancePc: 1e-5, provenance: PROVENANCE,
  }, { observerYear: 2026 });
  assert.equal(row(card, 'radius'), '—');
  assert.equal(row(card, 'mass'), '—');
});

test('cardFor dispatches every celestial kind', () => {
  for (const kind of ['planet', 'satellite', 'comet', 'galaxy', 'black_hole']) {
    const card = cardFor({ kind, id: '1', name: 'named', provenance: PROVENANCE }, { observerYear: 2026 });
    assert.equal(card.name, 'named', `${kind} dispatches to its own card`);
  }
});
