/**
 * Picking a point cloud in screen space.
 *
 * Solar-system bodies, galaxies and black-hole markers are a few
 * pixels wide; a depth-scaled raycast threshold would make them
 * unclickable at one scale and over-easy at another. Project the
 * layer, take the nearest point on screen, and resolve it through the
 * tile it came from — the same path a click, a search and a deep link
 * share, so all three name one object, not two.
 */

import { Vector3 } from 'three/webgpu';

import { MARKER_PIXELS } from '../render/marker-layer.js';
import { identityAt, nearestCellOnScreen } from './picker.js';

/**
 * The nearest point of a tiled layer to a click.
 *
 * @param {object} ndc the click in normalized device coordinates
 * @param {{layer: object, tile: object, rows?: Map<string, object>,
 *          camera: object, originMetres: number[], width: number,
 *          height: number, maxPixels?: number}} options
 */
export function pickTiledPoints(ndc, {
  layer, tile, rows, camera, originMetres, width, height, maxPixels = 12,
}) {
  if (!layer || !tile || !layer.geometry) return null;
  const positions = layer.geometry.attributes.position.array;
  const count = positions.length / 3;
  const projected = new Float64Array(count * 3);
  const vertex = new Vector3();
  for (let index = 0; index < count; index += 1) {
    vertex.set(positions[3 * index], positions[3 * index + 1], positions[3 * index + 2])
      .project(camera);
    projected[3 * index] = vertex.x;
    projected[3 * index + 1] = vertex.y;
    projected[3 * index + 2] = vertex.z;
  }
  const hit = nearestCellOnScreen(projected, ndc, { width, height, maxPixels });
  if (!hit) return null;
  const identity = identityAt({ tile, index: hit.index, originMetres });
  if (!identity) return null;
  const row = rows ? rows.get(identity.id) : null;
  return {
    ...identity,
    ...row,
    world: [positions[3 * hit.index], positions[3 * hit.index + 1], positions[3 * hit.index + 2]],
  };
}

/**
 * The nearest black-hole marker to a click. A marker is a ring around
 * a point, so the ring's own position is what is aimed at, and the
 * identity resolves through the tile index the marker was built from.
 */
export function pickMarkersAt(ndc, {
  markers, tile, camera, originMetres, width, height,
  maxPixels = MARKER_PIXELS + 6,
}) {
  if (markers.length === 0 || !tile) return null;
  const projected = new Float64Array(markers.length * 3);
  const vertex = new Vector3();
  markers.forEach((ring, index) => {
    vertex.set(ring.position.x, ring.position.y, ring.position.z).project(camera);
    projected[3 * index] = vertex.x;
    projected[3 * index + 1] = vertex.y;
    projected[3 * index + 2] = vertex.z;
  });
  const hit = nearestCellOnScreen(projected, ndc, { width, height, maxPixels });
  if (!hit) return null;
  const ring = markers[hit.index];
  const identity = identityAt({ tile, index: ring.userData.tileIndex, originMetres });
  if (!identity) return null;
  return {
    ...identity,
    ...ring.userData.row,
    world: [ring.position.x, ring.position.y, ring.position.z],
  };
}
