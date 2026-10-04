/**
 * Onboarding hints: one line, when it is relevant, gone once it is not.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { Onboarding } from '../src/core/onboarding.js';

function clock() {
  let time = 0;
  const steps = [
    { id: 'welcome', text: 'you are at the Sun', showAfter: 0, showFor: 10 },
    { id: 'flight', text: 'hold W to fly out · SHIFT faster', showAfter: 4, showFor: 30, hideOn: 'flew' },
    { id: 'search', text: 'type a name to fly somewhere', showAfter: 12, showFor: 30, hideOn: 'searched' },
  ];
  const guide = new Onboarding(steps, { now: () => time });
  return {
    guide,
    advance(seconds) {
      time += seconds;
      return time;
    },
  };
}

test('a hint appears only after its moment', () => {
  const { guide, advance } = clock();
  guide.start();
  assert.equal(guide.current().text, 'you are at the Sun');
  advance(20);
  assert.equal(
    guide.current().id,
    'search',
    'the welcome hint retired and the next relevant one took the slot',
  );
});

test('only one hint is ever shown', () => {
  const { guide, advance } = clock();
  guide.start();
  const seen = new Set();
  for (let i = 0; i < 60; i += 1) {
    const hint = guide.current();
    if (hint) seen.add(hint.id);
    advance(0.5);
  }
  assert.deepEqual([...seen].sort(), ['flight', 'search', 'welcome']);
});

test('a hint retires the moment its thing is done', () => {
  const { guide, advance } = clock();
  guide.start();
  advance(5);
  assert.equal(guide.current().id, 'flight');
  guide.record('flew');
  const next = guide.current();
  assert.ok(next === null || next.id !== 'flight', 'no more flight hints after flying');
});

test('dismissal is permanent', () => {
  const { guide, advance } = clock();
  guide.start();
  guide.dismiss();
  advance(50);
  assert.equal(guide.current(), null);
  assert.equal(guide.finished, true);
});

test('the run ends when nothing is left to say', () => {
  const { guide, advance } = clock();
  guide.start();
  guide.record('flew').record('searched');
  advance(200);
  assert.equal(guide.current(), null);
  assert.equal(guide.finished, true);
});

test('hints before the start are withheld', () => {
  const guide = new Onboarding([{ id: 'x', text: 'later' }], { now: () => 0 });
  assert.equal(guide.current(), null, 'nothing before start');
  guide.start();
  assert.equal(guide.current().id, 'x');
});

test('a malformed script is refused', () => {
  assert.throws(() => new Onboarding('not-a-list'), /must be a list/);
  assert.equal(new Onboarding().finished, true, 'an empty script is trivially finished');
});
