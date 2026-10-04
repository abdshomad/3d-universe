/**
 * Relations: the information layer.
 *
 * A ribbon on screen is a claim about the sky, so a relation without a citation
 * is refused rather than drawn. Hue carries meaning and never decoration, and a
 * relation whose provenance is not measurement is dashed magenta.
 */

export const RELATION_TYPES = {
  constellation: { colour: [0.72, 0.74, 0.86], dashed: false, label: 'constellation figure' },
  exoplanet: { colour: [0.91, 0.77, 0.42], dashed: false, label: 'exoplanet host' },
  binary: { colour: [0.50, 0.91, 0.85], dashed: false, label: 'binary system' },
  cluster: { colour: [0.61, 0.48, 0.91], dashed: false, label: 'cluster membership' },
  event: { colour: [0.91, 0.42, 0.78], dashed: false, label: 'transient event' },
  simulated: { colour: [0.91, 0.42, 0.78], dashed: true, label: 'simulated' },
  unresolved: { colour: [0.62, 0.66, 0.80], dashed: true, label: 'unresolved' },
};

export class UncitedRelationError extends Error {}

export function relationStyle(type) {
  const style = RELATION_TYPES[type];
  if (!style) throw new RangeError(`unknown relation type ${type}`);
  return style;
}

/**
 * A relation may only be drawn if it names a source.
 * @param {object} relation
 * @returns {object} the same relation, once it has earned its place
 */
export function assertCited(relation) {
  const source = relation?.citation || relation?.source;
  if (!source || (typeof source === 'string' && source.trim() === '')) {
    throw new UncitedRelationError(
      `${relation?.id ?? 'relation'} has no citation and will not be drawn`,
    );
  }
  return relation;
}

/** Keep only the relations that can be shown. */
export function citableRelations(relations) {
  return relations.filter((relation) => {
    try {
      assertCited(relation);
      return true;
    } catch {
      return false;
    }
  });
}