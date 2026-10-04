/**
 * Tile reading: offsets, endianness and the things that must never round.
 *
 * Gaia source ids reach 5.8e18 — past 2^53, where a JavaScript number silently
 * turns 5853498713190525696 into a different star.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readTile,
  positionAt,
  magnitudeAt,
  colourAt,
  decodeAllPositions,
} from '../src/data/tile-reader.js';

const MAGIC = 'U3DTILE2';
const UNIT_PC = 3.0856775814913673e16;
const STRIDE = 19;
const EXTENT = 10;
const FIRST_ID = '5853498713190525696';
const SECOND_ID = '4472832130942575872';

const closeTo = (actual, expected) => Math.abs(actual - expected) / Math.abs(expected || 1) < 1e-12;
const expectedMetres = (quantised) => (quantised / 65535) * EXTENT * UNIT_PC;

/**
 * Build a U3DTILE2 payload the way `ingest/tiles.py` writes one: header bytes
 * then a payload that deliberately does not start on an 8-byte boundary.
 */
function buildTile({ count, unit = 'pc', origin = [0, 0, 0], extent = [EXTENT, EXTENT, EXTENT], ids, magnitudes, colours }) {
  const header = {
    tile_id: 'test',
    unit,
    count,
    origin,
    extent,
    provenance: { catalog: 'esa.gaia', release: 'DR3' },
    first_source_id: ids[0],
    last_source_id: ids[ids.length - 1],
    skipped: 0,
    mag_range: [],
    extra: {},
  };

  const payload = new ArrayBuffer(count * STRIDE);
  const idView = new BigUint64Array(payload, 0, count);
  ids.forEach((id, index) => { idView[index] = BigInt(id); });

  const positionView = new Uint16Array(payload, count * 8, count * 3);
  for (let index = 0; index < count * 3; index += 1) positionView[index] = index * 1000;

  const magnitudeView = new Int16Array(payload, count * 8 + count * 6, count);
  magnitudes.forEach((value, index) => { magnitudeView[index] = Math.round(value * 1000); });

  new Uint8Array(payload, count * 8 + count * 6 + count * 2, count * 3).set(colours);

  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const buffer = new ArrayBuffer(12 + headerBytes.length + payload.byteLength);
  const bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(buffer).setUint32(8, headerBytes.length, true);
  bytes.set(headerBytes, 12);
  bytes.set(new Uint8Array(payload), 12 + headerBytes.length);
  return buffer;
}

const sample = () => buildTile({
  count: 2,
  ids: [FIRST_ID, SECOND_ID],
  magnitudes: [-1.46, 8.19],
  colours: [255, 128, 64, 32, 64, 255],
});

test('reads the header and the count', () => {
  const tile = readTile(sample());
  assert.equal(tile.header.tile_id, 'test');
  assert.equal(tile.header.unit, 'pc');
  assert.equal(tile.count, 2);
});

test('ids survive as exact 64-bit integers', () => {
  const tile = readTile(sample());
  assert.equal(tile.ids[0], BigInt(FIRST_ID));
  assert.equal(tile.ids[0].toString(), FIRST_ID);
});

test('a plain number would round the id to a different star', () => {
  assert.notEqual(Number(BigInt(FIRST_ID)).toString(), FIRST_ID);
});

test('magnitudes keep their sign', () => {
  const tile = readTile(sample());
  assert.equal(magnitudeAt(tile, 0), -1.46);
  assert.equal(magnitudeAt(tile, 1), 8.19);
});

test('colours decode to unit floats', () => {
  const tile = readTile(sample());
  assert.deepEqual(colourAt(tile, 0), [1, 128 / 255, 64 / 255]);
});

test('quantized positions decode back to metres', () => {
  const tile = readTile(sample());
  const [, y, z] = positionAt(tile, 0);
  assert.ok(closeTo(y, expectedMetres(1000)), `y ${y}`);
  assert.ok(closeTo(z, expectedMetres(2000)), `z ${z}`);
});

test('positions honour a camera-relative origin', () => {
  const tile = readTile(sample());
  const shifted = positionAt(tile, 1, [0, expectedMetres(4000), 0]);
  assert.ok(Math.abs(shifted[1]) < 1, 'the camera offset cancels');
});

test('bulk decoding matches per-point decoding', () => {
  const tile = readTile(sample());
  const all = decodeAllPositions(tile, [0, 0, 0]);
  assert.equal(all.length, 6);
  const [, y] = positionAt(tile, 1);
  assert.ok(closeTo(all[4], y));
});

test('a foreign file is rejected by its magic', () => {
  assert.throws(() => readTile(new ArrayBuffer(32)), /not a tile/);
});

test('a truncated tile is rejected rather than half-read', () => {
  const full = sample();
  assert.throws(() => readTile(full.slice(0, full.byteLength - 10)), /truncated/);
});