/**
 * The export is the last chance for a claim to be honest.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  assertFlagged, buildSlice, COLUMNS, csvField, drawnIndices,
  measuredRows, modelledRows, pickedRow, toCsv,
} from '../src/core/export.js';
import { METRES_PER_AU, METRES_PER_PC } from '../src/core/units.js';
import { LIGHT_YEARS_PER_PC } from '../src/core/light-travel.js';
import { PLANET_FLAG } from '../src/data/exoplanets.js';

function tile(count = 8, tileId = 't') {
  const positions = new Uint16Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) positions[i] = 20000 + i;
  return {
    header: {
      tile_id: tileId, unit: 'pc', origin: [0, 0, 0], extent: [100, 100, 100],
      provenance: { catalog: 'esa.gaia', release: 'DR3' },
    },
    ids: Array.from({ length: count }, (_, i) => 500 + i),
    positions,
    magnitudes: new Uint16Array(count).fill(8500),
    count,
  };
}

/** The selection the renderer produces for one drawn tile. */
function drawn(drawCount, { tileId = 't', stride = 1 } = {}) {
  return [{ tileId, stride, drawCount }];
}

function field(count = 4, overrides = {}) {
  return {
    grid: count,
    radiusMpc: 500,
    cellMpc: 10,
    flag: 'SIMULATED',
    seed: 20261004,
    scienceReference: 'DESI DR1',
    cells: new Uint8Array(count ** 3).fill(200),
    ...overrides,
  };
}

test('a CSV field is quoted only when its content demands it', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('two\nlines'), '"two\nlines"');
  assert.equal(csvField(null), '');
});

test('the file has a header and one line per row', () => {
  const csv = toCsv(COLUMNS, [{ id: 'a', flag: 'MEASURED' }]);
  const lines = csv.trimEnd().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], COLUMNS.join(','));
  assert.ok(lines[1].startsWith('a,MEASURED'));
});

test('only drawn stars are exported', () => {
  const rows = measuredRows({ tiles: [tile(8)], drawn: drawn(3) });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.id), ['500', '501', '502']);
});

test('the export walks the stride the renderer walks', () => {
  // The LOD draws every stride-th star; the file must name
  // those stars, not the tile's first ones.
  const rows = measuredRows({ tiles: [tile(8)], drawn: drawn(3, { stride: 2 }) });
  assert.deepEqual(rows.map((r) => r.id), ['500', '502', '504']);
});

test('a second tile exports its own stars', () => {
  const near = tile(4, 'near');
  const far = tile(4, 'far');
  far.ids = [900, 901, 902, 903];
  const rows = measuredRows({
    tiles: [near, far],
    drawn: [
      { tileId: 'near', stride: 1, drawCount: 2 },
      { tileId: 'far', stride: 1, drawCount: 2 },
    ],
  });
  assert.deepEqual(rows.map((r) => r.id), ['500', '501', '900', '901']);
});

test('a drawn tile that is not loaded exports nothing', () => {
  const rows = measuredRows({ tiles: [], drawn: drawn(4) });
  assert.equal(rows.length, 0);
});

test('every measured row carries the flag and the catalogue it came from', () => {
  const rows = measuredRows({ tiles: [tile(4)], drawn: drawn(4) });
  for (const row of rows) {
    assert.equal(row.flag, 'MEASURED');
    assert.ok(row.provenance.includes('esa.gaia DR3'), row.provenance);
    assert.ok(row.provenance.includes('measured'));
  }
});

test('a star that cannot be named is left out, not exported blank', () => {
  const broken = tile(4);
  broken.ids[2] = null;
  const rows = measuredRows({ tiles: [broken], drawn: drawn(4) });
  assert.equal(rows.length, 3);
  assert.ok(!rows.some((r) => r.id === ''));
});

test('modelled rows are flagged, and a field that does not declare itself is refused', () => {
  const rows = modelledRows({ field: field(4), level: 1, limit: 5 });
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.flag, 'SIMULATED');
    assert.ok(row.provenance.includes('not a survey map'), row.provenance);
  }
  assert.equal(modelledRows({ field: field(4, { flag: 'MEASURED' }), level: 1 }).length, 0,
    'a field claiming to be measured exports nothing');
});

test('a coarse level exports fewer cells than the fine one', () => {
  const f = field(8);
  const fine = modelledRows({ field: f, level: 1, limit: Infinity }).length;
  const coarse = modelledRows({ field: f, level: 2, limit: Infinity }).length;
  assert.ok(coarse < fine, `coarse ${coarse} should be under fine ${fine}`);
});

test('a cell outside the declared radius is not exported', () => {
  const small = field(4, { radiusMpc: 1, cellMpc: 10 }); // every cell is beyond 1 Mpc
  assert.equal(modelledRows({ field: small, level: 1 }).length, 0);
});

test('the slice carries both kinds of row, each with its own flag', () => {
  const slice = buildSlice({ tiles: [tile(4)], drawn: drawn(4), field: field(4), level: 1, limit: 3 });
  const flags = new Set(slice.rows.map((r) => r.flag));
  assert.ok(flags.has('MEASURED'));
  assert.ok(flags.has('SIMULATED'));
  assert.equal(slice.columns, COLUMNS);
});

test('drawnIndices names the stars the renderer draws', () => {
  const t = tile(16);
  assert.deepEqual([...drawnIndices({ tile: t, drawn: drawn(4, { stride: 4 }) })], [0, 4, 8, 12]);
  assert.deepEqual([...drawnIndices({ tile: t, drawn: [] })], [], 'nothing drawn is nothing on screen');
});

/** A planet report whose hosts sit at star indices 0 and 5. */
function planetReport(byStar) {
  return { byStar, flag: PLANET_FLAG, citation: 'NASA Exoplanet Archive' };
}

test('a planet of an undrawn host stays in the archive', () => {
  const t = tile(8);
  const report = planetReport(new Map([
    [0, { hostname: 'Near', planets: [{ pl_name: 'Near b', distance_pc: 12, hostname: 'Near' }] }],
    [5, { hostname: 'Far', planets: [{ pl_name: 'Far b', distance_pc: 13, hostname: 'Far' }] }],
  ]));
  const slice = buildSlice({
    tiles: [t], drawn: drawn(1), starIndex: { tile: t }, exoplanetReport: report,
  });
  const hosts = slice.rows.map((r) => r.host).filter(Boolean);
  assert.deepEqual(hosts, ['Near'], 'only the drawn host is exported');
});

test('a planet exports when its host is drawn, even at a stride', () => {
  const t = tile(8);
  const report = planetReport(new Map([
    [4, { hostname: 'Fourth', planets: [{ pl_name: 'Fourth b', distance_pc: 12, hostname: 'Fourth' }] }],
  ]));
  const prefix = buildSlice({ tiles: [t], drawn: drawn(2), starIndex: { tile: t }, exoplanetReport: report });
  assert.equal(prefix.rows.filter((r) => r.host === 'Fourth').length, 0,
    'a host the prefix does not reach is not on screen');
  const strided = buildSlice({ tiles: [t], drawn: drawn(3, { stride: 2 }), starIndex: { tile: t }, exoplanetReport: report });
  assert.equal(strided.rows.filter((r) => r.host === 'Fourth').length, 1,
    'stride 2 draws index 4, so its planet is on screen');
});

test('the gate refuses a row that cannot say what it is', () => {
  const good = [{ flag: 'MEASURED' }, { flag: 'SIMULATED' }];
  assert.equal(assertFlagged(good), 2);
  assert.throws(() => assertFlagged([...good, { flag: undefined }]), /carry no flag/);
  assert.throws(() => assertFlagged([{ flag: 'MAYBE' }]), /carry no flag/);
});

/** A field where most cells glow and a few sit below any sensible threshold. */
function gradedField() {
  const f = field(4);
  f.cells.fill(200);
  f.cells[5] = 10;
  f.cells[6] = 4;
  f.cells[7] = 0;
  return f;
}

test('a cell below the draw threshold is not exported', () => {
  const rows = modelledRows({ field: gradedField(), level: 1, threshold: 100 });
  assert.ok(!rows.some((r) => r.id === 'lss:5'), 'a dim cell is not drawn, so it is not exported');
  assert.ok(!rows.some((r) => r.id === 'lss:6'));
  assert.ok(!rows.some((r) => r.id === 'lss:7'));
  assert.ok(rows.some((r) => r.id === 'lss:0'));
});

test('the threshold reaches the slice', () => {
  const slice = buildSlice({
    tiles: [], drawn: [], field: gradedField(), level: 1, threshold: 100, limit: 100,
  });
  assert.ok(slice.rows.every((r) => r.id !== 'lss:5'));
});

test('the header carries the columns only planet rows fill', () => {
  // A row that produces host/disc_year must have somewhere for them to go, or
  // the export silently drops them.
  assert.ok(COLUMNS.includes('host'));
  assert.ok(COLUMNS.includes('disc_year'));
  const measured = measuredRows({ tiles: [tile(2)], drawn: drawn(2) });
  assert.equal(measured[0].host, undefined, 'a star has no host and must not invent one');
});

/** A celestial pick, as the menu and the search both
 * produce it: the same entry, the same flight. */
function celestialPick() {
  return {
    id: 'sbdb:20000001',
    kind: 'small_body',
    name: '1 Ceres (A801 AA)',
    flag: 'MEASURED',
    ra_deg: 76.001904,
    dec_deg: 19.721149,
    distance_pc: 3.4582 * METRES_PER_AU / METRES_PER_PC,
    visual_magnitude: 3.34,
    provenance: 'nasa.jpl.sbdb live · U3DTILE2 · measured',
  };
}

test('a picked celestial body exports with its flag and its light', () => {
  const picked = celestialPick();
  const row = pickedRow(picked);
  assert.equal(row.id, 'sbdb:20000001');
  assert.equal(row.flag, 'MEASURED');
  assert.equal(row.magnitude, 3.34);
  assert.equal(row.provenance, 'nasa.jpl.sbdb live · U3DTILE2 · measured');
  // The row is the position the tile drew: the
  // same ra, dec and distance the flight flew to.
  const dec = (19.721149 * Math.PI) / 180;
  const ra = (76.001904 * Math.PI) / 180;
  const distance = picked.distance_pc;
  assert.ok(Math.abs(row.x_pc - Math.cos(dec) * Math.cos(ra) * distance) < 1e-6);
  assert.ok(Math.abs(row.z_pc - Math.sin(dec) * distance) < 1e-6);
  assert.ok(
    Math.abs(row.light_travel_yr - distance * LIGHT_YEARS_PER_PC) < 1e-3);
  // The pick rides the slice as its last row,
  // flagged like every other row.
  const slice = buildSlice({ picked });
  assert.equal(slice.rows.length, 1);
  assert.equal(slice.rows.at(-1).id, 'sbdb:20000001');
  assertFlagged(slice.rows, 'MEASURED');
});

test('a pick the drawn set already names exports nothing', () => {
  // A star on screen is in the measured rows; a
  // modelled cell is in the modelled ones. Only a
  // celestial body is a pick the file would
  // otherwise miss.
  assert.equal(
    pickedRow({ id: 'star', kind: 'star', ra_deg: 1, dec_deg: 1, distance_pc: 1 }),
    null,
  );
  assert.equal(pickedRow(null), null);
  const slice = buildSlice({ picked: { kind: 'star', id: 's' } });
  assert.equal(slice.rows.length, 0);
});
