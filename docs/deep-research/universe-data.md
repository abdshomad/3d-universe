# Deep Research — The Most Complete Universe Data

Date: 2026-10-04 · Status: initial ingest (`i`). Every "live" claim below was probed from this host.

## 1. What "complete universe data" actually means

There is no complete map. Coverage is a stack of nested partial universes, each with its own
fidelity ceiling. Planning starts by naming the tiers, not by promising "everything".

| Tier | Extent | Fidelity | Governing sources |
|---|---|---|---|
| T0 Solar system | AU → 100 AU | Exact, dynamic | JPL Horizons/SBDB, SPICE kernels |
| T1 Stellar neighborhood | 1 pc → 100 kpc | 3D positions where parallax exists | Gaia (to DR4), Hipparcos, Yale BSC, H3D/H4 |
| T2 Galactic structure | 10 kpc → 100 kpc | Density fields, not individuals | Planck dust, HI/21cm, HERA, extinction maps |
| T3 Large-scale structure | 100 Mpc → 1 Gpc | Statistically homogeneous | DESI, SDSS, Rubin, Euclid, Roman |
| T4 Sky field | Gpc → 13.8 Gpc | 2D images, no depth | JWST/Hubble/Euclid deep fields, Rubin alerts |
| T5 Synthesized | everywhere | Art/procedural, **not measurement** | Simulation boxes, art direction |

Tiers overlap and must never be blended without provenance. Rendering a synthetic galaxy where a
measured one exists is a correctness bug, not a style choice.

## 2. Live-probe results from this machine (2026-10-04)

Verified reachable, with real payloads:

- **Gaia@AIP mirror** (`gaia.aip.de/tap/sync`, VOTable): **the working path.** A parallax-filtered
  query returns in ~1 s:
  ```
  SELECT TOP 5 source_id,ra,dec,parallax,phot_g_mean_mag,bp_rp
  FROM gaiadr3.gaia_source WHERE parallax > 10 AND phot_g_mean_mag < 8 ORDER BY parallax DESC
  → 762815470562110464, 165.83096, 35.94865, 392.75, 6.55, 2.2156   (2.55 pc)
  ```

  **The mirror is a subsample, and that matters.** Measured on the same host:

  | Query | Mirror | Gaia DR3 |
  |---|---|---|
  | stars with G < 8 | **62,723** | ~117 million |
  | stars in a 36″ box at α Centauri A | **0** | thousands |

  So roughly 0.05% of Gaia DR3 is served. Positions in a baked tile are
  unbiased, and every tile we produce matches the mirror's own counts — but
  *famous* nearby stars are usually absent, which is exactly what a guided
  journey wants to visit. Landmarks therefore come from **Hipparcos**
  (VizieR I/239/hip_main), which is complete and small: 118,218 rows, fetched
  whole. Do not describe a baked tile as "the nearest N stars" — it is "N stars
  from a ~0.05% sample of Gaia DR3".
- **ESA Gaia Archive TAP** (ADQL, sync): unreliable from here. A `SELECT TOP 1` round-trip took
  ~36 s; the same filtered query exceeds 90 s; and the full filtered query returns after 10–42 s
  with an async `JOBID` and a VOTable containing **no `TABLEDATA`** — a job that would need
  polling. Use the mirror; revisit ESA only with a job-polling implementation in hand.

  Consequence for architecture, unchanged by the mirror: the browser never queries a live
  archive. All catalog access is **batched offline and baked into static binary assets**.
- **VizieR** (`vizier.cds.unistra.fr`, ASU protocol): 200 OK, header advertises `ASU`/IVOA.
- **JPL SBDB Query API**: 200 OK, returns physical parameters (e.g. Ceres absolute magnitude 3.34,
  slope parameter G 0.12) — usable directly for T0.

Not reachable from this host: **HEASARC TAP/Xamin** (connect timeout). Treat as optional; mirror via
VizieR/HEASARC W3Browse instead, and retry from a different egress before committing.

## 3. Catalog landscape and what is coming

**Gaia (ESA)** — the backbone for T1. Release scenario, verified on ESA's own page:
DR1 2016-09-14 · DR2 2018-04-25 · EDR3 2020-12-03 · DR3 2022-06-13 · FPR 2023-10-10 ·
**DR4 = 2026-12-02 (66 months of data)** · DR5 (full mission + Legacy Archive) not before end of 2030.
A June 2026 DR4 pre-release sample exists for tooling rehearsals. ESA reports >3 trillion
observations of 2 billion stars and objects. Consequence: build the schema and the bake pipeline so
DR4 is a **re-bake, not a rewrite**; the parallax filter is the one product-defining field.

**Vera Rubin / LSST** — T3+T4. Data Preview 1 published (arXiv:2603.23786, Mar 2026), Early Data
Preview 2 released 2026-07-27, first products from the LSST Camera. Scale: ~10 TB/night
(Rubin key numbers; the LSST DM page quotes ~20 TB), 60 s alert latency, ~10 000 alerts/visit,
~10 million alerts/night, 11 data releases. Consequence: alert stream is a T4 event source, not a
geometry source — v1 consumes periodic data releases, never the firehose.

**DESI** — completed its planned five-year survey April 2026, >47 million galaxies and quasars mapped
in 3D, continued operations. This is the reference T3 LSS dataset for large-scale structure.

**Euclid** — Q1 2025-03-19, Q2 2026-06-24. Optical + near-infrared, wide survey.

**Nancy Roman** — launch 2026 (Falcon Heavy, LC-39A; NASA launch updates as of 2026-08-30).
Six-year wide-field survey to follow.

**Multimessenger** — GWTC-4.0 (128 new candidates from O4a, May 2023–Jan 2024, released Aug 2025);
NANOGrav 15-yr and 20-yr pulsar timing datasets; CHIME/FRB Catalog 2 (2026); ATNF pulsar catalogue
(psrcat, also mirrored in HEASARC W3Browse). These give **positions + timing**, i.e. sparse event
anchors with real provenance — high value, tiny data.

**Simulations (T5)** — IllustrisTNG (TNG50/100/300, TNG-Cluster; public API key required per
request), FIRE-2 public data releases. Legitimate for filling voids *when labeled as simulation*.

**Archives/APIs** — MAST (JWST, Hubble, TESS, Kepler, Exo.MAST), NASA/IPAC IRSA, ESO Science
Archive with DOIs, NASA Scientific Visualization Studio (public-domain imagery).

## 4. Access standards and tooling

- **IVOA TAP 1.1** (Recommendation, 2019) with **ADQL** is the lingua franca: one query language,
  machine-readable results, async/sync modes. Every archive above exposes some variant.
- **astroquery** is the default client, but its own docs state TAP/TAP+ will be **removed** and
  recommend **pyVO** for non-ESA TAP services. Do not build a pipeline on a deprecated path.
- AstroPy for coordinates (ICRS ↔ galactic ↔ equatorial), units, and light-travel-time handling.
- Frame-rate reality: 36 s Gaia round-trip ⇒ interactive 3D must consume **pre-baked tiles**.

## 5. Visual references (analyzed, not assumed)

Both supplied references were downloaded and inspected frame-by-frame.

- **`@_cosmicearth`** (2026-10-03, 1080×1080, 60 fps, 6 s loop): a cinematic fly-through of an
  ultra-deep field. Photoreal JWST/Hubble texture — dense faint galaxies, grey dust filaments,
  colored stellar points, bright stars with soft halos. No UI. The look is *volume*, not map.
- **`@RuiHuang_art` "Encyclopedia Cosmologica"** (2026-10-03, 2874×1440, 53 s): dark chrome,
  luminous colored filaments and nodes forming a constellation-like network, thin orbital HUD
  rings, sparse starfield, minimal UI. Art-directed "atlas of everything". Artist cites Jon Lomberg
  and Carl Sagan; the piece is a physical payload to Alpha Centauri in 2029.

**Derived art direction** — the product should fuse both: a photoreal volumetric star field as the
medium, a luminous knowledge-graph as the information layer, and a minimal diegetic HUD. That is the
target for the PRD; specifics are still open questions (see §6).

## 6. Open questions blocking a final plan

1. Scale ambition: parallax-truth to ~100 kpc, then art fill? Or pseudo-3D all the way to Gpc?
2. Is procedurally filled space allowed, and if so, how is it visually marked?
3. Web (WebGPU + WebGL2 fallback) or native engine?
4. Engine: three.js WebGPURenderer, Babylon.js, Godot, or Cesium?
5. v1 definition of done: passive cinematic fly-through, or searchable interactive atlas?

## 7. Performance envelope

SpaceEngine renders ~300 000 stars across ~100 VBOs and calls performance "not bad" — a useful
sanity anchor: a real-time cosmic scene is a **hundred thousand to low millions** of points, not
billions. Billions require LOD streaming, and every star needs a baked, compact representation.

## 8. Rendering stack — what exists (researched, then decided)

- **three.js `WebGPURenderer`** targets WebGPU and **falls back to WebGL 2 automatically**, which is
  the whole reason it won: one codebase, old hardware still runs. Compute-shader pipelines for large
  point clouds are the documented WebGPU win.
- **GPU instancing + additive blending + bloom** is the standard recipe for star fields; the
  reference look needs additive sprites and a bloom threshold low enough to bleed bright stars.
- **LOD is mandatory, not an optimization**: SpaceEngine's own figures (~300 000 stars over ~100
  VBOs) put a real-time cosmic scene in the 10⁵–10⁶ point class. Billions only arrive as streamed
  tiles.
- **Aladin Lite v3** (CDS, HiPS in the browser) is the strongest existing option for a 2D sky-atlas
  panel — image cutouts, HiPS overlays, footprint queries — worth embedding rather than rebuilding.
- Rejected for v1: Babylon.js (less direct control of the custom additive ribbon/flare rendering the
  references demand), Godot/Unreal (breaks the "public web app, no install" decision), Cesium
  (Earth-centric).

**Decided 2026-10-04:** three.js `WebGPURenderer` with WebGL 2 fallback, public web app.