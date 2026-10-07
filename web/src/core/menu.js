/**
 * The menu controller: open, close, move, pick.
 *
 * Keyboard-first, the way search is: `b` opens the panel,
 * arrows move the selection, Enter picks, Escape closes.
 * While the panel is open it owns the keyboard — Tab
 * cycles inside it and never out — and focus returns to
 * wherever it was when it closes. The controller hands a
 * picked entry to its caller and flies nothing itself:
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
    this.opened = false;
    this.lastFocus = null;

    this.button?.addEventListener('click', () => this.toggle());
    this.panel?.querySelector('[data-menu=close]')
      ?.addEventListener('click', () => this.close());
    // One delegated listener: a click on a row picks that row's kind.
    this.list?.addEventListener('click', (event) => {
      const row = event.target.closest('[data-menu-entry]');
      if (!row || !this.model) return;
      const index = this.model.entries.findIndex(
        (entry) => entry.kind === row.dataset.menuEntry,
      );
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

  /** A new model: the loaded datasets changed, so repaint. */
  setModel(model) {
    this.model = model;
    this.active = 0;
    if (this.opened) this.paint();
  }

  open() {
    // An empty menu cannot open: there is nothing to pick.
    if (!this.panel || this.opened || this.entries.length === 0) return;
    this.opened = true;
    this.lastFocus = this.root.activeElement ?? null;
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
    const count = this.entries.length;
    if (count === 0) return;
    this.active = (this.active + delta + count) % count;
    this.paint();
    this.focusActive();
  }

  /** Hand the selected entry to the caller. */
  pick() {
    const entry = this.entries[this.active];
    if (entry) this.onPick?.(entry);
  }

  paint() {
    renderMenu(this.panel, this.model, this.active);
  }

  focusActive() {
    const kind = this.entries[this.active]?.kind;
    this.list?.querySelector(`[data-menu-entry="${kind}"]`)?.focus();
  }

  /** The panel's own keys. Everything else is the caller's. */
  panelKey(event) {
    if (!this.opened) return;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
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
}
