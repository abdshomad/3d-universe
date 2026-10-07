/**
 * The known-bodies menu: a view over what is loaded.
 *
 * The model is pure, so its rules run without a browser:
 * a kind is an entry only when the scene loaded its
 * dataset, the provenance flag rides through on the
 * entry, and a kind with no dataset is listed as not
 * held, with the reason. A held kind's bodies are the
 * bodies the scene loaded — brightest first, capped,
 * and the cap says what it is showing. The menu is a
 * projection of the loaded state, never a second list:
 * the labels and the order live here, once; the counts,
 * the flags and the bodies come from the scene, every
 * time the model is built.
 */

import { BODY_LIMIT, CELESTIAL_KINDS } from '../core/celestial-index.js';

/** The kinds the menu can name, in menu order. */
export const MENU_KINDS = [
  { kind: 'small_body', label: 'small bodies' },
  { kind: 'comet', label: 'comets' },
  { kind: 'planet', label: 'planets' },
  { kind: 'satellite', label: 'satellites' },
  { kind: 'galaxy', label: 'galaxies' },
  { kind: 'black_hole', label: 'black holes' },
];

/**
 * Project the loaded datasets onto the menu.
 *
 * @param {{loaded?: Array<{kind: string, count: number,
 *          flag?: string|null, label?: string}>,
 *          bodies?: Map<string, Array<object>>}} state
 * @returns {{entries: Array<{kind: string, label: string,
 *           count: number, flag?: string|null}>,
 *           held: number,
 *           notHeld: Array<{kind: string, label: string, reason: string}>,
 *           lists: Map<string, {bodies: Array<object>,
 *                   total: number, unit: string,
 *                   distance: string}>}}
 */
export function menuModel({ loaded = [], bodies = new Map() } = {}) {
  const held = new Map(loaded.map((entry) => [entry.kind, entry]));
  const entries = [];
  const notHeld = [];
  const lists = new Map();
  for (const { kind, label } of MENU_KINDS) {
    const dataset = held.get(kind);
    if (dataset) {
      entries.push({
        kind,
        label: dataset.label ?? label,
        count: dataset.count,
        // The flag is the dataset's own provenance, never a
        // default: a loaded tile always carries one, and a
        // missing one is the em dash on screen, not a guess.
        flag: dataset.flag ?? null,
      });
      lists.set(kind, bodyList(
        bodies.get(kind) ?? [], kind, dataset.flag ?? null));
    } else {
      notHeld.push({
        kind,
        label,
        reason: `no ${label} catalogue is loaded`,
      });
    }
  }
  return { entries, held: entries.length, notHeld, lists };
}

/**
 * One kind's body list: brightest first, capped, with the
 * full count beside it. A cap that says what it is showing
 * is a projection of the loaded state; one that does not
 * is a lie. Bodies without a magnitude close the list.
 */
function bodyList(entries, kind, flag = null) {
  const spec = CELESTIAL_KINDS[kind];
  const sorted = [...entries].sort((a, b) => {
    const magnitude = spec.magnitude;
    if (magnitude === null) return 0; // catalogue order
    const left = a[magnitude] ?? null;
    const right = b[magnitude] ?? null;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left - right;
  });
  return {
    bodies: sorted.slice(0, BODY_LIMIT),
    total: sorted.length,
    unit: spec.unit,
    distance: spec.distance,
    flag,
  };
}

/** The line above the list: what the menu is showing. */
export function subtitleFor(model, view) {
  if (view.level === 'bodies') {
    const list = model.lists.get(view.kind);
    const label = model.entries.find((entry) => entry.kind === view.kind)
      ?.label ?? view.kind;
    if (!list) return `${label} — not held`;
    const capped = list.total > list.bodies.length;
    const shown = list.bodies.length.toLocaleString('en-US');
    const total = list.total.toLocaleString('en-US');
    return capped
      ? `${label} — ${shown} brightest of ${total}`
      : `${label} — ${total} held`;
  }
  return `${model.held} of ${MENU_KINDS.length} kinds held`;
}

const setText = (element, text) => {
  if (element && element.textContent !== text) element.textContent = text;
};

/** The row's own distance, in the kind's own unit. */
function distanceText(entry, list) {
  const value = entry[list.distance];
  if (value == null || !Number.isFinite(value)) return null;
  return `${Number(value.toPrecision(4))} ${list.unit}`;
}

/**
 * Paint the model onto the #menu skeleton. Pure paint: the
 * rows are rebuilt from the model every time, so what is
 * on screen is exactly the model, and the controller owns
 * focus and picking. `view` says which level is shown and
 * which row is selected: the kinds, or one kind's bodies.
 *
 * @param {Element} panel the #menu skeleton
 * @param {object} model a menuModel result
 * @param {{level?: string, kind?: string, active?: number}} view
 */
export function renderMenu(panel, model, view = {}) {
  if (!panel || !model) return;
  const { level = 'kinds', kind = null, active = 0 } = view;
  setText(panel.querySelector('[data-menu=subtitle]'),
    subtitleFor(model, { level, kind }));
  setText(panel.querySelector('[data-menu=keys]'),
    level === 'bodies'
      ? '↑↓ move · enter fly · esc back'
      : '↑↓ move · enter list · esc close');
  const list = panel.querySelector('[data-menu=list]');
  if (!list) return;
  list.textContent = '';
  if (level === 'kinds') {
    model.entries.forEach((entry, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'menu-entry';
      row.dataset.menuEntry = entry.kind;
      row.tabIndex = index === active ? 0 : -1;
      if (index === active) row.dataset.active = '';
      const name = document.createElement('span');
      name.className = 'menu-name';
      name.textContent = entry.label;
      const count = document.createElement('span');
      count.className = 'menu-count';
      count.textContent = entry.count.toLocaleString('en-US');
      const flag = document.createElement('span');
      flag.className = 'menu-flag';
      flag.dataset.menuFlag = entry.flag ?? '';
      flag.textContent = entry.flag ?? '—';
      row.append(name, count, flag);
      list.append(row);
    });
  } else {
    const shown = model.lists.get(kind);
    if (shown) {
      shown.bodies.forEach((entry, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'menu-entry';
        row.dataset.menuEntry = entry.id;
        row.tabIndex = index === active ? 0 : -1;
        if (index === active) row.dataset.active = '';
        const name = document.createElement('span');
        name.className = 'menu-name';
        name.textContent = entry.name ?? entry.id;
        const count = document.createElement('span');
        count.className = 'menu-count';
        count.textContent = distanceText(entry, shown) ?? '—';
        const flag = document.createElement('span');
        flag.className = 'menu-flag';
        flag.dataset.menuFlag = entry.flag ?? shown.flag ?? '';
        flag.textContent = entry.flag ?? shown.flag ?? '—';
        row.append(name, count, flag);
        list.append(row);
      });
    }
  }
  const absence = panel.querySelector('[data-menu=not-held]');
  if (absence) {
    absence.textContent = '';
    for (const missing of model.notHeld) {
      const row = document.createElement('div');
      row.className = 'menu-not-held';
      setText(row, `${missing.label} — not held: ${missing.reason}`);
      absence.append(row);
    }
  }
}
