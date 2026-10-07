/**
 * Black-hole markers: a ring, not a star point.
 *
 * A black hole is not a light source, and drawing one as a star
 * point is the exact lie this project exists to avoid. The primitive
 * is a GPU-drawn line ring — the reticle machinery's circle — which
 * faces the camera and holds a fixed angular size at any distance,
 * the way an annotation should. The marker carries its provenance
 * the way a spark does: cited at build, refused when uncited, and a
 * marker whose catalogue row is missing is not drawn at all.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
} from 'three/webgpu';

import { assertCited } from '../data/relations.js';
import { circlePoints, worldWidthForPixels } from './reticles.js';

/** The angular radius a marker holds, in screen pixels. */
export const MARKER_PIXELS = 14;
const MARKER_COLOUR = [0.85, 0.62, 0.95];
const RING_SEGMENTS = 48;

/**
 * One ring per placed catalogue row.
 *
 * @param {{tile: object, positions: Float64Array,
 *          rows: Map<string, object>, citation?: object}} options
 */
export function createBlackHoleMarkers({ tile, positions, rows, citation }) {
  assertCited({ citation });
  const strokes = circlePoints(1, RING_SEGMENTS);
  const markers = [];
  for (let index = 0; index < tile.count; index += 1) {
    const row = rows.get(tile.ids[index].toString());
    if (!row) continue; // a marker without its row is not drawn
    const geometry = new BufferGeometry();
    const vertices = new Float32Array(strokes.length * 3);
    strokes.forEach(([x, y, z], vertex) => {
      vertices[3 * vertex] = x;
      vertices[3 * vertex + 1] = y;
      vertices[3 * vertex + 2] = z;
    });
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    const material = new LineBasicMaterial({
      color: new Color(...MARKER_COLOUR),
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const ring = new LineSegments(geometry, material);
    ring.name = 'black-hole-marker';
    ring.renderOrder = 14;
    ring.frustumCulled = false;
    ring.position.set(
      positions[3 * index],
      positions[3 * index + 1],
      positions[3 * index + 2],
    );
    ring.userData = {
      kind: 'black_hole',
      label: 'black hole',
      row,
      tileIndex: index,
      citation,
    };
    markers.push(ring);
  }
  return markers;
}

/**
 * A marker is an annotation: it faces the camera and holds its
 * angular size at any distance, so a ring reads as a ring from
 * everywhere the viewer can stand.
 */
export function updateBlackHoleMarkers(
  markers,
  camera,
  { fovDegrees = 60, viewportHeight = 800 } = {},
) {
  for (const ring of markers) {
    const distance = ring.position.distanceTo(camera.position);
    const radius = worldWidthForPixels(distance, MARKER_PIXELS, fovDegrees, viewportHeight);
    ring.scale.setScalar(radius);
    ring.lookAt(camera.position);
  }
}
