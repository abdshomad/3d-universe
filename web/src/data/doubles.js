/**
 * Catalogued double stars, attached to the stars they involve.
 *
 * The ingest keeps only pairs whose *both* components resolve to a measured
 * row, and the median separation is **5.1 arcseconds**. At 100 parsecs that is a
 * small fraction of a pixel: an edge drawn between the two components would have
 * no visible length, and a long one drawn at exaggerated scale would be a
 * diagram pretending to be a measurement — the same call made for exoplanet
 * orbits, and for the same reason.
 *
 * So a double is a fact about its stars rather than a line between them. The
 * card names the companion, the separation, and the catalogue it comes from.
 */

const TILE_PREFIX = 'gaia:';

/** The tile row a component refers to, or null if it is a Hipparcos star. */
export function tileIndexOf(componentId) {
  if (typeof componentId !== 'string' || !componentId.startsWith(TILE_PREFIX)) return null;
  const parts = componentId.split(':');
  const index = Number(parts[parts.length - 1]);
  return Number.isInteger(index) ? index : null;
}

/**
 * Doubles grouped by the tile rows they touch.
 * @param {{pairs: object[]}} payload
 */
export function attachDoubles(payload) {
  const byStar = new Map();
  let unresolved = 0;

  for (const pair of payload?.pairs ?? []) {
    const primary = tileIndexOf(pair.primary_hip);
    const secondary = tileIndexOf(pair.secondary_hip);
    if (primary === null && secondary === null) {
      unresolved += 1; // both components outside the tile: nothing to attach to
      continue;
    }
    for (const [index, other, otherId] of [
      [primary, secondary, pair.secondary_hip],
      [secondary, primary, pair.primary_hip],
    ]) {
      if (index === null) continue;
      const list = byStar.get(index) ?? [];
      list.push({
        wds: pair.wds,
        companion: otherId,
        companionInTile: other !== null,
        separationArcsec: pair.separation_arcsec,
        discoverer: pair.discoverer,
        observations: pair.observations,
      });
      byStar.set(index, list);
    }
  }

  const separations = (payload?.pairs ?? []).map((pair) => pair.separation_arcsec).sort((a, b) => a - b);
  return {
    byStar,
    pairs: payload?.pairs?.length ?? 0,
    unresolved,
    medianSeparationArcsec: separations.length
      ? separations[Math.floor(separations.length / 2)]
      : null,
    citation: payload?.citation ?? null,
  };
}

/**
 * The card row. Says what the pair is, what the separation is, and where it
 * came from — and does not draw an edge it cannot draw honestly.
 */
export function doublesCardRow(doubles) {
  if (!doubles || doubles.length === 0) return null;
  const nearest = [...doubles].sort((a, b) => a.separationArcsec - b.separationArcsec)[0];
  const more = doubles.length > 1 ? ` +${doubles.length - 1} more` : '';
  return [
    'catalogued doubles',
    `${nearest.companion}${more} at ${nearest.separationArcsec}″ — WDS ${nearest.wds}`,
  ];
}
