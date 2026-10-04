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
- [ ] `[TODO]` `manifest.json`: tile bounds, source catalog + release, row-id range, checksum.
- [x] Bake T1 slice with counts verified against the archive's own COUNT: 1413 objects at parallax
  > 50 mas and 228 at > 100 mas — exact match.
- [x] Bake T0 slice for the solar system + major small bodies — 200 asteroids at real positions in
  AU, round-trip error 6e-5 AU.
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