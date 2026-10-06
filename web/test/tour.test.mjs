/**
 * The feature tour: a walked line, forward and back, that ends.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { Tour } from '../src/core/tour.js';

const STEPS = [
  { id: 'a', target: '#a', title: 'A', text: 'first' },
  { id: 'b', target: '#b', title: 'B', text: 'second' },
  { id: 'c', target: '#c', title: 'C', text: 'third' },
];

test('the walk starts at the first stop', () => {
  const tour = new Tour(STEPS).start();
  const stop = tour.current();
  assert.equal(stop.id, 'a');
  assert.equal(stop.index, 0);
  assert.equal(stop.total, 3);
  assert.equal(tour.finished, false);
});

test('next walks to the end, and the end closes the walk', () => {
  const tour = new Tour(STEPS).start();
  assert.equal(tour.next(), true);
  assert.equal(tour.current().id, 'b');
  assert.equal(tour.next(), true);
  assert.equal(tour.next(), false, 'the last stop has nothing after it');
  assert.equal(tour.finished, true);
  assert.equal(tour.current(), null);
});

test('back refuses the first stop', () => {
  const tour = new Tour(STEPS).start();
  assert.equal(tour.back(), false);
  assert.equal(tour.current().index, 0);
});

test('back walks back one stop', () => {
  const tour = new Tour(STEPS).start();
  tour.next();
  tour.next();
  assert.equal(tour.back(), true);
  assert.equal(tour.current().id, 'b');
});

test('skip ends the walk early, and says so', () => {
  const tour = new Tour(STEPS).start();
  tour.next();
  tour.skip();
  assert.equal(tour.finished, true);
  assert.equal(tour.skipped, true);
  assert.equal(tour.current(), null);
});

test('start begins again, wherever the walk left off', () => {
  const tour = new Tour(STEPS).start();
  tour.next();
  tour.next();
  tour.next();
  tour.start();
  assert.equal(tour.current().id, 'a');
  assert.equal(tour.skipped, false);
});

test('an empty script is trivially finished', () => {
  const tour = new Tour([]).start();
  assert.equal(tour.finished, true);
  assert.equal(tour.current(), null);
});

test('a malformed script is refused', () => {
  assert.throws(() => new Tour('not-a-list'), /must be a list/);
  assert.throws(() => new Tour([{ id: 'x', target: '#x', title: 'X' }]), /needs a text/);
  assert.throws(() => new Tour([{ target: '#x', title: 'X', text: 'x' }]), /needs a id/);
});
