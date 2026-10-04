/**
 * Runtime integrity: does every light on screen still resolve to a row?
 *
 * The offline verifier in `ingest/verify.py` proves the baked bytes are what
 * the manifest says. This proves the *other* half: that the points actually
 * being drawn, at the scale you are looking at, each name a catalogue entry
 * with a finite distance and a provenance string. A tile can be intact and a
 * renderer still fail to resolve one of its rows.
 */

import { identityAt } from './picker.js';

/**
 * Sample the drawn points and resolve each one.
 * @param {{starIndex: object, drawnPoints: number, originMetres?: number[],
 *          sample?: number}} target
 */
export function sampleIntegrity({ starIndex, drawnPoints, originMetres = [0, 0, 0], sample = 256 }) {
  const tile = starIndex?.tile;
  if (!tile) return { checked: 0, resolved: 0, failures: ['no tile is loaded'], ok: false };

  // Sample the drawn range, not the tile: a row nobody can see is not on screen.
  const count = Math.min(drawnPoints, tile.count);
  if (count === 0) return { checked: 0, resolved: 0, failures: [], ok: true };

  const failures = [];
  const cited = tile.header.provenance ?? {};
  // A card that says "measured" while naming no catalog is the failure this
  // check exists for: the word is there and the evidence is not.
  if (!cited.catalog || !cited.release) {
    return {
      checked: 0,
      resolved: 0,
      failures: [`tile ${tile.header.tile_id} cites no catalog and release`],
      ok: false,
    };
  }

  const steps = Math.min(sample, count);
  // A stride walk covers the range without clustering on the tile's first rows,
  // which are the brightest and therefore the least interesting to check.
  const stride = count / steps;
  let resolved = 0;

  for (let n = 0; n < steps; n += 1) {
    const index = Math.min(count - 1, Math.floor(n * stride));
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

  return { checked: steps, resolved, failures, ok: failures.length === 0 };
}
