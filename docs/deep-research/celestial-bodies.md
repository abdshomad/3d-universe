# Celestial Bodies — Catalogue Survey

Date: 2026-10-07 · Status: sub-plan 01 of `plans/celestial-menu.md`.
Every verdict below is a probe this host actually made; each receipt
names the request, the response, and what the source states about its
own data. A verdict without a receipt is a wish. "Reachable" means a
response this host received and logged; "licence" means the licence text
the source itself states.

## The verdicts

| kind | source | rows | verdict |
|---|---|---|---|
| planets | JPL Horizons API | 9 (8 majors + Pluto) | **INGEST** |
| satellites | JPL Horizons API | 21 major moons | **INGEST** |
| comets | JPL SBDB Query API, `sb-kind=c` | 4,077 | **INGEST** |
| galaxies | VizieR TAP, RC3 (`VII/155/rc3`) | 23,011 — 10,618 with a redshift | **INGEST** (the 10,618) |
| black holes | VizieR, Corral-Santana et al. 2016 (`J/A+A/587/A61`) | 57 transients — 33 with distances, 17 with dynamical masses | **INGEST** (the 33) |

The atlas already holds stars (Gaia DR3 via the AIP mirror), landmarks
(Hipparcos), exoplanets, pulsars (ATNF), doubles (WDS), small bodies
(SBDB, E19), deep fields (NASA imagery) and the modelled LSS field.
The menu lists those plus the five kinds above. Small bodies are E19's
scope and are not re-probed here.

## Receipts

### Planets — JPL Horizons API — INGEST

- Request (this host, 2026-10-07):
  `ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='499'&OBJ_DATA='YES'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='@sun'&START_TIME='2026-01-01'&STOP_TIME='2026-01-02'&STEP_SIZE='1 d'`
  (the parameter is `MAKE_EPHEM`, not `MAKE_EPHEMERIS` — the API
  answers `400 one or more query parameter was not recognized`
  otherwise; that receipt is what found the correct name.)
- Response: **200**, ~1.0 s, ~6 KB JSON. The `result` string carries a
  text ephemeris: `body name: Mars (499)`, then a `$$SOE` block with
  heliocentric `X/Y/Z` in km at JD 2461041.5 (= 2026-01-01 TDB).
- Row identity: the body name and code — `Mars (499)` — plus the
  ephemeris source named in the target block (e.g. `{source: DE441}`).
- All nine majors resolve live, verified one by one on 2026-10-07:
  Mercury 199, Venus 299, Earth 399, Mars 499, Jupiter 599, Saturn
  699, Uranus 799, Neptune 899, Pluto 999.
- Magnitude: the OBSERVER ephemeris serves `APmag` ("target's
  approximate apparent visual magnitude") as quantity 20, so the layer
  carries an apparent magnitude at the stated epoch, not an assumed one.
- Licence: the API documentation page (`ssd-api.jpl.nasa.gov/doc/
  horizons.html`, 112 KB, fetched 2026-10-07) states no licence text.
  NASA/JPL service; the card cites the API, the command code and the
  ephemeris version the target block names.
- Verdict: **INGEST**. Nine named bodies, positions at a stated epoch,
  apparent magnitudes at the same epoch. The tile is AU-quantized like
  E19's small bodies — parsec quantization collapses the solar system
  into one point (`n` #2), which is why the unit rides in the tile
  header.

### Satellites — JPL Horizons API — INGEST

- Same API, same request shape, one call per satellite.
- The major-satellite list, **corrected by the live API** (a probe that
  assumed the codes from memory got seven bodies wrong — the API is the
  citation, not the assumption). Verified one by one, 2026-10-07:
  Moon 301; Io 501, Europa 502, Ganymede 503, Callisto 504; Mimas
  601, Enceladus 602, Tethys 603, Dione 604, Rhea 605, Titan 606,
  **Hyperion 607, Iapetus 608** (the two are swapped in many lists),
  Phoebe 609; **Ariel 701, Umbriel 702, Titania 703, Oberon 704,
  Miranda 705** (the Uranian order is not the distance order); Triton
  801; Charon 901. 30/30 bodies (planets + moons) resolved with
  vectors.
- Each ephemeris names its source: `{source: jup365_merged}` (Io),
  `sat441l` (Titan), `nep098_merged` (Triton), `plu060_merged`
  (Charon), `DE441` (the Moon).
- Row identity: body name and code, as for planets.
- Licence: as for planets — no licence text on the API doc page;
  NASA/JPL service, cited per body with its ephemeris source.
- Verdict: **INGEST**. 21 named satellites, positions and magnitudes
  at the stated epoch, on their own AU-quantized tile.

### Comets — JPL SBDB Query API — INGEST

- Request (this host, 2026-10-07):
  `ssd-api.jpl.nasa.gov/sbdb_query.api?fields=spkid,pdes,full_name,H,a,e,i,om,w,ma,epoch,diameter&sb-kind=c&limit=100000`
- Response: **200**, ~1.8 s, 228 KB at `limit=2000`; at `limit=100000`
  the API returns **4,077 comets** — the full population with those
  fields.
- Row identity: `spkid` (e.g. 1000036 = `1P/Halley`, with designation
  `1P` and full name `1P/Halley`). Fields per row: H (absolute
  magnitude), orbital elements (a, e, i, om, w, ma), the elements'
  epoch, and diameter where known (Halley: 11.0 km).
- Licence: the API doc page states no licence text (checked
  2026-10-07); NASA/JPL SBDB, cited as E19's small bodies are.
- Verdict: **INGEST** — a second query through the brick E19 already
  built (`ingest/sources/sbdb.py` takes `kind="c"`; the CLI's `sbdb`
  subcommand already has `--kind` choices a/c/p). The cost is the
  query, not the machinery. Comet positions are computed from the
  elements at the stated epoch exactly as E19 computes small-body
  positions (`ingest/astro/orbits.py`).

### Galaxies — VizieR TAP, RC3 — INGEST

- Request (this host, 2026-10-07), through the TAP route every VizieR
  brick in this repo uses (`tapvizier.cds.unistra.fr/TAPVizieR/tap/sync`):
  `SELECT COUNT(*) FROM "VII/155/rc3"` → **23,011 galaxies**.
- The table's real columns (from `SELECT TOP 3 *`, the metadata query
  on `TAP_SCHEMA.columns` returns no rows for this table): `recno,
  RA2000, DE2000, GLON, GLAT, name, altname, desig, PGC, type, D25,
  BT, …, W20, W50, V21, cz, e_cz, VGSR, V3K`.
- Redshift coverage: `WHERE cz > 0` → **10,618 of 23,011**, max cz
  36,880 km/s (≈ 527 Mpc at H₀ = 70 km/s/Mpc). The 12,393 galaxies
  without a measured redshift have sky positions but no distance — they
  cannot be placed in 3D and stay out of the layer. The menu count
  states both numbers.
- Row identity: the PGC number (e.g. `PGC11598` = UGC 2523, with
  `altname` carrying the UGC designation and `desig` the KUG name).
  Distances are **derived**: d = cz / H₀, Hubble law with H₀ = 70
  km/s/Mpc stated on the card — redshift is not parallax, and the card
  says which.
- Licence: "See CDS VizieR terms" — the house citation for every
  VizieR brick (`ingest/sources/landmarks.py`); the catalogue landing
  page is `cdsarc.cds.unistra.fr/viz-bin/cat/VII/155`.
- Verdict: **INGEST** — 10,618 placed galaxies with positions, BT
  magnitudes, D25 diameters, PGC identities and redshift-derived
  distances, on a pc-quantized tile like the star tiles.

### Black holes — VizieR, Corral-Santana et al. 2016 — INGEST

- The reachable candidate that is actually a catalogue: `J/A+A/587/A61`
  (Corral-Santana et al. 2016, A&A 587, A61), found by querying the
  TAP's own table metadata (`TAP_SCHEMA.tables`), not by guess:
  *tablea1* — "astrometric properties … of all the black hole
  transients"; *tablea4* — "dynamical parameters of the sample of
  dynamical black holes".
- Counts (this host, 2026-10-07): tablea1 = **57 transients** with
  positions (RAJ2000/DEJ2000, errors, references); **33** of them carry
  a distance (`WHERE Dist > 0`); tablea4 = **18** dynamical black holes
  with masses (M1, in solar masses), **17** joinable to tablea1 by
  name.
- Distances are in **kpc** (2.29–10.5 across the sample — the values
  match the known Galactic BH distances; a pc or Mpc reading would put
  them inside the solar system or outside the Galaxy). The brick
  converts to pc for the tile; the card quotes kpc.
- Row identity: the transient name (e.g. `XTE J1650-500`,
  `SWIFT J1357.2-0933`) — the name is the join key between the two
  tables.
- What a row measures: a position always; a distance for 33; a
  dynamical mass for 17. The card says which, in those words — a BH
  row that carries only a position is not given a distance.
- Licence: A&A journal article (ESO copyright); the citation is the
  paper, the table and the VizieR mirror, per the house pattern.
- Verdict: **INGEST** — 33 placed markers (the marker primitive of
  sub-plan 03: a BH is not a light source; drawing it as a star is the
  lie this project exists to avoid), 17 of them with dynamical masses.

## Probed and refused

- **NED** (NASA/IPAC Extragalactic Database): the website answers
  (200, ~0.9 s), but its cone search is a Drupal form — `POST
  /conesearch` with cone parameters returns the form page, not data
  (verified by POST, 2026-10-07: 32,503 B, 0 object rows). No public
  GET API, no licence statement for bulk rows. **NOT-REACHABLE as a
  catalogue.**
- **HyperLEDA** (`leda.univ-lyon1.fr`): connections time out on both
  `http://` and `https://` from this host (probed 2026-10-07).
  **NOT-REACHABLE.**
- **SIMBAD** (`simbad.u-strasbg.fr/simbad/sim-tap`): the TAP answers
  (200, ~0.9 s), but `otype = 'BH'` holds **3 objects, 2 with
  positions** — a classification tag, not a catalogue. The known black
  hole *systems* are typed `HXB` ("Granat 1915+105" = GRS 1915+105,
  "V* V404 Cyg"). The black-hole verdict therefore uses the
  Corral-Santana catalogue instead; SIMBAD remains the cross-check
  source for landmarks, as it was.
- **arXiv API** (`export.arxiv.org/api`): reachable (200, ~0.5 s), but
  rows are papers, not bodies — a literature list is not a catalogue.
- **UGC as a VizieR table**: does not exist. The only "ugc" table on
  TAPVizieR is `J/MNRAS/489/4669/ugc1378`, a 2018 targeted
  re-observation. RC3 (`VII/155/rc3`) is the VizieR-hosted successor
  and carries UGC designations in its `altname` column — that is where
  the UGC identity lives.
- **Gaia DR3 NSS** (the modern black-hole-candidate source): not on the
  reachable VizieR TAP — `I/355` has no tables there (probed
  2026-10-07). Recorded so the next survey knows to look there from a
  host that reaches the ESA archive.

## What a row measures (the card's honesty rows)

| kind | position | distance | the row that makes it honest |
|---|---|---|---|
| planets | Horizons vector at epoch | — (heliocentric) | the ephemeris and epoch the position is valid for |
| satellites | Horizons vector at epoch | — (heliocentric) | the ephemeris source and epoch |
| comets | elements → position at epoch | — (heliocentric) | the elements' epoch |
| galaxies | RC3 J2000 | cz / H₀ (Hubble law, H₀ = 70) | "distance from redshift", the cz, the assumed H₀ |
| black holes | Corral-Santana J2000 | kpc, 33 of 57 | which of position / distance / mass the row actually carries |
