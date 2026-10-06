/**
 * Deep links: what you can share, and what a hostile URL cannot do.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeView, encodeView, isViewFragment, makeView } from '../src/core/deep-link.js';

const PC = 3.0856775814913673e16;

test('a view survives a round trip, to the metre', () => {
  const view = makeView({
    positionMetres: [1.347 * PC, -0.5 * PC, 0.25 * PC],
    yaw: 270.5,
    pitch: -12.25,
    observerYear: 2026,
    selectionId: 'hip:32349',
  });
  const restored = decodeView(encodeView(view));
  assert.ok(restored);
  assert.deepEqual(restored.positionMetres, view.positionMetres,
    'the place is the place that was shared');
  assert.equal(restored.yaw, 270.5);
  assert.equal(restored.pitch, -12.25);
  assert.equal(restored.observerYear, 2026);
  assert.equal(restored.selectionId, 'hip:32349');
});

test('a position four parsec decimals cannot name still lands exactly', () => {
  // The first-run drive shared a view of Sirius whose position
  // needs more digits than four decimals of a parsec carry; the
  // cold page used to land 1.2e12 m — eight AU — away.
  const position = [81371169230000000, 0, 0]; // 2.6371… pc
  const restored = decodeView(encodeView(makeView({ positionMetres: position })));
  assert.deepEqual(restored.positionMetres, position);
});

test('the same view always encodes to the same string', () => {
  const view = makeView({ positionMetres: [PC, 0, 0], yaw: 10, pitch: 0 });
  assert.equal(encodeView(view), encodeView(view));
});

test('a fragment with no leading hash still decodes', () => {
  assert.ok(decodeView('p=1,0,0&y=0&t=0'));
  assert.ok(decodeView('#p=1,0,0&y=0&t=0'));
});

test('junk is ignored, not flown to', () => {
  for (const hash of ['', '#', null, undefined, 'hello', '#hello', '#p=1,2', '#p=a,b,c', '#y=1&t=1']) {
    assert.equal(decodeView(hash), null, `accepted ${hash}`);
  }
});

test('an impossible radius is refused', () => {
  assert.equal(decodeView(`#p=${1e13 * PC},0,0&y=0&t=0`), null, 'a parsec radius of 1e13 is not a place');
});
test('a nonsense epoch is dropped but the view survives', () => {
  const view = decodeView('#p=1,0,0&y=0&t=0&e=99999999');
  assert.equal(view.observerYear, null);
  assert.ok(view.positionMetres);
});

test('a selection with awkward characters survives', () => {
  const view = decodeView('#p=0,0,0&y=0&t=0&s=landmark%3AB0833-45');
  assert.equal(view.selectionId, 'landmark:B0833-45');
});

test('fragments are recognised for sharing', () => {
  assert.equal(isViewFragment('#p=1,0,0&y=0&t=0'), true);
  assert.equal(isViewFragment('#nope'), false);
  assert.equal(isViewFragment(''), false);
});

test('an empty view encodes to something decodable', () => {
  const restored = decodeView(encodeView(makeView()));
  assert.ok(restored, 'the origin is a real place');
  assert.equal(restored.selectionId, null);
});
