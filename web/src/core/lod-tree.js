/**
 * Octree LOD over baked tiles.
 *
 * Tiles are leaves: the tree is built from tile bounds and their magnitude
 * range alone, so nothing is downloaded to decide what to draw. Selection asks
 * three questions — is the tile in the view pyramid, is it in front of the
 * camera, and are its stars still bright enough to earn a point of budget.
 *
 * Brightness is physical, not cosmetic. A star baked with apparent magnitude G
 * from Earth shows as G + 5·log₁₀(d/d₀) from a camera at distance d, where d₀
 * is the tile's own distance from the origin. Past the magnitude limit the tile
 * earns nothing; nearer than its brightest star it earns everything.
 */

import { Box, solidAngle } from './box.js';
import { forwardDistance } from './frustum.js';
import { METRES_PER_AU, METRES_PER_PC } from './units.js';

const DEFAULT_MAX_DEPTH = 8;
const MIN_DRAWN_PER_TILE = 64;
const UNIT_METRES = { pc: METRES_PER_PC, au: METRES_PER_AU, m: 1 };

export class LodNode {
  constructor(bounds, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
    this.children = null;
    this.tiles = [];
  }

  insert(entry, maxDepth) {
    if (this.depth >= maxDepth || !this.bounds.containsPoint(entry.box.centre)) {
      this.tiles.push(entry);
      return;
    }
    if (this.children === null) this.children = subdivide(this.bounds, this.depth);
    this.children[childIndexFor(this.bounds, entry.box.centre)].insert(entry, maxDepth);
  }

  /** Every node holding tiles, depth first. */
  forEachPopulated(visit) {
    if (this.tiles.length > 0) visit(this);
    if (this.children) this.children.forEach((child) => child.forEachPopulated(visit));
  }
}

export class LodTree {
  constructor({ maxDepth = DEFAULT_MAX_DEPTH } = {}) {
    this.maxDepth = maxDepth;
    this.root = new LodNode(new Box([-1e30, -1e30, -1e30], [1e30, 1e30, 1e30]));
    this.tiles = [];
  }

  /**
   * Add a tile straight from its manifest entry: origin and extent arrive in
   * the tile's own unit and are converted to world metres here.
   */
  addFromManifest(entry) {
    const scale = UNIT_METRES[entry.unit];
    if (!scale) throw new RangeError(`unknown tile unit ${entry.unit}`);
    const centre = entry.origin.map((value, axis) => (value + entry.extent[axis] / 2) * scale);
    const size = entry.extent.map((value) => value * scale);
    const box = Box.fromCentreExtent(centre, size);
    return this.add({
      id: entry.tile_id,
      box,
      count: entry.count,
      magRange: entry.mag_range ?? [],
      referenceMetres: box.distanceToPoint([0, 0, 0]) + box.boundingRadius(),
    });
  }

  /** @param {{id: string, box: Box, count: number, magRange: number[], referenceMetres: number}} entry */
  add(entry) {
    this.root.insert(entry, this.maxDepth);
    this.tiles.push(entry);
    return this;
  }

  get tileCount() {
    return this.tiles.length;
  }

  /** Nodes holding tiles, for debugging and render-pass planning. */
  populatedNodes() {
    const nodes = [];
    this.root.forEachPopulated((node) => nodes.push(node));
    return nodes;
  }

  /**
   * Choose what to draw this frame.
   *
   * @param {{planes: number[][], position: number[], direction: number[],
   *          budgetPoints?: number, magnitudeLimit?: number, maxDistanceMetres?: number}} request
   * @returns {{visible: Array, culled: number, points: number}}
   */
  select({
    planes,
    position,
    direction,
    budgetPoints = 300000,
    magnitudeLimit = 12,
    maxDistanceMetres = Infinity,
  }) {
    const candidates = [];
    let culled = 0;

    for (const entry of this.tiles) {
      const distance = Math.max(entry.box.distanceToPoint(position), 1);
      const ahead = forwardDistance(position, direction, entry.box.centre);
      const behindCamera = ahead + entry.box.boundingRadius() < 0;
      const tooFar = distance > maxDistanceMetres;
      const outsideView = entry.box.isOutsidePlanes(planes, position);

      if (behindCamera || tooFar || outsideView) {
        culled += 1;
        continue;
      }

      const fraction = fractionVisible({
        magRange: entry.magRange,
        distanceMetres: distance,
        referenceMetres: entry.referenceMetres,
        limit: magnitudeLimit,
      });
      if (fraction <= 0) {
        culled += 1;
        continue;
      }
      candidates.push({ ...entry, distance, angle: solidAngle(entry.box, position), fraction });
    }

    const visible = allocate(candidates, budgetPoints);
    return {
      visible,
      culled,
      points: visible.reduce((total, item) => total + item.drawCount, 0),
    };
  }
}

/**
 * Share of a tile still bright enough to see, assuming its stars spread evenly
 * between its brightest and faintest magnitude.
 *
 * @param {{magRange: number[], distanceMetres: number, referenceMetres: number, limit: number}} args
 */
export function fractionVisible({ magRange, distanceMetres, referenceMetres, limit }) {
  const [magMin, magMax] = magRange.length === 2 ? magRange : [limit, limit];
  const shift = 5 * Math.log10(Math.max(distanceMetres, 1) / Math.max(referenceMetres, 1));
  const visibleAbove = limit - shift;
  if (magMax === magMin) return visibleAbove >= magMin ? 1 : 0;
  return clamp01((visibleAbove - magMin) / (magMax - magMin));
}

/** Spend the budget on the tiles that cover the most sky per point spent. */
function allocate(candidates, budgetPoints) {
  const ranked = [...candidates].sort((a, b) => b.angle * b.fraction - a.angle * a.fraction);
  const chosen = [];
  let remaining = budgetPoints;

  for (const candidate of ranked) {
    const wanted = Math.max(MIN_DRAWN_PER_TILE, Math.round(candidate.count * candidate.fraction));
    const drawCount = Math.min(wanted, candidate.count, remaining);
    if (drawCount <= 0) break;
    chosen.push({
      ...candidate,
      drawCount,
      stride: Math.max(1, Math.floor(candidate.count / drawCount)),
    });
    remaining -= drawCount;
  }
  return chosen;
}

function subdivide(bounds, depth) {
  const centre = bounds.centre;
  return [0, 1, 2, 3, 4, 5, 6, 7].map(
    (index) => new LodNode(childBox(bounds, centre, index), depth + 1),
  );
}

function childBox(bounds, centre, index) {
  const pick = (axis, bit) => (bit ? [centre[axis], bounds.max[axis]] : [bounds.min[axis], centre[axis]]);
  const [x0, x1] = pick(0, index & 1);
  const [y0, y1] = pick(1, index & 2);
  const [z0, z1] = pick(2, index & 4);
  return new Box([x0, y0, z0], [x1, y1, z1]);
}

function childIndexFor(bounds, point) {
  const centre = bounds.centre;
  return (point[0] >= centre[0] ? 1 : 0)
    + (point[1] >= centre[1] ? 2 : 0)
    + (point[2] >= centre[2] ? 4 : 0);
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}