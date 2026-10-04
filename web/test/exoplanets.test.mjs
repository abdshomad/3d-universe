/**
 * A planet has no astrometry. These tests exist so it never gets one.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { PLANET_FLAG, attachPlanets, planetRows } from '../src/data/exoplanets.js';

/** Star directions from RA/Dec pairs, in the tile's frame. */
function directionsOf(raDecs) {
  const out = new Float64Array(raDecs.length * 3);
  raDecs.forEach(([ra, dec], i) => {
    const r = (ra * Math.PI) / 180;
    const d = (dec * Math.PI) / 180;
    out[3 * i] = Math.cos(d) * Math.cos(r);
    out[3 * i + 1] = Math.cos(d) * Math.sin(r);
    out[3 * i + 2] = Math.sin(d);
  });
  return out;
}

function payload(planets) {
  return {
    flag: 'DERIVED',
    citation: {
      dataset: 'NASA Exoplanet Archive Planetary Systems Composite Parameters',
      table: 'pscomppars',
    },
    planets,
  };
}

function planet(name, host, ra, dec, extra = {}) {
  return {
    pl_name: name, hostname: host, ra, dec, distance_pc: 10,
    disc_year: 2016, st_teff: 5000, stars_in_system: 1,
    planets_in_system: 1, discovery_method: 'Transit', ...extra,
  };
}

test('a host that matches a measured star carries its planets', () => {
  const report = attachPlanets(
    payload([planet('Test b', 'Test', 10, 10, { distance_pc: 12.5, disc_year: 2019 })]),
    { directions: directionsOf([[10, 10]]), count: 1 },
  );
  assert.equal(report.matched, 1);
  const [entry] = [...report.byStar.values()];
  assert.equal(entry.hostname, 'Test');
  assert.equal(entry.planets[0].distance_pc, 12.5);
  assert.equal(entry.flag, PLANET_FLAG);
});

test('a host beyond tolerance is not attached to any star', () => {
  const report = attachPlanets(
    payload([planet('Far b', 'Far', 40, 10)]),
    { directions: directionsOf([[10, 10]]), count: 1 },
  );
  assert.equal(report.matched, 0);
  assert.equal(report.unmatched, 1);
  assert.equal(report.byStar.size, 0);
});

test('planets of one host stay together on one star', () => {
  const report = attachPlanets(
    payload([
      planet('Test b', 'Test', 10, 10),
      planet('Test c', 'Test', 10, 10),
      planet('Test d', 'Test', 10, 10),
    ]),
    { directions: directionsOf([[10, 10]]), count: 1 },
  );
  assert.equal(report.matched, 1, 'three planets is one system, not three hosts');
  assert.equal(report.planetsAttached, 3);
  assert.equal([...report.byStar.values()][0].planets.length, 3);
});

test('two hosts crowding one star: only the closer claim survives', () => {
  const report = attachPlanets(
    payload([
      planet('Near b', 'Near', 10, 10),
      planet('Far b', 'Far', 10, 10.05),
    ]),
    { directions: directionsOf([[10, 10]]), count: 1 },
  );
  assert.equal(report.matched, 1);
  assert.equal([...report.byStar.values()][0].hostname, 'Near');
  assert.equal(report.unmatched, 1, 'and the loser is counted, not dropped quietly');
});

test('exported planet rows are flagged derived and say why', () => {
  const report = attachPlanets(
    payload([planet('Test b', 'Test', 10, 10)]),
    { directions: directionsOf([[10, 10]]), count: 1 },
  );
  const [row] = planetRows(report);
  assert.equal(row.flag, PLANET_FLAG, 'a planet position is not astrometric');
  assert.equal(row.id, 'Test b');
  assert.equal(row.host, 'Test');
  assert.ok(row.provenance.includes('not astrometric'), row.provenance);
  assert.ok(row.provenance.includes('pscomppars'));
});

test('no planets is an empty result, not a failure', () => {
  const report = attachPlanets(payload([]), { directions: directionsOf([[10, 10]]), count: 1 });
  assert.equal(report.matched, 0);
  assert.deepEqual(planetRows(report), []);
});

test('the report carries the citation, so exported rows can cite it', () => {
  const report = attachPlanets(
    payload([planet('Test b', 'Test', 10, 10)]),
    { directions: directionsOf([[10, 10]]), count: 1 },
  );
  assert.equal(report.citation.table, 'pscomppars');
  assert.equal(report.flag, PLANET_FLAG);
  const { provenance } = planetRows(report)[0];
  assert.ok(provenance.includes('pscomppars'), provenance);
  assert.ok(provenance.includes('not astrometric'), provenance);
  assert.equal(provenance.match(/NASA Exoplanet Archive/g).length, 1,
    'the archive is named once, not twice');
});
