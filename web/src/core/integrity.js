/**
 * Runtime integrity: does every light on screen still resolve to a row?
 *
 * The offline verifier in `ingest/verify.py` proves the baked bytes are what
 * the manifest says. This proves the *other* half: that the points actually
 * being drawn, at the scale you are looking at, each name a catalogue entry
 * with a finite distance and a provenance string. A tile can be intact and a
 * renderer still fail to resolve one of its rows.
 *
 * The sample walks the selection the renderer drew — every stride-th star of
 * a drawn tile — because a count cannot say which stars are on screen.
 */

import { identityAt } from './picker.js';

/**
 * Sample the drawn points and resolve each one.
 * @param {{tiles: object[], drawn: Array<{tileId: string, stride: number,
 *          drawCount: number}>, originMetres?: number[], sample?: number}} target
 */
export function sampleIntegrity({ tiles = [], drawn = [], originMetres = [0, 0, 0], sample = 256 }) {
  const byId = new Map();
  for (const tile of tiles) byId.set(tile.header.tile_id, tile);
  const failures = [];
  let checked = 0;
  let resolved = 0;

  for (const choice of drawn) {
    const tile = byId.get(choice.tileId);
    if (!tile) {
      failures.push(`tile ${choice.tileId} is drawn but not loaded`);
      continue;
    }
    const cited = tile.header.provenance ?? {};
    // A card that says "measured" while naming no catalog is the failure this
    // check exists for: the word is there and the evidence is not.
    if (!cited.catalog || !cited.release) {
      failures.push(`tile ${tile.header.tile_id} cites no catalog and release`);
      continue;
    }
    const count = Math.min(choice.drawCount, tile.count);
    if (count === 0) continue;
    // A stride walk covers the drawn set without clustering on the tile's
    // first rows, which are the brightest and least interesting to check.
    const steps = Math.min(sample, count);
    const walk = count / steps;
    for (let n = 0; n < steps; n += 1) {
      const slot = Math.min(count - 1, Math.floor(n * walk));
      const index = Math.min(slot * choice.stride, tile.count - 1);
      const identity = identityAt({ tile, index, originMetres });
      if (!identity) {
        failures.push(`row ${index} does not resolve to an identity`);
        continue;
      }
      if (!Number.isFinite(identity.distancePc) || identity.distancePc <= 0) {
        failures.push(`row ${index} has distance ${identity.distancePc}`);
        continue;
      }
      if (!identity.provenance.includes(cited.catalog) || !identity.provenance.includes(cited.release)) {
        failures.push(`row ${index} carries provenance ${JSON.stringify(identity.provenance)}, `
          + `which does not cite ${cited.catalog} ${cited.release}`);
        continue;
      }
      resolved += 1;
    }
    checked += steps;
  }

  return { checked, resolved, failures, ok: failures.length === 0 };
}
