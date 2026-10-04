/**
 * The export is the last chance for a claim to be honest.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { assertFlagged, buildSlice, COLUMNS, csvField, measuredRows, modelledRows, toCsv } from '../src/core/export.js';

function starIndex(count = 8) {
  const positions = new Uint16Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) positions[i] = 20000 + i;
  return {
    tile: {
      header: {
        tile_id: 't', unit: 'pc', origin: [0, 0, 0], extent: [100, 100, 100],
        provenance: { catalog: 'esa.gaia', release: 'DR3' },
      },
      ids: Array.from({ length: count }, (_, i) => 500 + i),
      positions,
      magnitudes: new Uint16Array(count).fill(8500),
      count,
    },
  };
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
  const csv = toCsv(COLUMNS, [{ id: '1', flag: 'MEASURED' }, { id: '2', flag: 'MEASURED' }]);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], COLUMNS.join(','));
  assert.ok(lines[0].includes('flag'), 'the flag is a column, not a comment');
});

test('only drawn stars are exported', () => {
  const rows = measuredRows({ starIndex: starIndex(8), drawnPoints: 3 });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.id), ['500', '501', '502']);
});

test('every measured row carries the flag and the catalogue it came from', () => {
  const rows = measuredRows({ starIndex: starIndex(4), drawnPoints: 4 });
  for (const row of rows) {
    assert.equal(row.flag, 'MEASURED');
    assert.ok(row.provenance.includes('esa.gaia DR3'), row.provenance);
    assert.ok(row.provenance.includes('measured'));
  }
});

test('a star that cannot be named is left out, not exported blank', () => {
  const broken = starIndex(4);
  broken.tile.ids[2] = null;
  const rows = measuredRows({ starIndex: broken, drawnPoints: 4 });
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
  const slice = buildSlice({ starIndex: starIndex(4), drawnPoints: 4, field: field(4), level: 1, limit: 3 });
  const flags = new Set(slice.rows.map((r) => r.flag));
  assert.ok(flags.has('MEASURED'));
  assert.ok(flags.has('SIMULATED'));
  assert.equal(slice.columns, COLUMNS);
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
  // The renderer draws from a threshold up; exporting more would claim to show
  // cells the atlas is not actually showing.
  const all = modelledRows({ field: gradedField(), level: 1, threshold: 0 }).length;
  const drawn = modelledRows({ field: gradedField(), level: 1, threshold: 120 }).length;
  assert.equal(all - drawn, 3, 'the three faint cells are the difference');
  assert.ok(drawn > 0, 'but the bright cells must survive');
});

test('the threshold reaches the slice', () => {
  const slice = buildSlice({ starIndex: starIndex(2), drawnPoints: 2, field: gradedField(), level: 1, threshold: 120 });
  const open = buildSlice({ starIndex: starIndex(2), drawnPoints: 2, field: gradedField(), level: 1, threshold: 0 });
  assert.equal(slice.rows.length + 3, open.rows.length);
});

test('the header carries the columns only planet rows fill', () => {
  // A row that produces host/disc_year must have somewhere for them to go, or
  // the export silently drops them.
  assert.ok(COLUMNS.includes('host'));
  assert.ok(COLUMNS.includes('disc_year'));
  const measured = measuredRows({ starIndex: starIndex(2), drawnPoints: 2 });
  assert.equal(measured[0].host, undefined, 'a star has no host and must not invent one');
});
