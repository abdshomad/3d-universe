/**
 * The known-bodies menu: a view over what is loaded.
 *
 * The model is pure, so its rules run without a browser:
 * a kind is an entry only when the scene loaded its
 * dataset, the provenance flag rides through on the
 * entry, and a kind with no dataset is listed as not
 * held, with the reason. The menu is a projection of
 * the loaded state, never a second list: the labels and
 * the order live here, once; the counts and the flags
 * come from the scene, every time the model is built.
 */

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
 *          flag?: string|null, label?: string}>}} state
 * @returns {{entries: Array<{kind: string, label: string,
 *           count: number, flag?: string|null}>,
 *           held: number,
 *           notHeld: Array<{kind: string, label: string, reason: string}>}}
 */
export function menuModel({ loaded = [] } = {}) {
  const held = new Map(loaded.map((entry) => [entry.kind, entry]));
  const entries = [];
  const notHeld = [];
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
    } else {
      notHeld.push({
        kind,
        label,
        reason: `no ${label} catalogue is loaded`,
      });
    }
  }
  return { entries, held: entries.length, notHeld };
}

const setText = (element, text) => {
  if (element && element.textContent !== text) element.textContent = text;
};

/**
 * Paint the model onto the #menu skeleton. Pure paint: the
 * rows are rebuilt from the model every time, so what is on
 * screen is exactly the model, and the controller owns focus
 * and picking. `active` is the selected entry's index.
 *
 * @param {Element} panel the #menu skeleton
 * @param {object} model a menuModel result
 * @param {number} active selected entry index
 */
export function renderMenu(panel, model, active = 0) {
  if (!panel || !model) return;
  setText(panel.querySelector('[data-menu=subtitle]'),
    `${model.held} of ${MENU_KINDS.length} kinds held`);
  const list = panel.querySelector('[data-menu=list]');
  if (!list) return;
  list.textContent = '';
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
