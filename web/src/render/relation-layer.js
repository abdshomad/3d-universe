/**
 * Relation ribbons placed among the measured stars.
 *
 * A constellation figure is a set of sky positions. To draw it in three
 * dimensions we attach each end to a star we actually measured: find the nearest
 * one in angle, and if there is none within tolerance, draw nothing. A line to a
 * star we cannot name is a line to nothing.
 *
 * The index is built in world metres, so it survives the floating origin moving
 * — only the ribbon vertices need rebasing. The match rate is reported, because
 * "we drew 12 of 400 lines" is a fact about the data, not a rendering choice.
 */

import { Vector3 } from 'three/webgpu';

import { celestialDirection } from '../core/celestial.js';
import { assertCited, citableRelations, relationStyle } from '../data/relations.js';
import { createRibbonMesh } from './ribbons.js';

const DEFAULT_TOLERANCE_DEG = 0.35;

/** Index of measured stars by direction, for nearest-in-angle lookups. */
export class StarIndex {
  /** @param {Float64Array} worldPositions star positions in world metres */
  constructor(worldPositions) {
    this.directions = new Float64Array(worldPositions.length);
    this.positions = [];
    for (let i = 0; i < worldPositions.length; i += 3) {
      const x = worldPositions[i];
      const y = worldPositions[i + 1];
      const z = worldPositions[i + 2];
      const length = Math.hypot(x, y, z) || 1;
      this.directions[i] = x / length;
      this.directions[i + 1] = y / length;
      this.directions[i + 2] = z / length;
      this.positions.push(new Vector3(x, y, z));
    }
    this.cache = new Map();
  }

  get size() {
    return this.positions.length;
  }

  /** Nearest measured star to a sky position, or null within `toleranceDeg`. */
  nearest(raDeg, decDeg, toleranceDeg = DEFAULT_TOLERANCE_DEG) {
    const key = `${raDeg.toFixed(3)},${decDeg.toFixed(3)},${toleranceDeg}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const target = celestialDirection(raDeg, decDeg);
    const cosTolerance = Math.cos((toleranceDeg * Math.PI) / 180);
    let best = -Infinity;
    let bestIndex = -1;
    for (let i = 0; i < this.positions.length; i += 1) {
      const dot = this.directions[3 * i] * target[0]
        + this.directions[3 * i + 1] * target[1]
        + this.directions[3 * i + 2] * target[2];
      if (dot > best) {
        best = dot;
        bestIndex = i;
      }
    }
    const found = bestIndex >= 0 && best >= cosTolerance ? this.positions[bestIndex] : null;
    this.cache.set(key, found);
    return found;
  }
}

/**
 * Build ribbon meshes for every cited relation whose ends both match a star.
 *
 * @param {{relations: object[], citation: object, index: StarIndex, widthMetres: number,
 *          alpha?: number, seed?: number, maxRibbons?: number, curve?: number,
 *          originMetres?: number[]}} options
 */
export function buildRelationRibbons({
  relations,
  citation,
  index,
  widthMetres,
  alpha = 0.9,
  seed = 11,
  maxRibbons = 400,
  curve = 0.14,
  originMetres = [0, 0, 0],
}) {
  const cited = citableRelations(
    relations.map((relation) => ({ ...relation, citation: relation.citation ?? citation })),
  );

  const meshes = [];
  let attempted = 0;
  let matchedEnds = 0;

  for (const relation of cited) {
    assertCited(relation);
    const style = relationStyle(relation.type);
    for (const segment of relation.segments) {
      if (meshes.length >= maxRibbons) break;
      attempted += 1;
      const start = index.nearest(segment[0][0], segment[0][1]);
      const end = index[segment.length - 1] ? endOf(segment) : null;
      const finish = index.nearest(segment[segment.length - 1][0], segment[segment.length - 1][1]);
      if (!start || !finish) continue;
      matchedEnds += 2;
      const mesh = createRibbonMesh({
        points: [toRenderSpace(start, originMetres), toRenderSpace(finish, originMetres)],
        colour: style.colour,
        width: widthMetres,
        alpha,
        curve,
        seed: seed + meshes.length,
        name: relation.id,
      });
      mesh.userData.citation = citation;
      mesh.userData.relationType = relation.type;
      meshes.push(mesh);
    }
  }

  return {
    meshes,
    report: {
      cited: cited.length,
      attempted,
      drawn: meshes.length,
      matchedEnds,
      starsIndexed: index.size,
    },
  };
}

function toRenderSpace(world, originMetres) {
  return new Vector3(
    world.x - originMetres[0],
    world.y - originMetres[1],
    world.z - originMetres[2],
  );
}