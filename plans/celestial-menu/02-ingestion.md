# 02 — Ingestion: bricks, tiles, verifiers

Sub-plan 01 hands this plan a verdict per kind: **INGEST**
with a named row identity, or nothing. This plan turns each
INGEST verdict into a baked, verified asset — the same
pipeline every existing dataset went through
(`ingest/`: brick → bake → manifest → verify).

**The pipeline, stated once because every brick follows
it:**

1. **Brick** (`ingest/sources/<kind>.py`, extending
   `base.py`): the extraction query, the normalization to
   the tile schema, and the provenance block — catalog,
   release, licence, retrieval date, and the URL the rows
   came from. The provenance block is not decoration: it is
   what the verifier re-checks and the card cites.
2. **Bake** (`ingest/bake.py` + the kind's quantizer):
   positions to the tile's binary format, each with its
   catalogue id. Two quantizers already exist and the new
   kinds choose between them: **pc** for the far kinds
   (stars, and any 01-approved far sample) and **AU** for
   solar-system bodies — the first small-body bake came out
   degenerate because parsec quantization collapsed the
   solar system into one point (`n` #2), which is why the
   unit rides in the tile header.
3. **Manifest** (`ingest/manifest.py`): per-tile bounds,
   unit, catalog/release, provenance flag, row-id range and
   SHA-256. A tile without a manifest entry does not ship.
4. **Verify** (`ingest/verify.py`): re-run the brick's
   stored query against the live source and match the
   catalogue ids in the tile. The event verifier found real
   bugs this way (559 dispersion-measure distances nobody
   had noticed); the SBDB verifier re-runs its query
   already. A kind that cannot be verified ships with the
   receipt of why, stated in the file — never a silent pass.

**What this plan does *not* do:** small bodies. E19 owns
the SBDB tile (bake, layer, `small_body` card, verifier
coverage); this plan's job is to make sure E19's output
lands in the same manifest the other kinds use, so the menu
sees one asset list. The SBDB brick exists
(`ingest/sources/sbdb.py`); the tile does not ship yet.

**Per kind from 01's verdicts**, the work is: a brick (or
the existing SBDB one), a quantizer choice (AU or pc), a
manifest entry, and a verify path. Comets, if 01 approves
them, are a second SBDB query through the same brick —
the cost is the query, not new machinery.

**Invariant that matters.** A tile's rows are re-checkable
against the source it names. If the source has changed
since the bake (comet orbits are republished; a survey
release moves), the verifier says so — a stale tile is a
known-stale tile, not a silently wrong one.

**Exit.** Every INGEST kind from 01 has a baked tile in
`assets/tiles/`, a manifest entry with its provenance block,
and a verifier that re-runs its source query and matches
ids — or a file that says, with the receipt, why it cannot.
