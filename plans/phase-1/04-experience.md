# Sub-plan 04 — Experience

**Goal:** turn the scene into something a non-astronomer can use without instructions, and
something an astronomer can trust.

Depends on 03.

## Tasks

- [x] Free flight controls: `web/src/core/flight-controls.js`. Forward moves the radius
  geometrically — `d·e^(rate·t)` — so the same keys cover the same fraction of the view at 1 AU and
  at 100 kpc, and two half-steps equal one whole step exactly. Strafe and lift change bearing and
  elevation, leaving the radius alone. Verified in a browser: W grows the distance, the waypoint
  reads `free flight` as the route pauses, and Shift boosts ~10×; the advertised gain (1.419/s) is
  the gain you actually get.
- [x] Guided journeys: `web/src/core/journey.js` builds a route from landmarks with measured
  distances — legs, holds, and a gaze that faces the next destination. Press `J` for the journey,
  `R` for the scale-out route. Verified in a browser: the flight runs 0 → 0.053 → 1.347 pc, arriving
  exactly on Alpha Centauri A's Hipparcos distance.
- [x] Search: name or HIP number in, flight path out — `web/src/core/search.js` plus a single HUD
  field. Matching is deliberately narrow: a proper name or a catalogue number, nothing looser.
  Verified in a browser: "sirius" → route `flight to Sirius`, result line
  `Sirius · 2.637 pc · HIP 32349`, and the flight ends at 2.6371 pc — the measured distance.
  An unknown name answers "nothing found" rather than inventing a star.
- [ ] `[TODO]` Fact card content per object kind: star, planet, galaxy, nebula, event.
- [ ] `[TODO]` Light-travel-time scrubber: move the observer through epochs and watch the sky change.
- [ ] `[TODO]` Onboarding: a 30-second opening that teaches flight without a tutorial wall.
- [ ] `[TODO]` Accessibility: keyboard-only flight, reduced-motion mode, readable contrast for type.
- [ ] `[TODO]` Deep links: a URL restores position, orientation, scale, and selection.

## Acceptance

- A first-time user reaches the nearest star in under 60 s without instructions.
- Every fact card shows a provenance line naming the catalog and release.
- Reduced-motion mode removes drift and flares while keeping the scene legible.

## Open dependency

Time scrubbing needs a distance-redshift mapping and a decision about what "the sky at z=0.7" means
when tiers are heterogeneous. Keep it as a view transform over existing data — never a separate
simulation.