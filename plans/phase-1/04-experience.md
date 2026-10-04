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
- [x] Fact card content per object kind — `web/src/ui/fact-card.js`, one implementation the HUD
  shares. Star, landmark and event cards are live and verified in the browser: Sirius reads
  `2.637 pc · parallax 379.21 ± 1.58 mas · cross-check 0.16″ vs SIMBAD`. Planet, galaxy and nebula
  cards are **not** written — we hold no exoplanet, galaxy or nebula catalogue yet, and a card over
  invented data is the failure this project exists to avoid. They arrive with their ingest.
- [x] Light-travel-time scrubber — `web/src/core/light-travel.js` plus a HUD slider that moves the
  observer's epoch. It reports when each object's light left and will arrive, and the span of epochs
  currently on screen (`observer 2026 CE · sky spans 1464 – 2026`). It deliberately does **not**
  re-render the sky: our catalogues describe one epoch, so pretending otherwise would be the easiest
  lie available to this project. Verified: +2000 years moves both ends of the span by exactly 2000
  while Sirius's lookback stays 8.6 yr, which is the correct physics.
- [x] Onboarding: `web/src/core/onboarding.js` with the script in `web/src/data/onboarding.js`.
  Thirty seconds, one line at a time, no wall. Hints are independent timers sharing a single HUD
  slot — the most recent relevant one wins, so a long-lived hint never blocks the next thing worth
  saying. Verified in a browser: `hold W to fly out` (t≈4–13) → `type a name to fly somewhere`
  (t≈17–23) → `J guided journey · R scale out`; the flight hint is gone within a second of the
  viewer actually flying.
- [x] Accessibility: `web/src/core/accessibility.js`. Keyboard-only flight is complete (`/`
  focuses search, `Escape` dismisses hints, bindings described from one source);
  `prefers-reduced-motion` stops both self-flying **and** drift; and contrast is measured rather than
  eyeballed — `--ink-dim` was 3.30:1, below AA for the small labels using it, and is now `#7c828d` at
  5.24:1. Verified in a browser with motion emulated: drift 0.00767 normally, exactly **0** under
  reduced motion, with no console errors.
- [x] Deep links: `web/src/core/deep-link.js`. The URL carries position, orientation, observer
  epoch and selection; a shared view also takes the camera off the route's opening shot. Verified in
  the browser: `#p=2.6370,0.0000,0.0000&y=90.00&t=-8.00&e=4026&s=hip:32349` restores 2.637 pc, 90°,
  −8°, Sirius selected. A hostile fragment — `#p=NaN,banana&y=;DROP` — is ignored rather than flown
  to. Three bugs the browser caught: the route clobbered the restored position, the link spoke
  degrees while the rig speaks radians, and the selection id was written as a truncated number.

## Acceptance

- A first-time user reaches the nearest star in under 60 s without instructions.
- Every fact card shows a provenance line naming the catalog and release.
- Reduced-motion mode removes drift and flares while keeping the scene legible.

## Open dependency

Time scrubbing needs a distance-redshift mapping and a decision about what "the sky at z=0.7" means
when tiers are heterogeneous. Keep it as a view transform over existing data — never a separate
simulation.