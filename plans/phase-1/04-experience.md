# Sub-plan 04 — Experience

**Goal:** turn the scene into something a non-astronomer can use without instructions, and
something an astronomer can trust.

Depends on 03.

## Tasks

- [ ] `[TODO]` Free flight controls that work identically at every scale, including at 1 AU and at
  100 kpc. Same keys, same verbs — only the speed law changes.
- [ ] `[TODO]` Guided journeys: scripted cinematic routes (Sol → nearest star → galactic center →
  Local Group) authored as data, with an optional auto-fly mode.
- [ ] `[TODO]` Search: name lookup against the baked index, with a flight path to the result.
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