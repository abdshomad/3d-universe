/**
 * Download the slice: export exactly what is on screen, with its provenance.
 *
 * "What is on screen" is a selection, not a count. The renderer draws
 * every stride-th star of a drawn tile, up to a draw count, and a
 * planet is a fact about a host star that is being drawn. A count
 * cannot say which stars those are, so the selection travels with
 * the slice — the same walk the renderer takes.
 */

import { METRES_PER_PC } from './units.js';
import { identityAt, positionAt } from './picker.js';
import { LIGHT_YEARS_PER_PC } from './light-travel.js';
import { CELESTIAL_KINDS } from './celestial-index.js';
import { planetRows } from '../data/exoplanets.js';

/**
 * The three states a row may claim. DERIVED is the one that is easy to forget:
 * an exoplanet position is an archive distance applied to a measured direction,
 * which is a real number and still not an astrometric solution.
 */
export const ALLOWED_FLAGS = new Set(['MEASURED', 'DERIVED', 'SIMULATED']);

export const COLUMNS = [
  'id', 'flag', 'x_pc', 'y_pc', 'z_pc', 'distance_pc', 'light_travel_yr',
  'magnitude', 'colour_index', 'provenance',
  // Only DERIVED rows fill these; a star leaves them empty rather than lying.
  'host', 'disc_year', 'st_teff', 'discovery_method',
];

/** One CSV field: quote it only when the content demands it. */
export function csvField(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(columns, rows) {
  const lines = [columns.map(csvField).join(',')];
  for (const row of rows) lines.push(columns.map((name) => csvField(row[name])).join(','));
  return `${lines.join('\n')}\n`;
}

/**
 * Measured rows: the stars actually drawn, each named by its catalogue id.
 * @param {{tiles: object[], drawn: Array<{tileId: string, stride: number,
 *          drawCount: number}>, originMetres?: number[], limit?: number}} target
 */
export function measuredRows({ tiles = [], drawn = [], originMetres = [0, 0, 0], limit = Infinity }) {
  const byId = new Map();
  for (const tile of tiles) byId.set(tile.header.tile_id, tile);
  const rows = [];
  for (const choice of drawn) {
    const tile = byId.get(choice.tileId);
    if (!tile) continue; // a tile we cannot name from is not exported from
    for (let slot = 0; slot < choice.drawCount && rows.length < limit; slot += 1) {
      // The same walk the layer takes: every stride-th star, clamped
      // to the last row exactly as the renderer clamps it.
      const index = Math.min(slot * choice.stride, tile.count - 1);
      const identity = identityAt({ tile, index, originMetres });
      if (!identity) continue; // a row we cannot name is not exported as though we could
      const position = positionAt(tile, index, originMetres).map((m) => m / METRES_PER_PC);
      rows.push({
        id: identity.id,
        flag: 'MEASURED',
        x_pc: round(position[0]),
        y_pc: round(position[1]),
        z_pc: round(position[2]),
        distance_pc: round(identity.distancePc, 4),
        light_travel_yr: round(identity.distancePc * LIGHT_YEARS_PER_PC, 3),
        magnitude: identity.magnitude,
        colour_index: identity.colorIndex ?? '',
        provenance: identity.provenance,
      });
    }
  }
  return rows;
}

/**
 * The indices a selection draws from one tile — the set of stars a
 * planet can honestly be a fact about. A tile that is not drawn
 * contributes nothing: an empty sky is not the whole archive.
 */
export function drawnIndices({ tile, drawn = [] }) {
  const choice = (drawn ?? []).find((c) => c.tileId === tile?.header?.tile_id);
  if (!choice) return new Set();
  const indices = new Set();
  for (let slot = 0; slot < choice.drawCount; slot += 1) {
    indices.add(Math.min(slot * choice.stride, tile.count - 1));
  }
  return indices;
}

/**
 * Modelled rows: the cells actually drawn, flagged. The flag is asserted here
 * rather than trusted, because a modelled row exported as measured is the one
 * error this file exists to prevent.
 */
export function modelledRows({ field, level, threshold = 0, limit = Infinity }) {
  if (!field || field.flag !== 'SIMULATED') return [];
  const rows = [];
  const side = field.grid;
  const half = (side - 1) / 2;
  for (let index = 0; index < field.cells.length && rows.length < limit; index += 1) {
    // The same cut the renderer applies: a cell below the threshold is not
    // drawn, so exporting it would claim to be showing something it is not.
    const quantised = field.cells[index];
    if (quantised < threshold) continue;
    const z = Math.floor(index / (side * side));
    const y = Math.floor(index / side) % side;
    const x = index % side;
    if (!Number.isInteger(level) || level < 1 || x % level || y % level || z % level) continue;
    const position = [(x - half) * field.cellMpc, (y - half) * field.cellMpc, (z - half) * field.cellMpc];
    const distanceMpc = Math.hypot(...position);
    if (distanceMpc > field.radiusMpc) continue; // a ball, not the cube it is stored in
    rows.push({
      id: `lss:${index}`,
      flag: 'SIMULATED',
      x_pc: round(position[0] * 1e6),
      y_pc: round(position[1] * 1e6),
      z_pc: round(position[2] * 1e6),
      distance_pc: round(distanceMpc * 1e6, 4),
      light_travel_yr: round(distanceMpc * 1e6 * LIGHT_YEARS_PER_PC, 0),
      magnitude: '',
      colour_index: '',
      provenance: `${field.scienceReference} — modelled field, seed ${field.seed}, not a survey map`,
    });
  }
  return rows;
}

/**
 * The picked body's row. A pick is a claim, and the
 * export is the last chance for it to be an honest
 * one: the row carries the tile's flag, never a
 * default, and says where the body was drawn.
 * @param {object|null} picked a celestial search entry
 */
export function pickedRow(picked) {
  // Only a celestial body is a pick the drawn
  // set does not already name: a star on screen
  // is in the measured rows, and a modelled cell
  // is in the modelled ones.
  if (!picked || !CELESTIAL_KINDS[picked.kind]) return null;
  const dec = (picked.dec_deg ?? 0) * Math.PI / 180;
  const ra = (picked.ra_deg ?? 0) * Math.PI / 180;
  const distance = Number(picked.distance_pc) || 0;
  const cosDec = Math.cos(dec);
  return {
    id: picked.id,
    flag: picked.flag ?? null,
    x_pc: round(cosDec * Math.cos(ra) * distance),
    y_pc: round(cosDec * Math.sin(ra) * distance),
    z_pc: round(Math.sin(dec) * distance),
    distance_pc: round(distance, 4),
    light_travel_yr: round(distance * LIGHT_YEARS_PER_PC, 3),
    magnitude: picked.visual_magnitude ?? null,
    colour_index: '',
    provenance: picked.provenance ?? null,
  };
}

/**
 * Build the whole slice: what is drawn, measured rows first. The planets
 * ride along, but only the ones whose host the renderer is drawing, and
 * the picked body rides along with the flag its tile carries.
 */
export function buildSlice({ tiles = [], drawn = [], starIndex = null, exoplanetReport = null, originMetres = [0, 0, 0], field = null, level = 1, threshold = 0, limit = Infinity, picked = null }) {
  const measured = measuredRows({ tiles, drawn, originMetres, limit });
  const modelled = field ? modelledRows({ field, level, threshold, limit }) : [];
  // A planet is a fact about its host star: a host the renderer is not
  // drawing is a system the file would claim to show and does not.
  const hosts = drawnIndices({ tile: starIndex?.tile, drawn });
  const planets = exoplanetReport ? planetRows(exoplanetReport, hosts) : [];
  // A picked body is on screen — the reticle is on it —
  // so the file says so, with the flag its tile carries.
  const body = pickedRow(picked);
  return {
    columns: COLUMNS,
    rows: [...measured, ...modelled, ...planets, ...(body ? [body] : [])],
  };
}

/**
 * The gate the download path runs before writing a file: every row must say
 * what it is. A row that cannot is refused rather than exported as measured.
 */
export function assertFlagged(rows) {
  for (const row of rows) {
    if (!ALLOWED_FLAGS.has(row.flag)) {
      throw new Error(`a row can carry no flag the export may claim: ${JSON.stringify(row.flag)}`);
    }
  }
  return rows.length;
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(digits));
}
