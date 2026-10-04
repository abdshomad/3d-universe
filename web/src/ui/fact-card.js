/**
 * Fact cards: what we can honestly say about one object.
 *
 * A card is a claim, so it always carries its source, and it says "-" when a
 * value is unknown rather than showing a zero that reads like a measurement.
 * Each object kind gets the rows that kind actually has: a pulsar has a period
 * and a flux, a star has a magnitude, a landmark has a parallax with its error.
 */

const DASH = '—';

export class UnknownObjectKindError extends Error {}

export function formatDistance(pc) {
  if (pc === null || pc === undefined || !Number.isFinite(pc)) return DASH;
  if (pc < 0.001) return `${Math.round(pc * 206265)} AU`;
  if (pc < 1) return `${(pc * 206265).toFixed(0)} AU`;
  if (pc < 1000) return `${pc.toFixed(3)} pc`;
  if (pc < 1e6) return `${(pc / 1000).toFixed(2)} kpc`;
  return `${(pc / 1e6).toFixed(2)} Mpc`;
}

export function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return Number(value).toFixed(digits);
}

function rows(pairs) {
  return pairs.map(([label, value]) => [label, value ?? DASH]);
}

function card(name, rowPairs, provenance, extra = {}) {
  return { name, rows: rows(rowPairs), provenance, image: null, ...extra };
}

/** A star from a baked catalogue tile. */
export function cardForStar(selection) {
  if (!selection) return null;
  return card(selection.name ?? `gaia ${selection.id}`, [
    ['catalogue id', selection.id],
    ['distance', formatDistance(selection.distancePc)],
    ['apparent mag', formatNumber(selection.magnitude, 2)],
    ['colour index B-V', formatNumber(selection.colorIndex, 2)],
  ], selection.provenance ?? 'esa.gaia DR3 · U3DTILE2 · measured');
}

/** A landmark whose distance comes from a measured parallax. */
export function cardForLandmark(entry) {
  if (!entry) return null;
  const error = entry.parallax_error_mas ? ` ± ${formatNumber(entry.parallax_error_mas, 2)}` : '';
  return card(entry.name ?? `HIP ${entry.hip}`, [
    ['catalogue', `HIP ${entry.hip}`],
    ['distance', formatDistance(entry.distance_pc)],
    ['parallax', `${formatNumber(entry.parallax_mas, 2)}${error} mas`],
    ['apparent mag', formatNumber(entry.visual_magnitude, 2)],
    ['colour index B-V', formatNumber(entry.colour_index, 2)],
    [
      'cross-check',
      typeof entry.cross_check_arcsec === 'number'
        ? `${entry.cross_check_arcsec}″ vs SIMBAD`
        : DASH,
    ],
  ], `${entry.provenance ?? 'hipparcos-parallax'} · Hipparcos via VizieR I/239/hip_main`);
}

/** An event: pulsar, fast radio burst, gravitational wave. */
export function cardForEvent(event) {
  if (!event) return null;
  const pairs = [
    ['catalogue', event.name ?? event.id],
    ['kind', event.kind],
  ];
  if (event.flux_mjy !== undefined) pairs.push(['flux at 400 MHz', `${formatNumber(event.flux_mjy, 1)} mJy`]);
  if (event.period_s !== undefined) pairs.push(['period', `${formatNumber(event.period_s, 6)} s`]);
  if (event.age_yr !== undefined) pairs.push(['age', `${formatNumber(event.age_yr, 0)} yr`]);
  pairs.push(['distance', formatDistance(event.distance_pc)]);
  pairs.push(['distance from', event.distance_source ?? 'unknown']);
  return card(event.name ?? event.id, pairs, event.provenance ?? event.citation?.dataset ?? 'measured');
}

const BUILDERS = {
  star: cardForStar,
  landmark: cardForLandmark,
  pulsar: cardForEvent,
  frb: cardForEvent,
  gravitational_wave: cardForEvent,
};

/**
 * Build the card for whichever kind of thing was selected.
 * @param {{kind: string} & Record<string, unknown>} object
 */
export function cardFor(object) {
  if (!object) return null;
  const builder = BUILDERS[object.kind];
  if (!builder) throw new UnknownObjectKindError(`no card for kind ${object.kind}`);
  return builder(object);
}
