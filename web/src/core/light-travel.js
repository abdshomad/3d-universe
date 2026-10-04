/**
 * Light-travel time: what the atlas is actually showing you.
 *
 * There is no single "now" in a 3D sky. A star at 1 parsec is seen three years
 * late; one at a kiloparsec, three thousand. Every frame of this atlas is a
 * composite of epochs, and a fact card that hides that is lying by omission.
 *
 * What the scrubber does — and what it deliberately does not do — lives in
 * `docs`: it moves the observer's epoch and recomputes when each object's light
 * left and will arrive. It does not re-render the sky, because our catalogues
 * describe one epoch and pretending otherwise would be the easiest lie in the
 * whole project.
 */

/** One parsec is 3.26156 light years; the reciprocal converts distance to lookback. */
export const LIGHT_YEARS_PER_PC = 3.2615637769;

/** Years between now and seeing light that has travelled `distancePc`. */
export function lookbackYears(distancePc) {
  if (distancePc === null || distancePc === undefined || !Number.isFinite(distancePc)) return null;
  return distancePc * LIGHT_YEARS_PER_PC;
}

/**
 * The year light from `distancePc` left its source, for an observer in
 * `observerYear`. A negative result is light arriving in the future.
 */
export function emissionYear(distancePc, observerYear) {
  const lookback = lookbackYears(distancePc);
  if (lookback === null) return null;
  return observerYear - lookback;
}

/** The earliest and latest epochs present in a set of distances. */
export function epochSpan(distancesPc, observerYear) {
  const years = distancesPc.map(lookbackYears).filter((value) => value !== null);
  if (years.length === 0) return { oldestYear: null, newestYear: null, spanYears: 0 };
  const oldest = observerYear - Math.max(...years);
  const newest = observerYear - Math.min(...years);
  return { oldestYear: oldest, newestYear: newest, spanYears: newest - oldest };
}

/** Human phrasing: "8.6 yr ago", "in 120 yr", "3.3 kyr ago". */
export function formatLookback(years) {
  if (years === null || years === undefined || !Number.isFinite(years)) return '—';
  const magnitude = Math.abs(years);
  if (magnitude < 1000) {
    const rounded = magnitude < 10 ? magnitude.toFixed(1) : Math.round(magnitude).toString();
    return `${rounded} yr ${years >= 0 ? 'ago' : 'from now'}`;
  }
  if (magnitude < 1e6) return `${(magnitude / 1000).toFixed(1)} kyr ${years >= 0 ? 'ago' : 'from now'}`;
  return `${(magnitude / 1e6).toFixed(1)} Myr ${years >= 0 ? 'ago' : 'from now'}`;
}

/** A calendar year, or "—" when there is nothing to say. */
export function formatYear(year) {
  if (year === null || year === undefined || !Number.isFinite(year)) return '—';
  return `${Math.round(year)}`;
}
