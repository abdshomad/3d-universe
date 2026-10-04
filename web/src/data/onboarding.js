/**
 * The opening: thirty seconds, one line at a time, no wall.
 *
 * Each hint appears when it becomes relevant and leaves when it has been acted
 * on. Wording matters more than timing here — a hint that explains the *verb*
 * ("hold W to fly out") teaches faster than one that describes the scene.
 */

export const OPENING_STEPS = [
  {
    id: 'where',
    text: 'the Sun · real positions, every star measured',
    showAfter: 0,
    showFor: 9,
  },
  {
    id: 'fly',
    text: 'hold W to fly out · SHIFT for speed',
    showAfter: 4,
    showFor: 26,
    hideOn: 'flew',
  },
  {
    id: 'look',
    text: 'the reticle marks the nearest measured star',
    showAfter: 11,
    showFor: 22,
    hideOn: 'selected',
  },
  {
    id: 'search',
    text: 'type a name to fly somewhere',
    showAfter: 18,
    showFor: 26,
    hideOn: 'searched',
  },
  {
    id: 'route',
    text: 'J guided journey · R scale out',
    showAfter: 26,
    showFor: 20,
  },
];
