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
// Ten arcminutes. `nearest` will hand back anything inside 0.35° — 21′ — and a
// figure point is the position of a specific star, so matches worse than this
// assert a pairing the figure does not make. They are dropped and counted.
// This must stay below nearest's own tolerance or the check can never fire.
const MAX_END_SEPARATION_ARCSEC = 600;

/** Index of measured stars by direction, for nearest-in-angle lookups. */
export class StarIndex {
  /**
   * @param {Float64Array} worldPositions star positions in world metres
   * @param {Array<string|number>} [ids] what each star is, so a match can name it
   */
  constructor(worldPositions, ids = null) {
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
    this.ids = ids;
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
    // Half the chord, not acos: acos loses its digits when the angle is small,
    // which is exactly the case that decides whether a match is exact.
    const chord = Math.hypot(
      this.directions[3 * bestIndex] - target[0],
      this.directions[3 * bestIndex + 1] - target[1],
      this.directions[3 * bestIndex + 2] - target[2],
    );
    const separationArcsec = 2 * Math.asin(Math.min(1, chord / 2)) * (180 / Math.PI) * 3600;
    const found = bestIndex >= 0 && best >= cosTolerance
      ? {
        position: this.positions[bestIndex],
        separationArcsec,
        index: bestIndex,
        id: this.ids?.[bestIndex] ?? null,
      }
      : null;
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
  maxSeparationArcsec = MAX_END_SEPARATION_ARCSEC,
}) {
  const cited = citableRelations(
    relations.map((relation) => ({ ...relation, citation: relation.citation ?? citation })),
  );

  const meshes = [];
  let attempted = 0;
  let matchedEnds = 0;
  let droppedTooLoose = 0;
  let worstSeparationArcsec = 0;

  for (const relation of cited) {
    assertCited(relation);
    const style = relationStyle(relation.type);
    for (const segment of relation.segments) {
      if (meshes.length >= maxRibbons) break;
      attempted += 1;
      const start = index.nearest(segment[0][0], segment[0][1]);
      const finish = index.nearest(segment[segment.length - 1][0], segment[segment.length - 1][1]);
      if (!start || !finish) continue;
      matchedEnds += 2;
      // A figure point is the position of a real star. If the nearest star we
      // hold is further than this, the line would join two stars the figure
      // does not name — so it is not drawn, and the loss is counted.
      const separation = Math.max(start.separationArcsec, finish.separationArcsec);
      if (separation > maxSeparationArcsec) {
        droppedTooLoose += 1;
        continue;
      }
      if (separation > worstSeparationArcsec) worstSeparationArcsec = separation;
      const mesh = createRibbonMesh({
        points: [toRenderSpace(start.position, originMetres), toRenderSpace(finish.position, originMetres)],
        colour: style.colour,
        width: widthMetres,
        alpha,
        curve,
        seed: seed + meshes.length,
        name: relation.id,
      });
      mesh.userData.citation = citation;
      mesh.userData.relationType = relation.type;
      mesh.userData.endSeparationArcsec = Number(separation.toFixed(1));
      // A line that cannot say which two stars it joins is a mark on the sky.
      mesh.userData.relationId = relation.id ?? relation.name ?? null;
      mesh.userData.relationName = relation.name ?? relation.id ?? null;
      mesh.userData.endpoints = [
        { id: start.id ?? null, separationArcsec: Number(start.separationArcsec.toFixed(1)) },
        { id: finish.id ?? null, separationArcsec: Number(finish.separationArcsec.toFixed(1)) },
      ];
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
      droppedTooLoose,
      worstSeparationArcsec: Number(worstSeparationArcsec.toFixed(1)),
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