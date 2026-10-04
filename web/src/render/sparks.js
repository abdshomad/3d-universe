/**
 * Spark markers: events drawn as small `+` glyphs.
 *
 * A pulsar is not a star point — it is a catalogueued object with a measured
 * position, a flux at 400 MHz, a period and an age. Drawing it the same way we
 * draw a Gaia star would flatten that into decoration, so it gets its own
 * glyph, its own colour, and its own provenance flag.
 *
 * Brightness comes from the measured flux, not from taste: a 5000 mJy Crab
 * Pulsar outshines a 5 mJy millisecond pulsar by exactly what the catalogue
 * says it does.
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

export const EVENT_KINDS = {
  pulsar: { colour: [0.96, 0.55, 0.86], label: 'pulsar' },
  frb: { colour: [0.55, 0.85, 0.98], label: 'fast radio burst' },
  gravitational_wave: { colour: [0.86, 0.62, 0.98], label: 'gravitational wave' },
};

/** The two crossing strokes of a `+`, in the plane facing the camera. */
export function sparkGlyphPoints({ size = 1, hollow = false } = {}) {
  if (!hollow) {
    return [
      [-size, 0, 0], [size, 0, 0],
      [0, -size, 0], [0, size, 0],
    ];
  }
  // A hollow ring for a position that rests on a dispersion measure, so the
  // difference is visible in the layer and not only on a card row. Shape, not
  // colour: it has to survive being small and being colour-blind.
  const points = [];
  const steps = 12;
  for (let i = 0; i < steps; i += 1) {
    const from = (i / steps) * Math.PI * 2;
    const to = ((i + 1) / steps) * Math.PI * 2;
    points.push([size * Math.cos(from), 0, size * Math.sin(from)]);
    points.push([size * Math.cos(to), 0, size * Math.sin(to)]);
  }
  return points;
}

/** A position from a dispersion measure is an estimate, not a measured distance. */
export function isEstimatedDistance(event) {
  return Boolean(event) && event.distance_source !== 'parallax';
}

/** Flux in mJy to a glyph size, logarithmic: pulsar flux spans four decades. */
export function sparkSizeForFlux(fluxMilliJy, { minSize = 2, maxSize = 7, reference = 1000 } = {}) {
  if (fluxMilliJy === null || fluxMilliJy === undefined || fluxMilliJy <= 0) return minSize;
  const t = Math.min(Math.max(Math.log10(fluxMilliJy) / Math.log10(reference), 0), 1);
  return minSize + (maxSize - minSize) * t;
}

export function eventStyle(kind) {
  const style = EVENT_KINDS[kind];
  if (!style) throw new RangeError(`unknown event kind ${kind}`);
  return style;
}

/**
 * Build one glyph layer per event kind.
 *
 * @param {{events: object[], worldPositions: Map<object, number[]>, citation?: object}} options
 */
export function createSparkLayers({ events, worldPositions, citation }) {
  const byKind = new Map();
  for (const event of events) {
    if (citation && !event.citation) event.citation = citation;
    assertCited(event);
    if (!byKind.has(event.kind)) byKind.set(event.kind, []);
    byKind.get(event.kind).push(event);
  }

  const layers = [];
  for (const [kind, group] of byKind) {
    const style = eventStyle(kind);
    const positions = [];
    const vertexEvent = [];
    let estimated = 0;
    let measured = 0;
    group.forEach((event, eventIndex) => {
      const point = worldPositions.get(event.id);
      if (!point) return; // an event we cannot place is not drawn
      const size = sparkSizeForFlux(event.flux_mjy);
      const hollow = isEstimatedDistance(event);
      if (hollow) estimated += 1; else measured += 1;
      for (const [x, y, z] of sparkGlyphPoints({ size, hollow })) {
        positions.push(point[0] + x, point[1] + y, point[2] + z);
        // Recorded rather than inferred: unplaceable events are skipped, so a
        // vertex index is not an event index without this.
        vertexEvent.push(eventIndex);
      }
    });
    if (positions.length === 0) continue;

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    const material = new LineBasicMaterial({
      color: new Color(...style.colour),
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const lines = new LineSegments(geometry, material);
    lines.name = `sparks:${kind}`;
    lines.renderOrder = 15;
    lines.frustumCulled = false;
    lines.userData = {
      kind,
      count: group.length,
      label: style.label,
      events: group,
      vertexEvent,
      estimated,
      measured,
      citation,
    };
    layers.push(lines);
  }
  return layers;
}