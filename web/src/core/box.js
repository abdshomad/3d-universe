/**
 * Axis-aligned boxes in world metres, as plain arrays.
 *
 * Tiles ship with an origin and an extent in their own unit; everything spatial
 * in the engine works in metres, so a tile becomes a box in metres once.
 */

export class Box {
  /**
   * @param {number[]} min
   * @param {number[]} max
   */
  constructor(min, max) {
    if (min.length !== 3 || max.length !== 3) throw new RangeError('box needs three axes');
    this.min = [...min];
    this.max = [...max];
  }

  /** Build from a tile header's origin and extent. */
  static fromCentreExtent(origin, extent) {
    const half = extent.map((value) => value / 2);
    return new Box(
      origin.map((value, axis) => value - half[axis]),
      origin.map((value, axis) => value + half[axis]),
    );
  }

  get centre() {
    return this.min.map((value, axis) => (value + this.max[axis]) / 2);
  }

  get size() {
    return this.min.map((value, axis) => this.max[axis] - value);
  }

  /** Longest side, in metres: the number that decides how big a tile looks. */
  get longestSide() {
    return Math.max(...this.size);
  }

  containsPoint(point) {
    return point.every((value, axis) => value >= this.min[axis] && value <= this.max[axis]);
  }

  /** Distance from a point to the box; zero inside. */
  distanceToPoint(point) {
    const gaps = point.map(
      (value, axis) => Math.max(this.min[axis] - value, 0, value - this.max[axis]),
    );
    return Math.hypot(...gaps);
  }

  /** Radius of the sphere that encloses the box. */
  boundingRadius() {
    return Math.hypot(...this.size.map((value) => value / 2));
  }

  /**
   * Is the box entirely outside the view pyramid?
   *
   * Planes are evaluated in camera-relative coordinates, which is what makes
   * them usable at 1e20 m: the plane constants stay small instead of
   * cancelling against world coordinates.
   *
   * @param {number[][]} planes inward side planes as [a, b, c, d]
   * @param {number[]} [origin] camera position in world metres
   */
  isOutsidePlanes(planes, origin = [0, 0, 0]) {
    for (const [a, b, c, d] of planes) {
      // The extreme of n·x over a box depends on the sign of each normal
      // component: min·n is neither the minimum nor the maximum in general, and
      // using it culls tiles that are plainly in view.
      const extreme =
        (a >= 0 ? this.max[0] - origin[0] : this.min[0] - origin[0]) * a
        + (b >= 0 ? this.max[1] - origin[1] : this.min[1] - origin[1]) * b
        + (c >= 0 ? this.max[2] - origin[2] : this.min[2] - origin[2]) * c
        + d;
      if (extreme < 0) return true;
    }
    return false;
  }
}

/** Solid angle a box subtends from a point, in steradians. */
export function solidAngle(box, fromPoint) {
  const radius = box.boundingRadius();
  const distance = Math.max(box.distanceToPoint(fromPoint), 1e-9);
  return (Math.PI * radius * radius) / (distance * distance);
}