/**
 * Sky directions, free of any three.js import.
 *
 * Shared by the camera path (which must stay testable in Node) and the deep
 * field renderer, so a route can aim at the same catalogue entry that places a
 * backdrop plane.
 */

const DEGREE = Math.PI / 180;

/** Unit direction to an ICRS right ascension and declination, in degrees. */
export function celestialDirection(raDeg, decDeg) {
  const ra = raDeg * DEGREE;
  const dec = decDeg * DEGREE;
  const cosDec = Math.cos(dec);
  return [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec)];
}

/** Unit direction for a bearing measured on the celestial equator. */
export function bearingDirection(bearingDeg) {
  const angle = bearingDeg * DEGREE;
  return [Math.cos(angle), 0, Math.sin(angle)];
}

/** Right ascension and declination from a catalogue `lookAtDeg: {ra, dec}`. */
export function lookDirection(lookAtDeg) {
  if (!lookAtDeg) return null;
  return celestialDirection(lookAtDeg.ra, lookAtDeg.dec);
}