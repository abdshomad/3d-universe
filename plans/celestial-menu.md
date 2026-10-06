# The known-bodies menu

A visitor who does not know a star's name has no way to ask
"what is here". Search answers for those who know a name; the
atlas holds seven cited datasets and none of them is browsable.
This plan adds the browsable index — a HUD menu of known
celestial bodies: planets, satellites, comets, galaxies, black
holes — where every entry is a door into a catalogue row.

The rule that shapes the whole plan: **the menu lists only what
is loaded and cited.** A kind the atlas holds nothing for says so,
visibly, in the menu itself. A menu over invented data would be
the exact lie this project exists to avoid (PRD decision 1,
`docs/prd/universe-3d.md`; the fact-card refusal of 2026-10-04).

## What the atlas already holds

| kind | dataset | status |
|---|---|---|
| stars | Gaia tiles (`assets/tiles/`) | rendered, picked, exported |
| landmarks | Hipparcos via VizieR (`search/nearby.json`) | searched, flown to |
| exoplanets | NASA Exoplanet Archive (`relations/exoplanets.json`) | facts on host cards |
| pulsars | ATNF psrcat (spark markers) | rendered, picked |
| small bodies | JPL SBDB (`ingest/sources/sbdb.py`) | rendered, picked, searched — E19 |
| **planets** | JPL Horizons API (9 bodies, vectors + APmag at epoch) | **INGEST — sub-plan 01** |
| **satellites** | JPL Horizons API (21 major moons, vectors + APmag) | **INGEST — sub-plan 01** |
| **comets** | JPL SBDB Query API, `sb-kind=c` (4,077) | **INGEST — sub-plan 01** |
| **galaxies** | VizieR TAP, RC3 `VII/155/rc3` (10,618 of 23,011 carry cz) | **INGEST — sub-plan 01** |
| **black holes** | VizieR, Corral-Santana 2016 `J/A+A/587/A61` (33 of 57 carry distances) | **INGEST — sub-plan 01** |
| deep fields | Webb/Hubble imagery | backdrop planes |
| large-scale structure | generated field | rendered, badged SIMULATED |

Verdicts with receipts: `docs/deep-research/celestial-bodies.md`.
Refused with receipts: NED (form-only, no API), HyperLEDA
(unreachable), SIMBAD `otype=BH` (3 objects — a tag, not a
catalogue), arXiv (literature, not bodies), UGC (not a VizieR
table — RC3 carries its designations), Gaia NSS (not on the
reachable TAP).

## Locked decisions this plan must not contradict

1. Honesty is enforced in the UI: anything synthetic is badged
   SIMULATED (PRD decision 1). The menu is part of the UI.
2. T3 is a *statistical* tier — individually identifiable galaxies
   are out of scope beyond the measured neighborhood (PRD decision
   2). A *nearby* galaxy sample, if a source is reachable, is a
   different thing and belongs to sub-plan 01's verdict.
3. The browser never queries catalogues: bake everything (research
   hard constraint, ~36 s measured TAP latency).
4. Provenance must be answerable in O(1) per object (PRD hard
   constraint). A menu entry that cannot say which row it opened
   does not ship.

## Sub-plans

Each stands on its own; each has an exit gate the next one needs.

- [`01-catalogue-survey`](celestial-menu/01-catalogue-survey.md) —
  for every kind the user named, what catalogue exists, is it
  reachable from this host, under what licence, at what size, and
  what is a row's identity. Verdicts, with receipts, not wishes.
- [`02-ingestion`](celestial-menu/02-ingestion.md) — for every kind
  01 approved: a brick, a baked tile, a manifest entry, and a
  verifier that re-runs the source query. Consumes E19's SBDB tile
  rather than duplicating it.
- [`03-render-primitives`](celestial-menu/03-render-primitives.md) —
  per-kind layers: points, markers, optional orbit lines. Each
  pickable, each budget-deferrable, each answering "measured?" in
  O(1).
- [`04-hud-menu`](celestial-menu/04-hud-menu.md) — the menu itself:
  a pure view model over loaded datasets, the panel, keyboard
  access, and the honest empty states.
- [`05-flight-and-cards`](celestial-menu/05-flight-and-cards.md) —
  a menu pick flies (reusing the search flight machinery) and opens
  a fact card that names its source — or a kind that has no card
  says why.

## Out of scope here

- The simulated LSS tier stays a tier, not a menu kind: it is not
  a catalogue of bodies. It is reachable through the menu only as
  what it is — a generated field, badged.
- Rubin alert streams, VR, accounts (PRD non-goals).
- Performance at new object counts belongs to E18's re-measurement.
