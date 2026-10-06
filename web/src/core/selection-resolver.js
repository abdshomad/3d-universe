/**
 * Resolving the selection a shared link asks for.
 *
 * The URL carries one id. What it can name depends on what is loaded: a
 * landmark resolves through the search index, a modelled cell through the
 * density field, a pulsar or burst through the event catalogue, and a catalogue
 * star through the tile. Before this, only the first of those worked, and the
 * others were dropped without a word — a link that arrives looking complete
 * while missing the thing the sender was pointing at.
 *
 * So: resolve the kinds that exist, and say plainly when an id names nothing.
 */

const CELL_PREFIX = 'lss:';

/** What kind of thing is this id asking for? */
export function selectionKindOf(selectionId) {
  const id = String(selectionId ?? '');
  if (!id) return 'none';
  if (id.startsWith(CELL_PREFIX)) return 'cell';
  if (/^(pulsar|frb|gravitational_wave):/.test(id)) return 'event';
  if (/^(hip|landmark):/i.test(id)) return 'landmark';
  if (/^\d+$/.test(id)) return 'star';
  return 'unknown';
}

/**
 * @param {{selectionId: string, searchEntries?: object[], field?: object,
 *          events?: object[], starIds?: any[], originMetres?: number[]}} input
 * @returns {{kind: string, selection: object|null, requested: string}}
 */
export function resolveSelection({
  selectionId,
  searchEntries = [],
  field = null,
  events = [],
  starIds = null,
  originMetres = [0, 0, 0],
}) {
  const requested = String(selectionId ?? '');
  const kind = selectionKindOf(requested);
  if (kind === 'none') return { kind, selection: null, requested: '' };

  if (kind === 'cell') {
    const index = Number(requested.slice(CELL_PREFIX.length));
    if (!field || !Number.isInteger(index) || index < 0 || index >= field.cells.length) {
      return { kind: 'unknown', selection: null, requested };
    }
    // Same shape a click produces, so a restored cell is indistinguishable
    // from a clicked one.
    return {
      kind: 'cell',
      requested,
      selection: {
        kind: 'field',
        id: requested,
        name: 'Large-scale structure',
        radiusMpc: field.radiusMpc,
        cellMpc: field.cellMpc,
        grid: field.grid,
        seed: field.seed,
        flag: field.flag,
        provenance: `generated · ${field.flag} · ${field.scienceReference} is the science reference, not the source`,
        cell: {
          index,
          x: index % field.grid,
          y: Math.floor(index / field.grid) % field.grid,
          z: Math.floor(index / (field.grid * field.grid)),
          quantised: field.cells[index],
          floor: field.quantise?.floor ?? null,
          ceiling: field.quantise?.ceiling ?? null,
          method: field.method ?? null,
        },
      },
    };
  }

  if (kind === 'event') {
    const event = events.find((candidate) => String(candidate.id) === requested);
    if (!event) return { kind: 'unknown', selection: null, requested };
    const citation = event.citation ?? null;
    if (!citation) return { kind: 'unknown', selection: null, requested };
    return { kind: 'event', requested, selection: { ...event, id: String(event.id), citation } };
  }

  const entry = searchEntries.find((candidate) => String(candidate.id) === requested);
  if (entry) {
    // The entry says what it is: a small body resolves to its own
    // card, not to the landmark card every typed name used to get.
    const kind = entry.kind ?? 'landmark';
    return { kind, requested, selection: { ...entry, kind } };
  }

  if (starIds) {
    const index = starIds.findIndex((value) => String(value) === requested);
    if (index >= 0) {
      return { kind: 'star', requested, selection: { kind: 'star', id: requested, pointIndex: index } };
    }
  }

  return { kind: 'unknown', selection: null, requested };
}
