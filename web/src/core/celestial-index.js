/**
 * The celestial-body search entries, built from the tiles the
 * renderer draws and the sidecar rows a card reads.
 *
 * A menu pick and a search for the same body are the same ask, so
 * both draw from one index. The entry's sky position is read back
 * from the tile — the position the atlas actually draws — so a
 * flight to a menu entry lands on the body the viewer can see,
 * not on a number a fetch once returned. The sidecar row rides
 * along whole: it is the card's data, and the card is the row.
 *
 * The tile's quantised positions are relative to its own origin,
 * so the direction is taken in the catalogue frame (the tile's
 * origin plus the quantised extent), never in the floating
 * origin the camera is using.
 */

import { identityAt, positionAt } from './picker.js';

const DEGREE = Math.PI / 180;

/** How many bodies one kind's menu list shows. */
export const BODY_LIMIT = 100;

/**
 * The six kinds, in menu order. `prefix` names the catalogue the
 * entry's id comes from, `magnitude` is the row field that
 * orders the list (brightest first, bodies without one last),
 * and `distance` is the row field the list shows.
 */
export const CELESTIAL_KINDS = {
  small_body: {
    prefix: 'sbdb', magnitude: 'H', distance: 'distance_au', unit: 'AU',
  },
  comet: {
    prefix: 'sbdb', magnitude: 'H', distance: 'distance_au', unit: 'AU',
  },
  planet: {
    prefix: 'horizons', magnitude: 'apmag', distance: 'delta_au', unit: 'AU',
  },
  satellite: {
    prefix: 'horizons', magnitude: 'apmag', distance: 'delta_au', unit: 'AU',
  },
  galaxy: {
    prefix: 'rc3', magnitude: 'bt_mag', distance: 'distance_mpc', unit: 'Mpc',
  },
  black_hole: {
    prefix: 'a61', magnitude: null, distance: 'distance_kpc', unit: 'kpc',
  },
};

/** Right ascension and declination from a catalogue position. */
export function directionToRaDec([x, y, z]) {
  const length = Math.hypot(x, y, z);
  if (length === 0) return null;
  const ra = Math.atan2(y, x) / DEGREE;
  const dec = Math.asin(z / length) / DEGREE;
  return {
    ra_deg: Number(((ra + 360) % 360).toFixed(6)),
    dec_deg: Number(dec.toFixed(6)),
  };
}

/**
 * One body as a search entry: the drawn position, the row whole.
 * @param {{tile: object, index: number, row: object,
 *          kind: string, prefix: string}} target
 */
export function celestialEntry({ tile, index, row, kind, prefix, flag = null }) {
  const identity = identityAt({ tile, index });
  if (!identity || !row) return null;
  // No origin subtraction: the flight target is the catalogue
  // frame's position, the one the layer drew.
  const position = positionAt(tile, index, [0, 0, 0]);
  const direction = directionToRaDec(position);
  if (!direction) return null;
  return {
    id: `${prefix}:${identity.id}`,
    name: row.name ?? null,
    kind,
    flag,
    ...direction,
    distance_pc: identity.distancePc,
    // The tile's own provenance, in the
    // words the export uses: a body is as
    // measured as the tile that draws it.
    provenance: identity.provenance,
    // The search order is brightest first, so the
    // entry carries the row's magnitude under the
    // name every kind's entry answers to.
    visual_magnitude: row[CELESTIAL_KINDS[kind].magnitude] ?? null,
    ...row,
  };
}

/**
 * Every entry one kind holds, brightest first — bodies without a
 * magnitude (a black hole's row is a distance and a mass, not a
 * brightness) close the list in catalogue order.
 * @param {{tile: object, rows: Map<string, object>,
 *          kind: string}} target
 */
export function celestialEntries({ tile, rows, kind }) {
  const spec = CELESTIAL_KINDS[kind];
  if (!tile || !spec) return [];
  // The tile's own provenance flag rides on every
  // entry it yields: a body is as measured as the
  // tile that draws it, and the export asserts it.
  const flag = tile.header.provenance.flag ?? null;
  const entries = [];
  for (let index = 0; index < tile.count; index += 1) {
    const row = rows.get(tile.ids[index].toString());
    const entry = celestialEntry({
      tile, index, row, kind, prefix: spec.prefix, flag,
    });
    if (entry) entries.push(entry);
  }
  const magnitude = spec.magnitude;
  entries.sort((a, b) => {
    if (magnitude === null) return 0; // catalogue order already
    const left = a[magnitude] ?? null;
    const right = b[magnitude] ?? null;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left - right;
  });
  return entries;
}
