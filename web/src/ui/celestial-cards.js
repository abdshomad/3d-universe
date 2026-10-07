/**
 * Fact cards for the celestial-body kinds: planets, satellites,
 * comets, galaxies and black holes.
 *
 * Each card leads with what its catalogue actually measured. A planet
 * card is an ephemeris row — valid at an epoch, from a named
 * ephemeris. A galaxy card states that its distance is a redshift.
 * A black-hole card says which distance and which mass, with their
 * limit flags, because a limit is not a value.
 */

import {
  DASH,
  card,
  formatDistance,
  formatNumber,
  lightRow,
} from './fact-card.js';

/** A limit flag, read the way the catalogue writes it. */
const LIMIT_MARK = { '<': '≤', '>': '≥', '~': '≈' };

function withLimit(value, unit, limit) {
  if (value == null) return null;
  const mark = LIMIT_MARK[limit] ?? '';
  return `${mark} ${formatNumber(value, 1)} ${unit}`;
}

/**
 * A planet or satellite: what the ephemeris measured, and when. The
 * two kinds share one card because one ephemeris measured both; the
 * name falls back to the kind, so a row without a name is never
 * mistaken for the other kind.
 */
function bodyCard(selection, kind, { observerYear } = {}) {
  if (!selection) return null;
  const light = lightRow(selection.distancePc, observerYear);
  return card(selection.name || `${kind} ${selection.id}`, [
    ['radius', selection.radius_km != null ? `${formatNumber(selection.radius_km, 1)} km` : null],
    ['mass', selection.mass_kg != null ? `${selection.mass_kg.toExponential(2)} kg` : null],
    ['apparent mag', formatNumber(selection.apmag, 2)],
    ['V(1,0)', formatNumber(selection.v_zero, 2)],
    ['geometric albedo', formatNumber(selection.albedo, 3)],
    ['distance', selection.delta_au != null ? `${formatNumber(selection.delta_au, 3)} AU` : null],
    ['epoch', selection.epoch ?? null],
    ['ephemeris', selection.ephemeris_source ?? null],
    ...(light ? [light] : []),
  ], selection.provenance ?? 'nasa.jpl.horizons · measured');
}

export function cardForPlanet(selection, options) {
  return bodyCard(selection, 'planet', options);
}

export function cardForSatellite(selection, options) {
  return bodyCard(selection, 'satellite', options);
}

/** A comet: an orbit, an epoch, and a brightness — nothing else. */
export function cardForComet(selection, { observerYear } = {}) {
  if (!selection) return null;
  const light = lightRow(selection.distancePc, observerYear);
  return card(selection.name || `comet ${selection.id}`, [
    ['designation', selection.designation ?? null],
    ['absolute magnitude H', formatNumber(selection.H, 2)],
    ['diameter', selection.diameter_km != null ? `${formatNumber(selection.diameter_km, 1)} km` : null],
    ['distance', selection.distance_au != null ? `${formatNumber(selection.distance_au, 3)} AU` : null],
    ['orbit', selection.a_au != null
      ? `a ${formatNumber(selection.a_au, 2)} AU, e ${formatNumber(selection.e, 4)}` : null],
    ['epoch', selection.epoch ?? null],
    ...(light ? [light] : []),
  ], selection.provenance ?? 'nasa.jpl.sbdb live · U3DTILE2 · measured');
}

/**
 * A galaxy. The distance row says how it was measured, because a
 * redshift distance is a derived one: the Hubble law with a stated
 * H0, not a parallax.
 */
export function cardForGalaxy(selection, { observerYear } = {}) {
  if (!selection) return null;
  const light = lightRow(selection.distancePc, observerYear);
  return card(selection.name || `galaxy ${selection.id}`, [
    ['distance', selection.distance_mpc != null ? `${formatNumber(selection.distance_mpc, 2)} Mpc` : null],
    ['distance by', selection.distance_method ?? null],
    ['redshift cz', selection.cz_km_s != null ? `${formatNumber(selection.cz_km_s, 0)} km/s` : null],
    ['type', selection.type ?? null],
    ['D25 diameter', selection.d25_arcmin != null ? `${formatNumber(selection.d25_arcmin, 2)}′` : null],
    ['BT mag', formatNumber(selection.bt_mag, 2)],
    ...(light ? [light] : []),
  ], selection.provenance ?? 'cds.vizie.rc3 · measured');
}

/**
 * A black hole: a distance and a mass, each with its own limit flag
 * and its own source, because the two are measured by different
 * methods and neither stands in for the other.
 */
export function cardForBlackHole(selection, { observerYear } = {}) {
  if (!selection) return null;
  const light = lightRow(selection.distancePc, observerYear);
  const uncertainty = selection.mass_upper_sun != null || selection.mass_lower_sun != null
    ? `+${selection.mass_upper_sun ?? DASH} / −${selection.mass_lower_sun ?? DASH} M☉` : null;
  return card(selection.name || `black hole ${selection.id}`, [
    ['distance', withLimit(selection.distance_kpc, 'kpc', selection.distance_limit)],
    ['distance from', selection.distance_source ?? null],
    ['mass', withLimit(selection.mass_sun, 'M☉', selection.mass_limit)],
    ['mass uncertainty', uncertainty],
    ['mass from', selection.mass_source ?? null],
    ...(light ? [light] : []),
  ], selection.provenance ?? 'cds.vizie.a61 2016 · measured');
}
