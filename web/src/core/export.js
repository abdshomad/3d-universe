/**
 * Download the slice: export exactly what is on screen, with its provenance.
 *
 * The export is the last chance for a claim to be honest. A viewer who can
 * check provenance in the UI and then download the rows must find the same
 * strings in the file. So the `flag` column is not decoration: every modelled
 * row carries `SIMULATED`, and any row whose flag is unknown is refused rather
 * than exported as though it were measured.
 */

import { METRES_PER_PC } from './units.js';
import { identityAt, positionAt } from './picker.js';
import { LIGHT_YEARS_PER_PC } from './light-travel.js';

export const COLUMNS = [
  'id', 'flag', 'x_pc', 'y_pc', 'z_pc', 'distance_pc', 'light_travel_yr',
  'magnitude', 'colour_index', 'provenance',
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

/** Measured rows: the stars actually drawn, each named by its catalogue id. */
export function measuredRows({ starIndex, drawnPoints, originMetres = [0, 0, 0], limit = Infinity }) {
  const tile = starIndex?.tile;
  if (!tile) return [];
  const count = Math.min(drawnPoints, tile.count);
  const rows = [];
  for (let index = 0; index < count && rows.length < limit; index += 1) {
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
  return rows;
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

/** Build the whole slice: what is drawn, measured rows first. */
export function buildSlice({ starIndex, drawnPoints, originMetres = [0, 0, 0], field = null, level = 1, threshold = 0, limit = Infinity }) {
  return {
    columns: COLUMNS,
    rows: [
      ...measuredRows({ starIndex, drawnPoints, originMetres, limit }),
      ...(field ? modelledRows({ field, level, threshold, limit }) : []),
    ],
  };
}

/**
 * The gate the download path runs before writing a file: every row must say
 * what it is. A row that cannot is refused rather than exported as measured.
 */
export function assertFlagged(rows) {
  const unflagged = rows.filter((row) => row.flag !== 'MEASURED' && row.flag !== 'SIMULATED');
  if (unflagged.length > 0) {
    throw new Error(`${unflagged.length} row(s) carry no flag and will not be exported`);
  }
  return rows.length;
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(digits));
}
