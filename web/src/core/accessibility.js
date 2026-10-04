/**
 * Accessibility: the parts that are decisions rather than CSS.
 *
 * Three of them, kept pure so they can be tested:
 *
 * - Motion. An atlas that flies itself and drifts on its own is exactly the kind
 *   of thing that makes someone ill. Under reduced motion we do not start the
 *   route, we do not drift, and we say so rather than silently doing nothing.
 * - Contrast. WCAG ratios, computed rather than eyeballed, because "it looked
 *   fine on my monitor" is how dim grey text on black survives to production.
 * - Keyboard reach. Which key does what, in one place, so the bindings cannot
 *   drift apart from the help text.
 */

const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3;

/** Relative luminance of an sRGB hex colour, 0..1. */
export function luminance(hex) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1..21. */
export function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Does this pair clear WCAG AA? */
export function meetsAA(foreground, background, { large = false } = {}) {
  return contrastRatio(foreground, background) >= (large ? WCAG_AA_LARGE : WCAG_AA_NORMAL);
}

/**
 * What the app is allowed to do to you.
 * @param {{reduced: boolean}} context
 */
export function motionPolicy({ reduced = false } = {}) {
  return {
    // The policy says whether it is a reduced-motion policy, so callers can ask
    // the one object rather than re-deriving it — and get it right.
    reduced,
    autoPlayRoute: !reduced,
    drift: !reduced,
    onboarding: true,
    hint: true,
  };
}

/** Does the viewer prefer reduced motion? Safe to call outside a browser. */
export function prefersReducedMotion(view = globalThis) {
  const query = view?.matchMedia;
  if (typeof query !== 'function') return false;
  try {
    return query.call(view, '(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/** The single source of truth for what the keys do. */
export const KEY_BINDINGS = [
  { keys: ['w', '↑'], action: 'fly out' },
  { keys: ['s', '↓'], action: 'fly in' },
  { keys: ['a', '←'], action: 'strafe left' },
  { keys: ['d', '→'], action: 'strafe right' },
  { keys: ['q', 'e'], action: 'descend / rise' },
  { keys: ['shift'], action: 'faster' },
  { keys: ['j'], action: 'guided journey' },
  { keys: ['c'], action: 'cinematic auto-fly' },
  { keys: ['r'], action: 'scale-out route' },
  { keys: ['/'], action: 'focus search' },
  { keys: ['escape'], action: 'dismiss hints' },
];

export function describeKeys() {
  return KEY_BINDINGS.map((binding) => `${binding.keys.join('/')} ${binding.action}`).join(' · ');
}
