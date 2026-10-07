/**
 * The menu controller: open, close, move, pick, drill.
 *
 * Keyboard-first, the way search is: `b` opens the panel,
 * arrows move the selection, Enter lists a kind or flies
 * a body, Escape backs out of a list and then closes.
 * While the panel is open it owns the keyboard — Tab
 * cycles inside it and never out — and focus returns to
 * wherever it was when it closes. The controller hands a
 * picked body to its caller and flies nothing itself:
 * what a pick does belongs to whoever wired the menu.
 */

import { renderMenu } from '../ui/menu.js';

export class Menu {
  /**
   * @param {{root: Element, motion: {reduced: boolean},
   *          onPick?: (entry: object) => void}} options
   */
  constructor({ root, motion, onPick }) {
    this.root = root;
    this.motion = motion;
    this.onPick = onPick;
    this.panel = root.querySelector('#menu');
    this.button = root.querySelector('[data-hud=menu]');
    this.list = this.panel?.querySelector('[data-menu=list]');
    this.model = null;
    this.active = 0;
    // The view is the level the menu is showing: the
    // kinds, or one held kind's bodies.
    this.view = { level: 'kinds', kind: null };
    this.opened = false;
    this.lastFocus = null;

    this.button?.addEventListener('click', () => this.toggle());
    this.panel?.querySelector('[data-menu=close]')
      ?.addEventListener('click', () => this.close());
    // One delegated listener: a click on a row is that
    // row's ask — a kind lists its bodies, a body flies.
    this.list?.addEventListener('click', (event) => {
      const row = event.target.closest('[data-menu-entry]');
      if (!row || !this.model) return;
      const index = this.indexOf(row.dataset.menuEntry);
      if (index >= 0) {
        this.active = index;
        this.pick();
      }
    });
    this.panel?.addEventListener('keydown', (event) => this.panelKey(event));
  }

  /** The entries the model holds, in menu order. */
  get entries() {
    return this.model?.entries ?? [];
  }

  /** The body list the view is showing, when it shows one. */
  get currentList() {
    if (this.view.level !== 'bodies') return null;
    return this.model?.lists.get(this.view.kind) ?? null;
  }

  /** The rows the view is showing, whichever level that is. */
  get rows() {
    return this.currentList?.bodies ?? this.entries;
  }

  /** A new model: the loaded datasets changed, so repaint. */
  setModel(model) {
    this.model = model;
    this.active = 0;
    this.view = { level: 'kinds', kind: null };
    if (this.opened) this.paint();
  }

  open() {
    // An empty menu cannot open: there is nothing to pick.
    if (!this.panel || this.opened || this.entries.length === 0) return;
    this.opened = true;
    this.lastFocus = this.root.activeElement ?? null;
    this.view = { level: 'kinds', kind: null };
    this.active = 0;
    this.panel.hidden = false;
    this.panel.dataset.open = '';
    this.paint();
    this.focusActive();
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    this.panel.hidden = true;
    this.panel.removeAttribute('data-open');
    // Focus returns to where it was, if that is still in
    // the document; the menu button is the fallback.
    if (this.lastFocus?.isConnected) this.lastFocus.focus();
    else this.button?.focus();
  }

  toggle() {
    if (this.opened) this.close();
    else this.open();
  }

  move(delta) {
    const count = this.rows.length;
    if (count === 0) return;
    this.active = (this.active + delta + count) % count;
    this.paint();
    this.focusActive();
  }

  /**
   * The selected row's ask. A kind is a door, not a
   * destination: listing it is the pick. A body is a
   * destination: the caller flies it.
   */
  pick() {
    if (this.view.level === 'bodies') {
      const entry = this.currentList?.bodies[this.active];
      if (entry) this.onPick?.(entry);
      return;
    }
    const kind = this.entries[this.active]?.kind;
    if (kind && this.model?.lists.get(kind)) this.drill(kind);
  }

  /** Show one held kind's bodies. */
  drill(kind) {
    if (!this.model?.lists.get(kind)) return;
    this.view = { level: 'bodies', kind };
    this.active = 0;
    this.paint();
    this.focusActive();
  }

  /** Back to the kinds, from wherever the view is. */
  up() {
    if (this.view.level !== 'bodies') return;
    this.view = { level: 'kinds', kind: null };
    // The kind that was listed stays selected, so
    // backing out lands where the viewer was.
    const index = this.entries.findIndex(
      (entry) => entry.kind === this.view.kind,
    );
    this.active = index >= 0 ? index : 0;
    this.paint();
    this.focusActive();
  }

  paint() {
    renderMenu(this.panel, this.model, { ...this.view, active: this.active });
  }

  focusActive() {
    const key = this.view.level === 'bodies'
      ? this.currentList?.bodies[this.active]?.id
      : this.entries[this.active]?.kind;
    if (key == null) return;
    this.list?.querySelector(`[data-menu-entry="${key}"]`)?.focus();
  }

  /** The panel's own keys. Everything else is the caller's. */
  panelKey(event) {
    if (!this.opened) return;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        // Escape is one step back: out of a list, then
        // out of the menu.
        if (this.view.level === 'bodies') this.up();
        else this.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Tab':
        // The trap: Tab cycles inside the panel, never out.
        event.preventDefault();
        this.cycle(event.shiftKey ? -1 : 1);
        break;
      default:
        break;
    }
  }

  cycle(direction) {
    const focusable = [...(this.panel?.querySelectorAll('button') ?? [])]
      .filter((element) => !element.disabled);
    if (focusable.length === 0) return;
    const index = focusable.indexOf(this.root.activeElement);
    const next = focusable[
      (index + direction + focusable.length) % focusable.length
    ];
    next?.focus();
  }

  /** The row's index in the rows the view is showing. */
  indexOf(key) {
    return this.rows.findIndex((row) => {
      if (this.view.level === 'bodies') return row.id === key;
      return row.kind === key;
    });
  }
}
