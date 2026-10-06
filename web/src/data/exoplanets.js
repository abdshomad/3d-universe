/**
 * Confirmed exoplanets, matched to the measured stars that host them.
 *
 * A planet has no astrometry, so it cannot be placed as a point and drawn
 * honestly: at 50 pc a 5 AU orbit subtends about a third of an arcsecond, which
 * is a small fraction of a pixel. Drawing a host-to-planet edge at true scale
 * would be a line of no length pretending to be a measurement.
 *
 * So the planet is a *fact about a measured star* instead. The host is a real
 * row in the tile; the planets are the archive's numbers about it, and the card
 * that names the star names them with the citation they came from. Every one
 * carries `DERIVED`, because its position is the archive's distance applied to
 * a measured direction — not an astrometric solution.
 */

const DEFAULT_HOST_TOLERANCE_ARCSEC = 600;

export const PLANET_FLAG = 'DERIVED';

/** Sky position to a unit vector, in the frame the tile stores. */
function toDirection(raDeg, decDeg) {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** Nearest star in `directions` to a sky position, with its separation. */
function nearest(directions, raDeg, decDeg) {
  const target = toDirection(raDeg, decDeg);
  let best = -2;
  let index = -1;
  for (let i = 0; i < directions.length / 3; i += 1) {
    const dot = directions[3 * i] * target[0]
      + directions[3 * i + 1] * target[1]
      + directions[3 * i + 2] * target[2];
    if (dot > best) {
      best = dot;
      index = i;
    }
  }
  if (index < 0) return null;
  const chord = Math.hypot(
    directions[3 * index] - target[0],
    directions[3 * index + 1] - target[1],
    directions[3 * index + 2] - target[2],
  );
  return { index, separationArcsec: angularSeparationFromChord(chord) };
}

function angularSeparationFromChord(chord) {
  return (2 * Math.asin(Math.min(1, chord / 2)) * 180) / Math.PI * 3600;
}

/**
 * Group the payload's planets by host, then attach each host's planets to the
 * measured star that matches it. One star backs at most one host.
 * @param {{flag: string, citation: object, planets: object[]}} payload
 * @param {{directions: Float64Array, count: number, ids?: any[]}} starIndex
 */
export function attachPlanets(payload, starIndex, { toleranceArcsec = DEFAULT_HOST_TOLERANCE_ARCSEC } = {}) {
  const byHost = new Map();
  for (const planet of payload?.planets ?? []) {
    if (!byHost.has(planet.hostname)) byHost.set(planet.hostname, []);
    byHost.get(planet.hostname).push(planet);
  }

  const candidates = [];
  for (const [hostname, planets] of byHost) {
    const first = planets[0];
    const hit = nearest(starIndex.directions, first.ra, first.dec);
    if (!hit || hit.separationArcsec > toleranceArcsec) continue;
    candidates.push({ hostname, planets, ...hit });
  }
  // Closest first, so the best host claim wins when two systems crowd a star.
  candidates.sort((a, b) => a.separationArcsec - b.separationArcsec);

  const byStar = new Map();
  const usedStars = new Set();
  for (const candidate of candidates) {
    if (usedStars.has(candidate.index)) continue;
    usedStars.add(candidate.index);
    byStar.set(candidate.index, {
      hostname: candidate.hostname,
      planets: candidate.planets,
      separationArcsec: candidate.separationArcsec,
      flag: payload.flag ?? PLANET_FLAG,
      citation: payload.citation ?? null,
    });
  }

  return {
    byStar,
    flag: payload.flag ?? PLANET_FLAG,
    citation: payload.citation ?? null,
    systems: byHost.size,
    matched: byStar.size,
    unmatched: byHost.size - byStar.size,
    planetsAttached: [...byStar.values()].reduce((total, entry) => total + entry.planets.length, 0),
  };
}

/** Name the source once, from the payload rather than hard-coded twice. */
function citationOf(report) {
  const table = report.citation?.table;
  if (table) return `NASA Exoplanet Archive ${table}`;
  const dataset = report.citation?.dataset;
  if (dataset) return dataset;
  return 'NASA Exoplanet Archive';
}

/** Rows for the CSV export: what the archive said about a drawn star.
 *  A host the renderer is not drawing contributes nothing — a planet
 *  of an unseen star is a row the file would claim to show and does not. */
export function planetRows(report, hostIndices = null, limit = Infinity) {
  const rows = [];
  for (const [index, entry] of report.byStar.entries()) {
    if (hostIndices && !hostIndices.has(index)) continue;
    for (const planet of entry.planets) {
      if (rows.length >= limit) return rows;
      rows.push({
        id: planet.pl_name,
        flag: PLANET_FLAG,
        x_pc: '',
        y_pc: '',
        z_pc: '',
        distance_pc: planet.distance_pc,
        light_travel_yr: '',
        magnitude: '',
        colour_index: '',
        provenance: `${planet.hostname} · ${citationOf(report)} — position derived from the archive distance, not astrometric`,
        host: planet.hostname,
        disc_year: planet.disc_year ?? '',
        st_teff: planet.st_teff ?? '',
        discovery_method: planet.discovery_method ?? '',
      });
    }
  }
  return rows;
}
