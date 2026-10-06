# 05 — Flight and fact cards: every entry opens a row

A menu entry that does not fly is a button that lies. This
sub-plan is the payoff: pick a kind, pick a body, and the
atlas flies to it and says what it is, cited — or refuses
honestly.

**Flight reuses the machinery that already works.** Search
(`core/search.js`) already turns a name into a flight path
and the rig already flies it, inward as well as outward
(2026-10-04). A menu pick is a search with the entry
pre-chosen: the same `flightTo` path, the same pause of the
guided route, the same "flight to <target>" waypoint. What
changes is only the *source of the choice* — a tap instead
of a keystroke. The one flight rule worth restating: a menu
pick and a search for the same body must produce the same
flight, because they are the same ask.

**The fact card learns kinds, never invents them.** The
dispatcher (`ui/fact-card.js`) already refuses kinds it
holds no catalogue for. Each new kind gets a card *only if*
01/02/03 delivered its dataset:

- `small_body` (E19): name, diameter, absolute magnitude,
  and — the row that makes it honest — **the orbital epoch
  the position is valid for**. A small body's position is an
  epoch, not a fact; the card says when, or it is showing a
  past Ceres as though it were tonight's.
- `galaxy` (if 01 found a sample): name, distance *with the
  method* (redshift is not parallax), and the catalogue it
  came from. A galaxy card without a distance method is a
  number with no provenance.
- `black_hole` (if 01 found a catalogue): what the row
  actually measures — a BH catalogue row may carry a
  *distance to the system*, a mass, or only a position; the
  card says which, in those words.

**The card the menu cannot yet write is the one it must not
write.** If a kind ships without a card (dataset loaded,
card not built), the menu entry flies and the card says
"this atlas holds <kind> but cannot yet say more" — the
honest intermediate state, the same one the planets/galaxies
cards sat in until the exoplanet archive landed.

**The epoch row generalizes.** Light-travel time already
rides every card ("light left 2017 — 8.6 yr ago"). Dynamic
kinds (small bodies) add the *validity* row; static kinds
(galaxies, black holes at cosmic distance) keep the
light-travel row. One rule covers both: the card states
*when* its numbers describe.

**Tests.** View-model tests for the dispatcher's new kinds
(a small body card carries its epoch row; a galaxy card
carries its distance method; an absent card says why), then
the browser check: a menu pick flies (the waypoint names
the target, the distance matches the catalogue's), the card
opens cited, and the CSV export includes the picked row with
its flag — the export is the last chance for a claim to be
honest, and a menu pick is a claim.

**Invariant that matters.** Picking a body from the menu and
typing its name are the same act. Any difference between the
two paths — different flight, different card, different
export row — is a bug, and the test suite asserts the
equality directly.

**Exit.** Every menu entry flies to its catalogue position,
opens a card that names its source and epoch, and exports
with its flag; a kind without a card says so instead of
inventing one; and menu-pick and search-pick produce
identical flights for the same body.
