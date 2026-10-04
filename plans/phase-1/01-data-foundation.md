# Sub-plan 01 — Data Foundation

**Goal:** turn public catalogs into compact, provenance-carrying tiles the renderer can stream.
Nothing in the browser queries a live archive.

## Why offline

Measured from this host on 2026-10-04:

- Gaia TAP `SELECT TOP 1` round-trip: **~36 s**.
- Gaia `parallax > 10` filter over `gaiadr3.gaia_source`: **timed out at 90 s**.

So the browser must consume baked artifacts. This sub-plan is the whole data contract.

## Sources for v1

| Source | Access | Contents |
|---|---|---|
| ESA Gaia Archive | TAP/ADQL, verified live | Positions, parallax, G/BP/RP magnitudes → distances, colors |
| JPL SBDB Query API | HTTPS JSON, verified live | Small-body orbits + physical parameters (T0) |
| NASA/ESA/ESO imagery | HTTP, public domain | Deep-field backdrop layers |

HEASARC TAP timed out from this host — treat as optional, re-probe before depending on it.

## Tasks

- [ ] `[TODO]` `ingest/` Python package with one module per source: `gaia.py`, `sbdb.py`, `imagery.py`.
- [ ] `[TODO]` Shared extraction schema: `SourceId, ra, dec, distance_pc, mag, color_index, kind,
  provenance`.
- [ ] `[TODO]` Parallax → distance with **NaN handling**; drop negative/zero parallax rather than
  emitting negative distances. A star without a parallax has no 3D position — it must not enter T1.
- [ ] `[TODO]` Magnitude → size/brightness and B−V → RGB conversion in one place, shared by bake and
  renderer so both agree.
- [ ] `[TODO]` Tile writer: binary, quantized position/mag/color, with a tile index.
- [ ] `[TODO]` `manifest.json`: tile bounds, source catalog + release, row-id range, checksum.
- [ ] `[TODO]` Bake T1 slice (stars within a configurable distance) and verify counts against the
  archive.
- [ ] `[TODO]` Bake T0 slice for the solar system + major small bodies.
- [ ] `[TODO]` Provenance round-trip test: every id in a tile resolves back to its catalog row.
- [ ] `[TODO]` Gaia DR4 re-bake path: the DR4 lands 2026-12-02; changing the release must be a config
  edit, not a code change.

## Acceptance

- A tile of 100 000 stars loads and every entry resolves to a provenance record.
- No negative or invented distances in any baked tile.
- Re-running the bake with a different Gaia release produces a new manifest without touching code.

## Risks

- DR4 is days away and larger than DR3; schema drift is the main hazard. Mitigation: unknown columns
  are carried through as opaque extras rather than dropped.
- Public TAP is slow and rate-limited. Mitigation: bake in chunks with checkpointing, and cache
  raw responses on disk so a failed run never re-queries.