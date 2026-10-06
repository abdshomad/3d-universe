# 04 — The HUD menu: a view over what is loaded

The menu is the *last* thing this plan builds, because it is
a view over datasets, not a wish list. Its rule, stated once
here because every other rule follows from it:

**The menu shows what is loaded, and only that.** A kind
with no loaded dataset is not listed as if it existed — it
is listed as *not held*, with the reason, or omitted
entirely. The fact-card dispatcher already refuses to invent
cards ("a card over invented data is the failure this
project exists to avoid", 2026-10-04); the menu holds the
same rule at the door.

**The view model, before any HTML.** The HUD is already a
pure view model (`ui/hud.js#hudModel`) whose rules are
tested without a browser — 348 tests run on it. The menu
follows the same pattern:

```
menuModel({ loaded: [{ kind, label, count, flag, citation }] })
  → { entries: [{ kind, label, count, flag }],
      held: number, notHeld: [{ kind, reason }] }
```

- `loaded` is the single source: each entry is a dataset the
  scene actually loaded, with its object count and provenance
  flag. The menu cannot list a kind the scene does not have.
- `flag` rides on the entry, so the menu itself can badge:
  a `SIMULATED` entry is visually marked before it is ever
  clicked (the badge rule, applied at the door).
- `notHeld` carries the *reason* ("no satellite catalogue
  is loaded"), because an honest absence is information and
  a silent one looks like a bug.

**The panel** (`ui/menu.js`, following `ui/tour.js`): opens
from a HUD button, kind-ordered, each entry showing label,
count and flag badge; keyboard-first — `b` opens (the same
pattern as `/` for search), arrows move, Enter picks,
Escape closes; focus is trapped while open and returned on
close; reduced motion disables any animation (the motion
policy in `core/accessibility.js` already owns that decision).

**What a pick does is 05's business.** This sub-plan's exit
is the menu itself: correct entries, correct badges, correct
empty states, keyboard-only operation.

**Tests, in the established order:** the view model first
(a kind is an entry only when loaded; the flag rides
through; `notHeld` names its reason), then the panel in the
headless browser (opens with `b`, arrows, Enter, Escape; the
entry list matches `window.__atlas`'s loaded datasets; a
`SIMULATED` entry carries its badge).

**Invariant that matters.** The menu is a *projection*, not
a second copy: it reads the same loaded-dataset state the
renderer uses. A menu that keeps its own list of kinds would
drift from the sky it claims to index — the same class of
bug as the renderer's private photometry copy, which was
removed for exactly that reason (2026-10-04).

**Exit.** In a headless browser, the menu lists exactly the
loaded kinds with their flags; a kind with no dataset shows
its absence with a reason; the whole panel is operable
without a mouse; and the view-model tests cover the rules
without a browser.
