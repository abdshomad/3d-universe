/**
 * Optional tiers: pure enhancement layers the frame budget sheds.
 *
 * An optional tier must never be the reason a frame is late, so the
 * tier budget's verdict is applied to the whole set at once — but
 * each layer keeps its own visible flag, so deferring one never
 * touches another, and a layer that is not registered is never
 * deferred by this budget at all.
 */

export class OptionalTiers {
  constructor() {
    this.layers = [];
  }

  /**
   * Register a layer as optional. The layer must be a render object
   * with a visible flag, which is the thing the budget defers.
   */
  register(layer) {
    if (!layer || !('visible' in layer)) {
      throw new TypeError('an optional tier must be a layer with a visible flag');
    }
    this.layers.push(layer);
    return layer;
  }

  /** Stop managing a layer: a rebuild replaces it, and the old one
   *  must not be deferred long after it left the scene. */
  unregister(layer) {
    const index = this.layers.indexOf(layer);
    if (index >= 0) this.layers.splice(index, 1);
  }

  /**
   * Apply the tier budget's verdict: no headroom, no enhancement.
   * During warmup the budget has no evidence and defers nothing, so
   * first paint is never judged.
   */
  applyBudget(deferred) {
    const visible = !deferred;
    for (const layer of this.layers) layer.visible = visible;
  }

  /** Every registered tier back on screen. */
  restore() {
    this.applyBudget(false);
  }
}
