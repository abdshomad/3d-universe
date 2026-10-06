/**
 * Search: name or HIP number in, a flight path out.
 *
 * The index is Hipparcos — complete, and only stars with a measured parallax —
 * so a result is always something we can place in three dimensions. Matching is
 * deliberately narrow: a proper name or a catalogue number. Anything looser
 * would start returning stars nobody asked for.
 */

import { CameraPath } from './camera-path.js';
import { celestialDirection } from './celestial.js';

const NAME_RANK = { exact: 0, prefix: 1, contains: 2 };

export class SearchIndex {
  /** @param {object[]} entries as written by ingest's search index */
  constructor(entries = []) {
    this.entries = entries;
    this.byHip = new Map();
    this.bySpkid = new Map();
    for (const entry of entries) {
      if (typeof entry.hip === 'number') this.byHip.set(entry.hip, entry);
      // A small body answers to its spkid the way a star answers to
      // its HIP number: a catalogue number is a name here too.
      if (entry.kind === 'small_body' && typeof entry.id === 'string') {
        const spkid = Number(entry.id.split(':')[1]);
        if (Number.isInteger(spkid)) this.bySpkid.set(spkid, entry);
      }
    }
  }

  get size() {
    return this.entries.length;
  }

  /** Named entries, brightest first — the atlas's roll call. */
  named() {
    return this.entries.filter((entry) => entry.name);
  }

  /**
   * Find an entry by catalogue number.
   * @param {string|number} text e.g. "HIP 32349" or "32349"
   */
  byNumber(text) {
    const match = String(text).trim().match(/^(?:hip\s*)?(\d+)$/i);
    if (!match) return null;
    const number = Number(match[1]);
    return this.byHip.get(number) ?? this.bySpkid.get(number) ?? null;
  }

  /**
   * Search by name or catalogue number.
   * @returns {object[]} best match first
   */
  query(text) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return [];

    const byNumber = this.byNumber(trimmed);
    if (byNumber) return [byNumber];

    const needle = trimmed.toLowerCase();
    const scored = [];
    for (const entry of this.entries) {
      if (!entry.name) continue;
      const name = entry.name.toLowerCase();
      let rank = null;
      if (name === needle) rank = NAME_RANK.exact;
      else if (name.startsWith(needle)) rank = NAME_RANK.prefix;
      else if (name.includes(needle)) rank = NAME_RANK.contains;
      if (rank !== null) scored.push({ entry, rank });
    }
    scored.sort((a, b) => (
      a.rank - b.rank
      || (a.entry.visual_magnitude ?? 99) - (b.entry.visual_magnitude ?? 99)
      || a.entry.distance_pc - b.entry.distance_pc
    ));
    return scored.map((item) => item.entry);
  }

  /** The best match, or null. */
  best(text) {
    return this.query(text)[0] ?? null;
  }
}

/** How far an entry is from the scene origin, in parsecs. */
export function entryRadiusPc(entry) {
  return entry?.distance_pc ?? null;
}

/**
 * A one-leg flight path from the camera to an entry.
 * Works inward as well as outward: the path interpolates radius geometrically in
 * either direction.
 */
export function flightPathTo(entry, { fromPc = 1e-4, secondsPerDecade = 6 } = {}) {
  const distance = entryRadiusPc(entry);
  if (!(distance > 0)) throw new RangeError('cannot fly to an entry without a distance');
  const decades = Math.max(Math.abs(Math.log10(distance / fromPc)), 0.1);
  return new CameraPath([
    {
      name: 'here',
      radiusPc: fromPc,
      segmentSeconds: Math.max(decades * secondsPerDecade, 2),
      holdSeconds: 0,
      lookAtDeg: { ra: entry.ra_deg, dec: entry.dec_deg },
    },
    {
      name: entry.name ?? `HIP ${entry.hip}`,
      radiusPc: distance,
      segmentSeconds: Math.max(decades * secondsPerDecade, 2),
      holdSeconds: 4,
      lookAtDeg: { ra: entry.ra_deg, dec: entry.dec_deg },
    },
  ]);
}

/** Unit direction to an entry's sky position. */
export function entryDirection(entry) {
  return celestialDirection(entry.ra_deg, entry.dec_deg);
}
