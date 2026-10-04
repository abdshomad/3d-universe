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
| Gaia DR3 | Gaia@AIP TAP mirror, ~1 s, verified live | Positions, parallax, G/BP/RP magnitudes → distances, colors |
| JPL SBDB Query API | HTTPS JSON, verified live | Small-body orbits → real 3D positions at catalog epoch |
| NASA image library | HTTPS JSON, verified live, public domain | Deep-field backdrop layers |

HEASARC TAP timed out from this host — treat as optional, re-probe before depending on it.

The official ESA archive TAP is available but unusable from this host (async job, no `TABLEDATA`);
the ingest package fails loudly on an empty result rather than returning nothing.

- [x] `ingest/` Python package with one module per source: `gaia.py`, `sbdb.py`, `imagery.py`
  (done 2026-10-04, verified against all three live sources).
- [x] Shared extraction schema: `source_id, ra_deg, dec_deg, distance_pc, mag, color_index,
  kind, provenance` — `ingest/schema.py`.
- [x] Parallax → distance with NaN handling; unusable parallaxes are dropped, never given a
  fabricated distance — `ingest/astro/distance.py`.
- [x] Magnitude → size/brightness and B−V → RGB in one place — `ingest/astro/photometry.py`
  (verified: B−V 2.0 renders orange-red, −0.3 blue-white).
- [x] Tile writer: binary, quantized position/mag/color, in the tile's own unit (pc for stars, AU
  for small bodies) — `ingest/tiles.py`, 11.27 B/star, round-trip error 0.0004 pc across a 53 pc
  extent, exactly at the quantization bound.
- [x] `manifest.json`: tile bounds, unit, catalog + release, flag, row-id range and SHA-256 per tile
  — `ingest/manifest.py`. Checksums match `sha256sum` independently; a single flipped byte changes
  the digest, so tampering is detectable.
- [x] Bake T1 slice with counts verified against the archive's own COUNT: 1413 objects at parallax
  > 50 mas and 228 at > 100 mas — exact match.
- [x] Bake T0 slice for the solar system + major small bodies — 200 asteroids at real positions in
  AU, round-trip error 6e-5 AU.
- [x] Provenance round-trip test: every id in a tile resolves back to its catalog row —
  `ingest/verify.py` re-runs the tile's stored query against the same endpoint and matches by id.
  Gaia 2000/2000 and SBDB 150/150 resolve, position delta at the quantization bound. Two negative
  cases fail loudly: a bogus id (1999/2000) and a shifted star (0.539 pc vs 0.000342 tolerance).
  Tiles now store per-object ids (`U3DTILE2`), so a selected star is citable.
- [x] Gaia DR4 re-bake path: releases are data, not code — `ingest/catalogs.json` plus
  `ingest/catalogs.py`. `--release DR2` and `--release DR3` both bake and verify (2000/2000 ids each)
  with no code change; DR4 is refused with the reason and its 2026-12-02 date, and flipping
  `available` in the JSON is all that activation needs.

## Acceptance

- A tile of 100 000 stars loads and every entry resolves to a provenance record.
- No negative or invented distances in any baked tile.
- Re-running the bake with a different Gaia release produces a new manifest without touching code.

## Risks

- DR4 is days away and larger than DR3; schema drift is the main hazard. Mitigation: unknown columns
  are carried through as opaque extras rather than dropped.
- Public TAP is slow and rate-limited. Mitigation: bake in chunks with checkpointing, and cache
  raw responses on disk so a failed run never re-queries.