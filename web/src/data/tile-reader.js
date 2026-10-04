/**
 * Reader for the U3DTILE2 format written by `ingest/tiles.py`.
 *
 * Ids stay in a BigUint64Array: Gaia source ids reach 5.8e18, well past the
 * 2^53 where a JavaScript number silently rounds. A rounded id is a fact card
 * that cites the wrong star.
 *
 * The payload is copied to offset zero before any typed array is taken: the
 * 12-byte header prefix means the payload rarely starts on the 8-byte boundary
 * BigUint64Array demands, and the browser refuses the view outright.
 */

const MAGIC = 'U3DTILE2';
const HEADER_PREFIX_BYTES = 12;
const ID_BYTES = 8;
const POSITION_BYTES = 6;
const MAGNITUDE_BYTES = 2;
const COLOUR_BYTES = 3;
export const STRIDE_BYTES = ID_BYTES + POSITION_BYTES + MAGNITUDE_BYTES + COLOUR_BYTES;

export function readTile(arrayBuffer) {
  const magic = new TextDecoder().decode(new Uint8Array(arrayBuffer, 0, MAGIC.length));
  if (magic !== MAGIC) throw new Error(`not a tile: magic ${JSON.stringify(magic)}`);

  const headerLength = new DataView(arrayBuffer).getUint32(8, true);
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(arrayBuffer, HEADER_PREFIX_BYTES, headerLength)),
  );

  const count = header.count;
  const start = HEADER_PREFIX_BYTES + headerLength;
  const payload = arrayBuffer.slice(start, start + count * STRIDE_BYTES);
  if (payload.byteLength < count * STRIDE_BYTES) {
    throw new Error(`tile ${header.tile_id} is truncated`);
  }

  let offset = 0;
  const ids = new BigUint64Array(payload, offset, count);
  offset += count * ID_BYTES;
  const positions = new Uint16Array(payload, offset, count * 3);
  offset += count * POSITION_BYTES;
  const magnitudes = new Int16Array(payload, offset, count);
  offset += count * MAGNITUDE_BYTES;
  const colours = new Uint8Array(payload, offset, count * COLOUR_BYTES);

  return { header, ids, positions, magnitudes, colours, count };
}

/** Decode one position into metres, relative to `originMetres`. */
export function positionAt(tile, index, originMetres = [0, 0, 0]) {
  const { header, positions } = tile;
  const scale = unitScale(header.unit);
  return [0, 1, 2].map((axis) => {
    const q = positions[3 * index + axis];
    return header.origin[axis] * scale
      + (q / 65535) * header.extent[axis] * scale
      - originMetres[axis];
  });
}

export function magnitudeAt(tile, index) {
  return tile.magnitudes[index] / 1000;
}

export function colourAt(tile, index) {
  return [0, 1, 2].map((axis) => tile.colours[3 * index + axis] / 255);
}

/** Every position as render-space metres, relative to the camera. */
export function decodeAllPositions(tile, originMetres = [0, 0, 0]) {
  const out = new Float64Array(tile.count * 3);
  const scale = unitScale(tile.header.unit);
  const { header, positions } = tile;
  for (let index = 0; index < tile.count; index += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const q = positions[3 * index + axis];
      out[3 * index + axis] =
        header.origin[axis] * scale
        + (q / 65535) * header.extent[axis] * scale
        - originMetres[axis];
    }
  }
  return out;
}

function unitScale(unit) {
  if (unit === 'pc') return 3.0856775814913673e16;
  if (unit === 'au') return 1.495978707e11;
  if (unit === 'm') return 1;
  throw new RangeError(`unknown tile unit ${unit}`);
}