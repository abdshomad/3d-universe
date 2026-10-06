# 01 — Catalogue survey: what can exist at all

The menu the user asked for lists planets, satellites, comets,
galaxies, black holes. The atlas holds none of those as first-class
kinds today — and the project's whole argument is that a kind
without a cited catalogue must not be faked. So the first question
is not "how do we render it" but **"what real catalogue exists,
can this host reach it, and what would a row look like?"**

This sub-plan is research with receipts. It produces
`docs/deep-research/celestial-bodies.md`: one row per kind, each
with the evidence, and a verdict.

**Already settled by prior work (do not re-litigate):**

- Small bodies (asteroids): JPL SBDB Query API is reachable,
  returns physical parameters (Ceres: H 3.34, G 0.12), and the
  ingest brick exists (`ingest/sources/sbdb.py`). Verdict is
  **INGEST — already built**, shipped by E19.
- Pulsars, exoplanets, landmarks, doubles, stars: **HELD** —
  inventory only, no work.
- T3 far structure: DESI ELG is 16.25 GB, LRG 5.48 GB, CosmoDC2
  unreachable from this host (E21 probe, 2026-10-06). Individual
  far galaxies are out of scope (PRD decision 2).

**The open questions, one per kind the user named:**

| kind | candidate sources to probe | the question that decides it |
|---|---|---|
| solar-system majors | JPL Horizons API, SBDB | does either serve the 8+1 majors with position *and* physical parameters under a licence we can ship? |
| satellites | JPL Horizons (major moons) | are the major moons addressable as named bodies, or only as SPICE kernels (which would be a different product)? |
| comets | JPL SBDB (`des=…&c=comet`) | does the same brick cover comets, and at what count? |
| galaxies | NED, HyperLEDA, a curated nearby sample (e.g. RC3/UGC via VizieR) | is any *individual* galaxy list with distances reachable at a sane size? VizieR is reachable (research, 2026-10-04); NED and HyperLEDA are untested from this host. |
| black holes | SIMBAD via VizieR (typed queries), published BH-candidate lists on arXiv/ADS | is there a *catalogue* — with positions, distances and identifiers — or only a literature list that would need hand-curation (which is not a catalogue)? |

**Method, per kind:** probe from this host (the same evidence
standard as the DESI and T2 probes), record status code, latency,
payload size, licence text, and the identity of a row (spkid?
name? designations?). A source that cannot name its rows cannot
cite them, and a body that cannot be cited cannot be in the menu.

**Invariant that matters.** A verdict without a receipt is a
wish. "Reachable" means a response this host actually received,
logged with its date; "licence" means the licence text the source
itself states. Where a source is unreachable, the receipt says so
— exactly as the ESA TAP and CosmoDC2 receipts do.

**Exit.** `docs/deep-research/celestial-bodies.md` carries a
verdict per kind — **INGEST / HELD / NOT-REACHABLE (with reason
and date)** — and no kind enters sub-plan 02 without an INGEST
verdict and a named row identity.
