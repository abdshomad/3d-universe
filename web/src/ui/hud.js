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

export const NAV_ITEMS = ['ATLAS', 'ROUTE', 'TIERS', 'PROVENANCE'];

export const PRECEDENCE = ['SIMULATED', 'UNRESOLVED', 'MEASURED'];

/** What the badge should say, given which kinds of content are present. */
export function provenanceBadge(flags = {}) {
  return PRECEDENCE.find((flag) => flags[flag]) ?? 'EMPTY';
}

function formatDistance(pc) {
  if (pc === null || pc === undefined) return '—';
  if (pc < 1) return `${(pc * 206265).toFixed(1)} AU`;
  if (pc < 1000) return `${pc.toFixed(2)} pc`;
  if (pc < 1e6) return `${(pc / 1000).toFixed(2)} kpc`;
  return `${(pc / 1e6).toFixed(1)} Mpc`;
}

function formatMagnitude(value) {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

/** Rows for the fact card of a measured star. */
export function starFactCard(selection) {
  if (!selection) return null;
  return {
    name: selection.name ?? `gaia ${selection.id}`,
    rows: [
      ['catalogue id', selection.id],
      ['distance', formatDistance(selection.distancePc)],
      ['apparent mag', formatMagnitude(selection.magnitude)],
      ['colour index B-V', formatMagnitude(selection.colorIndex)],
    ],
    provenance: selection.provenance ?? 'esa.gaia DR3 · U3DTILE2 · measured',
    image: selection.image ?? null,
  };
}

/**
 * Build the view model.
 *
 * @param {{stats?: object, selection?: object, flags?: object, sources?: string[],
 *          minPc?: number|null, maxPc?: number|null}} state
 */
export function hudModel(state = {}) {
  const { stats = {}, selection = null, flags = {}, sources = [], minPc = null, maxPc = null } = state;

  return {
    title: '3D UNIVERSE',
    subtitle: 'a provenance-honest atlas',
    nav: [...NAV_ITEMS],
    factCard: starFactCard(selection),
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