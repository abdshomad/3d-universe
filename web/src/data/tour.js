/**
 * The walk itself: seven stops, in the order a visitor needs them —
 * look, fly, name, time, navigate, trust, take away. Each stop points
 * at the piece of chrome it describes, so the UI can ring it.
 *
 * Wording follows the hints: the verb first ("type a name"), because a
 * thing said as an action is learned faster than a thing described.
 */

export const TOUR_STEPS = [
  {
    id: 'sky',
    target: '#view',
    title: 'the measured sky',
    text: 'every star is a catalogue row. drag to look around · hold W to fly out · SHIFT to hurry',
  },
  {
    id: 'search',
    target: '#search',
    title: 'fly anywhere by name',
    text: 'type a name or a HIP number and the match flies you to it — the distance is measured, not invented',
  },
  {
    id: 'pick',
    target: '#view',
    title: 'click what you see',
    text: 'a click names the object under the cursor: its card carries the distance, the parallax, and the catalogue it came from',
  },
  {
    id: 'epoch',
    target: '#epoch',
    title: 'light left years ago',
    text: 'the scrubber moves your epoch, and the card says when the light left each object — a 3D sky has no single now',
  },
  {
    id: 'routes',
    target: '#nav',
    title: 'guided flights',
    text: 'J flies the guided journey · R scales out · C runs the cinematic route',
  },
  {
    id: 'badge',
    target: '#badge',
    title: 'what is real here',
    text: 'the badge ranks what is on screen: MEASURED outranks UNRESOLVED, which outranks SIMULATED — a model never pretends to be a measurement',
  },
  {
    id: 'export',
    target: '#export',
    title: 'take the sky with you',
    text: 'download the objects on screen as csv — every row names its source',
  },
];
