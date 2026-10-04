/**
 * The viewer can always take the sky back.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { Cinematic } from '../src/core/cinematic.js';

function steps() {
  return [
    { id: 'sun', travel: 2, hold: 1, positionMetres: [0, 0, 0], yaw: 0, pitch: 0 },
    { id: 'neighbourhood', travel: 3, hold: 2, positionMetres: [1e16, 0, 0], yaw: 1, pitch: 0 },
    { id: 'galactic', travel: 4, hold: 1, positionMetres: [1e20, 0, 0], yaw: 2, pitch: 0 },
  ];
}

test('it does nothing until started', () => {
  const cinema = new Cinematic(steps());
  assert.equal(cinema.active, false);
  assert.equal(cinema.update(1), null, 'no pose before it runs');
  assert.equal(cinema.current, null);
});

test('an empty path cannot start', () => {
  const cinema = new Cinematic([]);
  assert.equal(cinema.start(), false);
  assert.equal(cinema.active, false);
});

test('it advances through its steps and holds at each', () => {
  const cinema = new Cinematic(steps());
  cinema.start();
  assert.equal(cinema.update(1).id, 'sun');
  assert.equal(cinema.holding, false, 'still travelling through the first step');
  cinema.update(1.5);
  assert.equal(cinema.holding, true, 'and now holding, so the eye can read it');
  cinema.update(1); // 3.5s: past sun (2+1), into neighbourhood
  assert.equal(cinema.current.id, 'neighbourhood');
});

test('any input takes the sky back at once', () => {
  const cinema = new Cinematic(steps());
  cinema.start();
  assert.equal(cinema.record('flew'), true);
  assert.equal(cinema.active, false);
  assert.equal(cinema.dismissed, true);
  assert.equal(cinema.dismissedBy, 'flew');
  assert.equal(cinema.update(1), null, 'and it does not resume on its own');
});

test('starting is not an interruption', () => {
  const cinema = new Cinematic(steps());
  cinema.start();
  assert.equal(cinema.record('start'), false);
  assert.equal(cinema.active, true);
});

test('a dismissed cinematic does not dismiss again', () => {
  const cinema = new Cinematic(steps());
  cinema.start();
  cinema.record('flew');
  assert.equal(cinema.record('clicked'), false, 'already stopped');
});

test('it finishes rather than looping forever', () => {
  const cinema = new Cinematic(steps());
  cinema.start();
  for (let i = 0; i < 40; i += 1) cinema.update(1); // 40s, path is 13s
  assert.equal(cinema.active, false);
  assert.equal(cinema.finished, true);
  assert.equal(cinema.progress, 1);
});

test('progress runs from zero to one across the whole path', () => {
  const cinema = new Cinematic(steps());
  cinema.start();
  assert.equal(cinema.progress, 0);
  cinema.update(6.5); // half of 13
  assert.ok(Math.abs(cinema.progress - 0.5) < 0.01, `got ${cinema.progress}`);
});

test('a nonsensical delta does not move the clock', () => {
  const cinema = new Cinematic(steps());
  cinema.start();
  cinema.update(-5);
  cinema.update(Number.NaN);
  assert.equal(cinema.progress, 0);
  assert.equal(cinema.active, true);
});

test('rejects a non-list of steps', () => {
  assert.throws(() => new Cinematic('not a list'), /must be a list/);
});

test('dismiss says whether it is what ended the mode', () => {
  // The caller cleans up the HUD on the strength of this return, so a silent
  // undefined leaves the chrome dimmed with nothing running.
  const cinema = new Cinematic(steps());
  cinema.start();
  assert.equal(cinema.dismiss('escape'), true, 'the first dismiss ends it');
  assert.equal(cinema.dismiss('escape'), false, 'the second dismiss did not');
});
