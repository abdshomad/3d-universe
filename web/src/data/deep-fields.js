/**
 * Deep fields: real telescope imagery, placed by the sky.
 *
 * Every entry is expressed in ICRS degrees — right ascension and declination —
 * so one convention places the backdrop planes *and* aims the camera at them.
 * Two conventions for "an angle in the sky" is how a field ends up 60 degrees
 * from where the route is looking.
 *
 * `placement` records where the coordinates came from:
 *   'icrs'     — looked up and citable. Webb's first deep field, SIMBAD,
 *                ICRS J2000, queried 2026-10-04.
 *   'authored' — composed for the film. Still expressed in ICRS degrees, but the
 *                position is art direction, not a measurement, and says so.
 */

export const DEEP_FIELDS = [
  {
    id: 'jwst-first-deep-field',
    file: 'weic2205a.jpg',
    placement: 'icrs',
    raDeg: 110.8054,
    decDeg: -73.4569,
    extentDeg: 0.036,
    credit: 'NASA, ESA, CSA, STScI — Webb\'s First Deep Field (SMACS J0723.3-7327)',
    coordinateSource: 'SIMBAD, ICRS J2000, queried 2026-10-04',
    sourceUrl: 'https://esawebb.org/images/weic2205a/',
  },
  {
    id: 'hubble-extreme-deep-field',
    file: 'hubble-xdf.jpg',
    placement: 'authored',
    raDeg: 145,
    decDeg: 0,
    extentDeg: 0.05,
    credit: 'NASA, ESA — Hubble eXtreme Deep Field',
    coordinateSource: 'sky position is composition, not measurement',
    sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001651',
  },
  {
    id: 'hubble-galaxy-legion',
    file: 'hubble-legion.jpg',
    placement: 'authored',
    raDeg: 310,
    decDeg: 0,
    extentDeg: 0.06,
    credit: 'NASA, ESA — Hubble sees a legion of galaxies',
    coordinateSource: 'sky position is composition, not measurement',
    sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000394',
  },
];

/** How deep each field is stacked: four planes, far to near. */
export const FIELD_DEPTHS = [0.88, 0.72, 0.58, 0.46];

export function fieldById(id) {
  const field = DEEP_FIELDS.find((candidate) => candidate.id === id);
  if (!field) throw new RangeError(`no deep field ${id}`);
  return field;
}