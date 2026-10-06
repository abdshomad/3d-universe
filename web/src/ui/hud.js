/**
 * The HUD: what the atlas says about itself.
 *
 * Kept as a pure model — state in, view model out — so the rules that matter can
 * be tested without a browser. The one rule that earns the most: the badge says
 * what is on screen, and a simulated object outranks everything.
 *
 * Chrome stays small on purpose. The art direction allows about 8% of the frame;
 * anything that grows past that is the scene's fault, not the HUD's.
 */

import {
  cardFor,
  cardForEvent,
  cardForField,
  cardForLandmark,
  cardForSmallBody,
  cardForStar,
  formatDistance,
} from './fact-card.js';

export {
  cardFor,
  cardForEvent,
  cardForField,
  cardForLandmark,
  cardForSmallBody,
  cardForStar,
  formatDistance,
} from './fact-card.js';

export const NAV_ITEMS = ['ATLAS', 'ROUTE', 'TIERS', 'PROVENANCE'];

export const PRECEDENCE = ['SIMULATED', 'UNRESOLVED', 'MEASURED'];

/** What the badge should say, given which kinds of content are present. */
export function provenanceBadge(flags = {}) {
  return PRECEDENCE.find((flag) => flags[flag]) ?? 'EMPTY';
}

/**
 * Build the view model.
 *
 * @param {{stats?: object, selection?: object, flags?: object, sources?: string[],
 *          minPc?: number|null, maxPc?: number|null}} state
 */
export function hudModel(state = {}) {
  const {
    stats = {}, selection = null, flags = {}, sources = [],
    minPc = null, maxPc = null, observerYear = null,
  } = state;

  return {
    title: '3D UNIVERSE',
    subtitle: 'a provenance-honest atlas',
    nav: [...NAV_ITEMS],
    factCard: selection ? cardFor(selection, { observerYear }) : null,
    readout: {
      objects: stats.points ?? 0,
      distance: `${formatDistance(minPc)} – ${formatDistance(maxPc)}`,
      source: sources[0] ?? 'none',
    },
    badge: provenanceBadge(flags),
    fps: stats.fps ? Number(stats.fps.toFixed(1)) : 0,
    backend: stats.backend ?? 'unknown',
    waypoint: stats.waypoint ?? null,
  };
}

const BOXED = {
  readout: ['objects', 'distance', 'source'],
};

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

/** Paint the model onto the HUD skeleton in index.html. */
export function renderHud(root, model) {
  setText(root.querySelector('[data-hud=title]'), model.title);
  setText(root.querySelector('[data-hud=subtitle]'), model.subtitle);
  setText(root.querySelector('[data-hud=badge]'), model.badge);
  setText(root.querySelector('[data-hud=waypoint]'), model.waypoint ?? 'free flight');

  const nav = root.querySelector('[data-hud=nav]');
  if (nav) {
    setText(nav, model.nav.join('  ·  '));
  }

  for (const key of BOXED.readout) {
    setText(root.querySelector(`[data-hud=${key}]`), String(model.readout[key]));
  }

  const card = root.querySelector('[data-hud=factcard]');
  if (card) {
    card.hidden = !model.factCard;
    if (model.factCard) {
      setText(card.querySelector('[data-fact=name]'), model.factCard.name);
      const rows = card.querySelector('[data-fact=rows]');
      if (rows) {
        setText(rows, model.factCard.rows.map(([label, value]) => `${label}  ${value}`).join('\n'));
      }
      setText(card.querySelector('[data-fact=provenance]'), model.factCard.provenance);
      const image = card.querySelector('[data-fact=image]');
      if (image) {
        image.hidden = !model.factCard.image;
        if (model.factCard.image) image.src = model.factCard.image;
      }
    }
  }
}