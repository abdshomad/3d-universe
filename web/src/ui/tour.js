/**
 * The tour chrome: one small panel, and a ring around the stop it
 * points at. Pure paint — the buttons belong to the skeleton in
 * index.html and are wired where the rest of the HUD is, so this file
 * stays free of state and testable without a browser.
 */

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

/** Paint one stop onto the #tour skeleton. */
export function renderTour(panel, step) {
  if (!panel || !step) return;
  setText(panel.querySelector('[data-tour=title]'), step.title);
  setText(panel.querySelector('[data-tour=text]'), step.text);
  setText(panel.querySelector('[data-tour=count]'), `${step.index + 1} / ${step.total}`);
  const back = panel.querySelector('[data-tour=back]');
  if (back) back.disabled = step.index === 0;
  const next = panel.querySelector('[data-tour=next]');
  if (next) setText(next, step.index + 1 === step.total ? 'done' : 'next');
}

/**
 * Ring the element a stop points at. A stop whose element is missing or
 * hidden says its piece in words alone — the ring is a courtesy, not a
 * promise, so it must never throw.
 */
export function highlightTourTarget(root, selector) {
  if (!root) return;
  for (const element of root.querySelectorAll('[data-tour-spot]')) {
    element.removeAttribute('data-tour-spot');
  }
  if (!selector) return;
  const target = root.querySelector(selector);
  if (target) target.setAttribute('data-tour-spot', '');
}
