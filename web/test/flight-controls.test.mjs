/**
 * Free flight: one control scheme, twenty-five decades.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { FlightController, inputFromKeys } from '../src/core/flight-controls.js';
import { METRES_PER_PC } from '../src/core/units.js';

const AU = 1.496e11;

test('speed is proportional to distance, so the feel is scale-free', () => {
  const flight = new FlightController({ ratePerSecond: 0.35 }).input({ forward: 1 });
  const near = flight.step(1, [AU, 0, 0]);
  const far = flight.step(1, [1000 * AU, 0, 0]);
  const nearGain = near[0] / AU;
  const farGain = far[0] / (1000 * AU);
  assert.ok(Math.abs(nearGain - farGain) < 1e-9, `${nearGain} vs ${farGain}`);
  assert.ok(nearGain > 1.4 && nearGain < 1.5, `gain ${nearGain}`);
});

test('the same key moves the same fraction of the view at 1 AU and 100 kpc', () => {
  const flight = new FlightController().input({ forward: 1 });
  const near = flight.step(0.5, [AU, 0, 0]);
  const far = flight.step(0.5, [100 * 1000 * METRES_PER_PC, 0, 0]);
  const nearFraction = (near[0] - AU) / AU;
  const farFraction = (far[0] - 100 * 1000 * METRES_PER_PC) / (100 * 1000 * METRES_PER_PC);
  assert.ok(Math.abs(nearFraction - farFraction) < 1e-9, `${nearFraction} vs ${farFraction}`);
});

test('boost multiplies the gain', () => {
  const plain = new FlightController({ ratePerSecond: 0.35, boostMultiplier: 8 });
  const boosted = new FlightController({ ratePerSecond: 0.35, boostMultiplier: 8 });
  boosted.input({ forward: 1, boost: true });
  const a = plain.distanceGainPerSecond();
  const b = boosted.distanceGainPerSecond();
  assert.ok(b > a * 7.5, `boost gain ${b} vs ${a}`);
});

test('no input means no movement', () => {
  const flight = new FlightController();
  assert.equal(flight.engaged, false);
  const position = [AU, AU, AU];
  assert.deepEqual(flight.step(1, position), position);
});

test('strafing changes bearing without changing the radius', () => {
  const flight = new FlightController().input({ strafe: 1 });
  const moved = flight.step(1, [AU, 0, 0]);
  assert.ok(Math.abs(Math.hypot(...moved) - AU) / AU < 1e-9, 'radius held');
  const expected = AU * Math.cos(0.35);
  assert.ok(Math.abs(moved[0] - expected) / AU < 1e-9, `rotated to ${moved[0]}, expected ${expected}`);
});

test('the step is exact: two half steps equal one whole step', () => {
  const flight = new FlightController().input({ forward: 1 });
  const start = [AU, 0, 0];
  const halves = flight.step(0.5, flight.step(0.5, start));
  const whole = flight.step(1, start);
  assert.ok(Math.abs(halves[0] - whole[0]) / whole[0] < 1e-12,
    `${halves[0]} vs ${whole[0]}`);
  assert.ok(Math.abs(whole[0] / AU - flight.distanceGainPerSecond()) < 1e-12,
    'the advertised gain is the gain you get');
});

test('the floor keeps you moving at the origin', () => {
  const flight = new FlightController({ ratePerSecond: 0.35, minSpeedMetres: 1 }).input({ forward: 1 });
  const moved = flight.step(1, [0, 0, 0]);
  assert.ok(moved[0] > 0.5, `moved ${moved[0]}`);
});

test('keys map to one scheme, whatever the scale', () => {
  const keys = new Set(['w', 'd', 'shift']);
  const input = inputFromKeys(keys);
  assert.deepEqual(input, { forward: 1, strafe: 1, lift: 0, boost: true });

  const opposite = inputFromKeys(new Set(['s', 'a', 'q']));
  assert.deepEqual(opposite, { forward: -1, strafe: -1, lift: -1, boost: false });
});

test('nonsense configuration is refused', () => {
  assert.throws(() => new FlightController({ ratePerSecond: 0 }), /positive/);
  assert.throws(() => new FlightController({ boostMultiplier: 0.5 }), /at least 1/);
  assert.throws(() => new FlightController().step(-1, [0, 0, 0]), /negative/);
});
