/**
 * Deep links: a view you can send to someone.
 *
 * The URL carries position, orientation, observer epoch and selection. It is
 * read from untrusted input, so nothing here evaluates, executes or guesses:
 * a hash that does not parse is ignored, and a view with impossible numbers is
 * refused rather than flown to.
 */

const PARSEC_TO_METRES = 3.0856775814913673e16;
const MAX_PARSECS = 1e12;
const MAX_YEAR = 1e6;

const toFinite = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/** A view: where you are, what you face, when you look, and what is selected. */
export function makeView({ positionMetres = [0, 0, 0], yaw = 0, pitch = 0, observerYear = null, selectionId = null } = {}) {
  return {
    positionMetres: [...positionMetres],
    yaw,
    pitch,
    observerYear,
    selectionId,
  };
}

/**
 * Encode a view as a URL hash fragment.
 * @returns {string} like `#p=1.347,-0.001,0.004&y=270.0&t=12.5&e=2026&s=hip:32349`
 */
export function encodeView(view) {
  const ifinite = toFinite;
  const position = (view?.positionMetres ?? []).map((value) => ifinite(value, 0));
  const parsecs = position.map((metres) => metres / PARSEC_TO_METRES);
  const parts = [`p=${parsecs.map((v) => v.toFixed(4)).join(',')}`];
  parts.push(`y=${ifinite(view?.yaw, 0).toFixed(2)}`);
  parts.push(`t=${ifinite(view?.pitch, 0).toFixed(2)}`);
  if (ifinite(view?.observerYear, null) !== null) parts.push(`e=${Math.round(ifinite(view.observerYear))}`);
  if (view?.selectionId) parts.push(`s=${encodeURIComponent(String(view.selectionId))}`);
  return `#${parts.join('&')}`;
}

/**
 * Decode a hash fragment into a view, or null if it is not one.
 * @param {string} hash with or without the leading '#'
 */
export function decodeView(hash) {
  if (typeof hash !== 'string' || !hash.trim()) return null;
  const body = hash.replace(/^#/, '');
  const fields = {};
  for (const chunk of body.split('&')) {
    const [key, ...rest] = chunk.split('=');
    if (!key || rest.length === 0) continue;
    fields[key] = decodeURIComponent(rest.join('='));
  }

  const rawPosition = (fields.p ?? '').split(',').map(Number);
  if (rawPosition.length !== 3 || rawPosition.some((value) => !Number.isFinite(value))) return null;

  const radiusPc = Math.hypot(...rawPosition);
  if (radiusPc > MAX_PARSECS) return null;

  const yaw = toFinite(fields.y, 0);
  const pitch = toFinite(fields.t, 0);
  if (yaw === null || pitch === null) return null;

  let observerYear = null;
  if (fields.e !== undefined) {
    observerYear = toFinite(fields.e, null);
    if (observerYear === null || Math.abs(observerYear) > MAX_YEAR) observerYear = null;
  }

  return makeView({
    positionMetres: rawPosition.map((value) => value * PARSEC_TO_METRES),
    yaw,
    pitch,
    observerYear,
    selectionId: fields.s ?? null,
  });
}

/** Does this fragment describe a view we can restore? */
export function isViewFragment(hash) {
  return decodeView(hash) !== null;
}

/** The current view as a fragment, for sharing. */
export function fragmentFor(location) {
  const hash = location?.hash ?? '';
  return isViewFragment(hash) ? hash : '';
}
