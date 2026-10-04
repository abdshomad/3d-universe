/**
 * Fact cards: what we can honestly say about one object.
 *
 * A card is a claim, so it always carries its source, and it says "-" when a
 * value is unknown rather than showing a zero that reads like a measurement.
 * Each object kind gets the rows that kind actually has: a pulsar has a period
 * and a flux, a star has a magnitude, a landmark has a parallax with its error.
 */

import { emissionYear, formatLookback, formatYear, lookbackYears } from '../core/light-travel.js';

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

/** The row every card carries: when the light we are looking at left. */
function lightRow(distancePc, observerYear) {
  if (lookbackYears(distancePc) === null || !observerYear) return null;
  return [
    'light left',
    `${formatYear(emissionYear(distancePc, observerYear))} · ${formatLookback(lookbackYears(distancePc))}`,
  ];
}

function card(name, rowPairs, provenance, extra = {}) {
  return { name, rows: rows(rowPairs), provenance, image: null, ...extra };
}

/**
 * Planets confirmed around this star. Their positions are derived from the
 * archive's distance rather than astrometric, so the row says which is which.
 */
/** Catalogued doubles: the companion, the separation, and the catalogue. */
function doublesRow(doubles) {
  if (!doubles || doubles.length === 0) return null;
  const nearest = [...doubles].sort((a, b) => a.separationArcsec - b.separationArcsec)[0];
  const more = doubles.length > 1 ? ` +${doubles.length - 1} more` : '';
  return ['catalogued doubles', `${nearest.companion}${more} at ${nearest.separationArcsec}\u2033 \u2014 WDS ${nearest.wds}`];
}

function planetRow(planets) {
  if (!planets || planets.length === 0) return null;
  const names = planets.slice(0, 3).map((planet) => {
    const year = planet.disc_year ? ` ${planet.disc_year}` : '';
    return `${planet.pl_name}${year}`;
  });
  const more = planets.length > names.length ? ` +${planets.length - names.length} more` : '';
  return [
    'confirmed planets',
    `${names.join(', ')}${more} · NASA Exoplanet Archive (position derived, not astrometric)`,
  ];
}

/** A star from a baked catalogue tile. */
export function cardForStar(selection, { observerYear } = {}) {
  if (!selection) return null;
  const light = lightRow(selection.distancePc, observerYear);
  const planets = planetRow(selection.planets);
  const doubles = doublesRow(selection.doubles);
  return card(selection.name ?? `gaia ${selection.id}`, [
    ['catalogue id', selection.id],
    ['distance', formatDistance(selection.distancePc)],
    ['apparent mag', formatNumber(selection.magnitude, 2)],
    ['colour index B-V', formatNumber(selection.colorIndex, 2)],
    ...(doubles ? [doubles] : []),
    ...(planets ? [planets] : []),
    ...(light ? [light] : []),
  ], selection.provenance ?? 'esa.gaia DR3 · U3DTILE2 · measured');
}

/** A landmark whose distance comes from a measured parallax. */
export function cardForLandmark(entry, { observerYear } = {}) {
  if (!entry) return null;
  const light = lightRow(entry.distance_pc, observerYear);
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
    ...(light ? [light] : []),
  ], `${entry.provenance ?? 'hipparcos-parallax'} · Hipparcos via VizieR I/239/hip_main`);
}

/** An event: pulsar, fast radio burst, gravitational wave. */
export function cardForEvent(event, { observerYear } = {}) {
  if (!event) return null;
  const light = lightRow(event.distance_pc, observerYear);
  const pairs = [
    ['catalogue', event.name ?? event.id],
    ['kind', event.kind],
  ];
  if (event.flux_mjy !== undefined) pairs.push(['flux at 400 MHz', `${formatNumber(event.flux_mjy, 1)} mJy`]);
  if (event.period_s !== undefined) pairs.push(['period', `${formatNumber(event.period_s, 6)} s`]);
  if (event.age_yr !== undefined) pairs.push(['age', `${formatNumber(event.age_yr, 0)} yr`]);
  // The layer places events by distance_kpc, so the card quotes the same number
  // in the same units. A dash where the sky is drawn is a card disagreeing with
  // what is on screen.
  if (event.distance_pc !== undefined && event.distance_pc !== null) {
    pairs.push(['distance', formatDistance(event.distance_pc)]);
  } else if (event.distance_kpc !== undefined && event.distance_kpc !== null) {
    pairs.push(['distance', `${formatNumber(event.distance_kpc, 2)} kpc`]);
  } else {
    pairs.push(['distance', DASH]);
  }
  pairs.push(['distance from', event.distance_source ?? 'unknown']);
  if (light) pairs.push(light);
  return card(event.name ?? event.id, pairs, event.provenance ?? event.citation?.dataset ?? 'measured');
}

/**
 * The modelled large-scale tier. This card exists mostly to say what the tier
 * is *not*: a model of structure, never a survey map. Nothing here was measured.
 */
export function cardForField(field, { pointCount } = {}) {
  if (!field) return null;
  const drawn = pointCount ?? field.pointCount ?? 0;
  return card(field.name ?? 'Large-scale structure', [
    ['is', field.is ?? 'a model of structure'],
    ['is not', 'a survey map — no galaxy here is measured'],
    ['radius', `${formatNumber(field.radiusMpc ?? 0, 0)} Mpc`],
    ['cell', `${formatNumber(field.cellMpc ?? 0, 1)} Mpc`],
    ['grid', `${field.grid ?? 0}³`],
    ['cells drawn', formatNumber(drawn, 0)],
    ['seed', String(field.seed ?? '—')],
    ...cellRows(field.cell),
  ], field.provenance ?? `generated · ${field.flag ?? 'SIMULATED'}`);
}

/**
 * Rows for a cell the viewer actually clicked. The wording is the point: a
 * quantised value from a seeded field, not an overdensity a survey measured.
 */
function cellRows(cell) {
  if (!cell) return [];
  const grid = `x ${cell.x}, y ${cell.y}, z ${cell.z} of the grid`;
  return [
    ['clicked cell', `${grid} — index ${cell.index}`],
    ['quantised value', `${cell.quantised} (floor ${cell.floor}, ceiling ${cell.ceiling})`],
    ['this is', cell.method ?? 'a value from a seeded random field'],
  ];
}

/**
 * A shared link named something this atlas cannot restore. The view is real and
 * has been flown to; the selection is gone. Saying so is the whole point — an
 * empty card would read as "there is nothing here".
 */
export function cardForUnresolvedLink(selection) {
  if (!selection) return null;
  return card('Selection not restored', [
    ['asked for', selection.requested ?? '—'],
    ['why', 'nothing in this atlas carries that id'],
    ['what did arrive', 'the position, orientation and epoch in the link are intact'],
  ], 'deep link · the view was restored, the selection was not');
}

/** A relation: what joins, what it is, and where it came from. */
export function cardForRelation(relation) {
  if (!relation) return null;
  const ends = relation.endpoints.map((end) => end.id ?? 'unnamed').join(' and ');
  const pairs = [
    ['type', relation.relationType ?? 'relation'],
    ['joins', relation.endsNamed ? ends : `${ends} — at least one end is not a catalogued star`],
  ];
  if (relation.endSeparationArcsec !== null) {
    pairs.push(['match quality', `${relation.endSeparationArcsec}″ — the worst of its two ends`]);
  }
  return card(relation.name ?? 'Relation', pairs,
    relation.citation?.dataset ?? relation.citation ?? 'cited relation');
}

const BUILDERS = {
  star: cardForStar,
  relation: cardForRelation,
  'unresolved-link': cardForUnresolvedLink,
  field: cardForField,
  landmark: cardForLandmark,
  pulsar: cardForEvent,
  frb: cardForEvent,
  gravitational_wave: cardForEvent,
};

/**
 * Build the card for whichever kind of thing was selected.
 * @param {{kind: string} & Record<string, unknown>} object
 */
export function cardFor(object, options = {}) {
  if (!object) return null;
  const builder = BUILDERS[object.kind];
  if (!builder) throw new UnknownObjectKindError(`no card for kind ${object.kind}`);
  return builder(object, options);
}
