/**
 * Entry point: load the baked tiles, choose what to draw, and fly.
 *
 * The star geometry is rebased whenever the floating origin moves, because the
 * tiles are metres from the Sun and the GPU only ever sees coordinates near
 * zero.
 */

import { Raycaster, Vector2, Vector3 } from 'three/webgpu';
import { FrameBudgetController } from './core/frame-budget.js';
import { assertFlagged, buildSlice, toCsv } from './core/export.js';
import { attachPlanets } from './data/exoplanets.js';
import { attachDoubles } from './data/doubles.js';
import { figureCitation, figureStarPositions } from './data/figure-stars.js';
import { sampleIntegrity } from './core/integrity.js';
import { Cinematic } from './core/cinematic.js';
import { resolveSelection } from './core/selection-resolver.js';
import {
  cellIdentity,
  eventIdentity,
  identityAt,
  relationIdentity,
  isClick,
  nearestCellOnScreen,
  pickFromHits,
} from './core/picker.js';
import { LodTree } from './core/lod-tree.js';
import { createTierBudget } from './core/tier-budget.js';
import { planesFromCamera } from './core/frustum.js';
import { decodeAllPositions, readTile } from './data/tile-reader.js';
import { createStarLayer } from './render/star-layer.js';
import { AtlasScene } from './render/scene.js';
import { anglesFromDirection, directionFromAngles } from './core/view.js';
import { createNebulosity } from './render/nebulosity.js';
import { cinematicStepsFromRoute } from './routes/cinematic-path.js';
import { createScaleOutPath } from './routes/scale-out.js';
import { DEEP_FIELDS } from './data/deep-fields.js';
import { Backdrop } from './render/backdrop.js';
import { createStarDust } from './render/star-dust.js';
import {
  MPC_METRES,
  createLssLayer,
  fadeForView,
  levelForView,
  parseField,
} from './render/lss-layer.js';
import { StarIndex, buildRelationRibbons } from './render/relation-layer.js';
import { createReticle, worldWidthForPixels } from './render/reticles.js';
import { createSparkLayers } from './render/sparks.js';
import { createAdditivePoints } from './render/point-layer.js';
import { createAuLayer } from './render/au-layer.js';
import { createGalaxyLayer } from './render/galaxy-layer.js';
import { createBlackHoleMarkers, updateBlackHoleMarkers } from './render/marker-layer.js';
import { OptionalTiers } from './core/optional-tiers.js';
import { pickTiledPoints, pickMarkersAt } from './core/point-pick.js';
import { METRES_PER_PC, metresToPc } from './core/units.js';
import { Menu } from './core/menu.js';
import { menuModel } from './ui/menu.js';
import { celestialDirection } from './core/celestial.js';
import { celestialEntries, CELESTIAL_KINDS } from './core/celestial-index.js';
import { hudModel, renderHud } from './ui/hud.js';
import { FlightController, inputFromKeys } from './core/flight-controls.js';
import { journeyFromLandmarks } from './core/journey.js';
import { SearchIndex, flightPathTo } from './core/search.js';
import { epochSpan, formatYear } from './core/light-travel.js';
import { Onboarding } from './core/onboarding.js';
import { motionPolicy, prefersReducedMotion } from './core/accessibility.js';
import { decodeView, encodeView, makeView } from './core/deep-link.js';
import { captionFor } from './data/captions.js';
import { OPENING_STEPS } from './data/onboarding.js';
import { TOUR_STEPS } from './data/tour.js';
import { Tour } from './core/tour.js';
import { renderTour, highlightTourTarget } from './ui/tour.js';
const flight = new FlightController();
const keys = new Set();
let freeFlight = false;
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  // While the menu is open it owns the keyboard: only
  // `b`, which closes it, reaches the rest of the app.
  if (menu?.opened) {
    if (key === 'b') menu.toggle();
    return;
  }
  if (key === 'b' && document.activeElement?.id !== 'search') {
    menu?.toggle();
    return;
  }
  if (key === '/' && document.activeElement !== document.getElementById('search')) {
    event.preventDefault();
    document.getElementById('search')?.focus();
    return;
  }
  if (key === 'escape') {
    if (tour.active) {
      endTour();
      return;
    }
    stopCinematic('escape');
    guide.dismiss();
    document.activeElement?.blur?.();
    return;
  }
  if (key === 'c' && document.activeElement?.id !== 'search') {
    if (cinematic.active) stopCinematic('key');
    else startCinematic();
    return;
  }
  // The walk can be asked for again: T replays it.
  if (key === 't' && document.activeElement?.id !== 'search') {
    startTour();
    return;
  }
  // Any flight input is an answer. No grace period.
  if (cinematic.active) {
    stopCinematic('key');
  }
  keys.add(key);
  if (key === 'j' && activeRoute !== journeyRoute) switchRoute(journeyRoute, 'guided journey');
  if (key === 'r' && activeRoute !== route) switchRoute(route, 'scale out');
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

const TILE_DIR = '../assets/tiles';
let reticle = null;
let selection = null;
const RELATION_DIR = '../assets/relations/constellations.json';
const FIGURE_STAR_DIR = '../assets/relations/figure-stars.json';
const DOUBLE_DIR = '../assets/relations/binaries.json';
const EXOPLANET_DIR = '../assets/relations/exoplanets.json';
const EVENT_DIR = '../assets/events/pulsars.json';
const SMALL_BODY_DIR = '../assets/tiles/sbdb-small-bodies.json';
const COMETS_DIR = '../assets/tiles/sbdb-comets.json';
const PLANETS_DIR = '../assets/tiles/horizons-planets.json';
const SATELLITES_DIR = '../assets/tiles/horizons-satellites.json';
const GALAXIES_DIR = '../assets/tiles/galaxies-rc3.json';
const BLACK_HOLES_DIR = '../assets/tiles/black-holes.json';
const LANDMARK_DIR = '../assets/landmarks/landmarks.json';
const SEARCH_DIR = '../assets/search/nearby.json';
let eventPayload = null;
let sparkLayers = [];
// The solar-system tier: one AU-quantized tile plus its sidecar
// rows (names, diameters, the epoch each position is valid for),
// drawn as its own layer so a small body is never a star.
let smallBodyTile = null;
let smallBodyPayload = null;
let cometsPayload = null;
let planetsPayload = null;
let satellitesPayload = null;
let galaxiesPayload = null;
let blackHolesPayload = null;
const smallBodyRows = new Map();
let smallBodyLayers = [];
// The celestial-body tiers. Comets, planets and satellites
// share the AU primitive with small bodies; galaxies are a
// far point field; black holes are ring markers. Each layer
// answers "measured?" from its own tile's provenance, in
// O(1), and each optional tier is registered with the frame
// budget so the budget can shed it.
let cometsTile = null;
let planetsTile = null;
let satellitesTile = null;
let galaxiesTile = null;
let blackHolesTile = null;

/** The menu reads the loaded tiles — and only those.
  *  A kind with no tile is not held, and the model
  *  says so with the reason. */
function menuLoaded() {
  const datasets = [
    ['small_body', smallBodyTile],
    ['comet', cometsTile],
    ['planet', planetsTile],
    ['satellite', satellitesTile],
    ['galaxy', galaxiesTile],
    ['black_hole', blackHolesTile],
  ];
  return datasets
    .filter(([, tile]) => tile)
    .map(([kind, tile]) => ({
      kind,
      count: tile.count,
      flag: tile.header.provenance.flag,
    }));
}

/**
 * Every held kind's bodies, read back from the
 * tiles that draw them and keyed by the sidecar
 * rows a card reads. The entry's position is the
 * position the atlas draws, so a flight to a
 * menu entry lands on the body the viewer sees.
 */
function loadCelestialBodies() {
  const tiles = [
    ['small_body', smallBodyTile],
    ['comet', cometsTile],
    ['planet', planetsTile],
    ['satellite', satellitesTile],
    ['galaxy', galaxiesTile],
    ['black_hole', blackHolesTile],
  ];
  const rows = [
    ['small_body', smallBodyRows],
    ['comet', cometsRows],
    ['planet', planetsRows],
    ['satellite', satellitesRows],
    ['galaxy', galaxiesRows],
    ['black_hole', blackHolesRows],
  ];
  const bodies = new Map();
  for (let index = 0; index < tiles.length; index += 1) {
    const [kind, tile] = tiles[index];
    if (!tile) continue;
    const rowMap = rows[index][1] ?? new Map();
    bodies.set(
      kind,
      celestialEntries({ tile, rows: rowMap, kind }),
    );
  }
  return bodies;
}
const cometsRows = new Map();
const planetsRows = new Map();
const satellitesRows = new Map();
const galaxiesRows = new Map();
const blackHolesRows = new Map();

/** The celestial bodies, read back from the tiles
  * that draw them. Built once, after every tile
  * and sidecar is in hand. */
let celestialBodies = new Map();
let cometsLayers = [];
let planetsLayers = [];
let satellitesLayers = [];
let galaxiesLayers = [];
let blackHoleMarkers = [];
const optionalTiers = new OptionalTiers();
const budget = new FrameBudgetController({ maxPoints: 120000, minPoints: 3000, window: 20 });
const route = createScaleOutPath();
let journeyRoute = null;
let activeRoute = route;
let activeRouteName = 'scale out';
let routeTime = 0;

const canvas = document.getElementById('view');
document.getElementById('export')?.addEventListener('click', () => {
  try {
    downloadSlice();
  } catch (error) {
    // A refused export must say why rather than writing a file that lies.
    atlas.stats.exportError = error.message;
  }
});
const hud = document.getElementById('hud');

const atlas = new AtlasScene({ canvas, aspect: 1 });

let pointerDown = null;
canvas.addEventListener('pointerdown', (event) => {
  stopCinematic('pointer');
  pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
});
canvas.addEventListener('pointerup', (event) => {
  if (!isClick(pointerDown, { x: event.clientX, y: event.clientY, time: performance.now() })) return;
  pointerDown = null;
  const hit = pickAt(event.clientX, event.clientY);
  cardSelection = hit;
  if (hit) guide.record('selected');
  atlas.stats.picked = hit?.id ?? null;
  rebuildReticle(); // the reticle pins to the pick instead of the view centre
});

window.__atlas = atlas;
atlas.budget = budget;
atlas.flight = flight;
atlas.route = route;
let searchIndex = null;

/** Type a name or a HIP number, get a flight path. */
function attachSearchBox() {
  const box = document.getElementById('search');
  const result = document.getElementById('search-result');
  if (!box || !searchIndex) return;
  // Say what matches while it is being typed. Before this, the box stayed empty
  // until Enter, so a viewer who mistyped had no way to tell a name that matches
  // from one that does not until the flight had already started.
  const preview = () => {
    const query = box.value.trim();
    if (!query) {
      result.textContent = '';
      return null;
    }
    const match = searchIndex.best(query);
    result.textContent = match ? searchResultText(match) : `nothing found for "${query}"`;
    return match;
  };
  box.addEventListener('input', preview);

  box.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const match = searchIndex.best(box.value);
    if (!match) {
      result.textContent = `nothing found for "${box.value}"`;
      return;
    }
    flyToEntry(match, 'searched');
    result.textContent = searchResultText(match);
  });
}

/**
 * Fly to an entry: pause the guided route, aim a
 * one-leg path at it, and select it. A typed name
 * and a menu pick are the same ask, so both run
 * this — one flight path, one card, one export
 * row, however the choice arrived.
 */
function flyToEntry(match, reason) {
  const fromPc = Math.max(metresToPc(Math.hypot(...atlas.rig.positionMetres)), 1e-4);
  const path = flightPathTo(match, { fromPc });
  guide.record(reason);
  cardSelection = { ...match, kind: match.kind ?? 'landmark' };
  switchRoute(path, `flight to ${match.name ?? (match.hip != null ? `HIP ${match.hip}` : match.id)}`);
  atlas.stats.searchResult = match.id;
  return match;
}

/** The line under the search box: what matched, in its own units. */
function searchResultText(match) {
  const spec = CELESTIAL_KINDS[match.kind];
  if (spec) {
    const value = match[spec.distance];
    const shown = value != null
      ? `${Number(value.toPrecision(4))} ${spec.unit}`
      : '—';
    return `${match.name ?? match.id} · ${shown}`;
  }
  if (match.kind === 'small_body') {
    const spkid = String(match.id).split(':')[1];
    return `${match.name ?? 'small body'} · ${match.distance_au?.toFixed(3)} AU · spkid ${spkid}`;
  }
  return `${match.name ?? `HIP ${match.hip}`} · ${match.distance_pc.toFixed(3)} pc · HIP ${match.hip}`;
}

function switchRoute(next, name) {
  if (!name.startsWith('flight to')) cardSelection = null;
  activeRoute = next;
  activeRouteName = name;
  routeTime = 0;
  atlas.route = next;
  atlas.stats.route = name;
}
const backdrop = new Backdrop({
  fields: DEEP_FIELDS,
  urlFor: (field) => '../assets/imagery/' + field.file,
  scene: atlas.scene,
});
atlas.backdrop = backdrop;

let visible = [];
let tiles = [];
let tree = null;
let lastOriginEpoch = -1;

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

async function loadTile(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const tile = readTile(await response.arrayBuffer());
  tile.worldPositions = decodeAllPositions(tile, [0, 0, 0]);
  return tile;
}

async function start() {
  await atlas.init();
  atlas.resize(canvas.clientWidth, canvas.clientHeight);
  await backdrop.load();
  attachEpochScrubber();
  guide.start();
  atlas.guide = guide;
  atlas.motion = motion;
  if (!motion.autoPlayRoute) routeTime = 0;

  const manifest = await loadJson(`${TILE_DIR}/manifest.json`);
  tree = new LodTree();
  for (const entry of manifest.tiles) {
    // The manifest names each tile's dataset kind; a manifest
    // written before kinds existed infers one from its unit,
    // so an old tile loads exactly as it did.
    const kind = entry.kind
      || (entry.unit === 'au' ? 'small_body' : 'star');
    if (kind === 'star') {
      tree.addFromManifest(entry);
      tiles.push(await loadTile(`${TILE_DIR}/${entry.file}`));
      continue;
    }
    if (kind === 'small_body') {
      // The solar-system tier is not star LOD material: one
      // small tile in its own unit, always drawn in full.
      smallBodyTile = await loadTile(`${TILE_DIR}/${entry.file}`);
      continue;
    }
    // Every other kind is its own tier: not star LOD
    // material, each with its own primitive. A kind the
    // renderer has no layer for would not load -- but
    // sub-plan 03 gave each of these its layer.
    if (kind === 'comet') {
      cometsTile = await loadTile(`${TILE_DIR}/${entry.file}`);
      continue;
    }
    if (kind === 'planet') {
      planetsTile = await loadTile(`${TILE_DIR}/${entry.file}`);
      continue;
    }
    if (kind === 'satellite') {
      satellitesTile = await loadTile(`${TILE_DIR}/${entry.file}`);
      continue;
    }
    if (kind === 'galaxy') {
      galaxiesTile = await loadTile(`${TILE_DIR}/${entry.file}`);
      continue;
    }
    if (kind === 'black_hole') {
      blackHolesTile = await loadTile(`${TILE_DIR}/${entry.file}`);
      continue;
    }
  }
  const landmarkPayload = await loadJson(LANDMARK_DIR).catch(() => null);
  if (landmarkPayload?.landmarks?.length) {
    journeyRoute = journeyFromLandmarks(landmarkPayload.landmarks);
    atlas.journey = journeyRoute;
  }
  const searchPayload = await loadJson(SEARCH_DIR).catch(() => null);
  if (searchPayload?.entries?.length) {
    searchIndex = new SearchIndex(searchPayload.entries);
    atlas.search = searchIndex;
    attachSearchBox();
  }
  await loadLssField();
  buildPath();
  relationPayload = await loadJson(RELATION_DIR).catch(() => null);
  const figurePayload = await loadJson(FIGURE_STAR_DIR).catch(() => null);
  if (figurePayload) {
    // Figure endpoints resolve against measured Hipparcos rows, not against
    // whatever star in the neighbourhood tile happens to be nearby.
    figureStarIndex = new StarIndex(
      figureStarPositions(figurePayload),
      figurePayload.stars.map((star) => `HIP ${star.hip}`),
    );
    figureStarPayload = figurePayload;
  }
  eventPayload = await loadJson(EVENT_DIR).catch(() => null);
  smallBodyPayload = await loadJson(SMALL_BODY_DIR).catch(() => null);
  if (smallBodyPayload?.bodies?.length) {
    for (const body of smallBodyPayload.bodies) {
      smallBodyRows.set(String(body.spkid), body);
    }
  }
  // The celestial-body sidecars: the rows a card reads,
  // keyed by the id the tile's id array holds.
  cometsPayload = await loadJson(COMETS_DIR).catch(() => null);
  if (cometsPayload?.bodies?.length) {
    for (const body of cometsPayload.bodies) cometsRows.set(String(body.spkid), body);
  }
  planetsPayload = await loadJson(PLANETS_DIR).catch(() => null);
  if (planetsPayload?.bodies?.length) {
    for (const body of planetsPayload.bodies) planetsRows.set(String(body.code), body);
  }
  satellitesPayload = await loadJson(SATELLITES_DIR).catch(() => null);
  if (satellitesPayload?.bodies?.length) {
    for (const body of satellitesPayload.bodies) satellitesRows.set(String(body.code), body);
  }
  galaxiesPayload = await loadJson(GALAXIES_DIR).catch(() => null);
  if (galaxiesPayload?.galaxies?.length) {
    for (const galaxy of galaxiesPayload.galaxies) galaxiesRows.set(String(galaxy.pgc), galaxy);
  }
  blackHolesPayload = await loadJson(BLACK_HOLES_DIR).catch(() => null);
  if (blackHolesPayload?.black_holes?.length) {
    for (const hole of blackHolesPayload.black_holes) blackHolesRows.set(String(hole.recno), hole);
  }

  // The celestial bodies join the one search index:
  // a menu pick and a typed name are the same ask, so
  // both answer from the same entries — and the entries
  // are read back from the tiles that draw them, so a
  // flight lands on the body the atlas actually shows.
  celestialBodies = loadCelestialBodies();
  searchIndex?.merge([...celestialBodies.values()].flat());

  const biggest = tiles.reduce((a, b) => (b.count > a.count ? b : a));
  starIndex = new StarIndex(biggest.worldPositions);
  starIndex.tile = biggest;

  const doublePayload = await loadJson(DOUBLE_DIR).catch(() => null);
  if (doublePayload) {
    doubleReport = attachDoubles(doublePayload);
    atlas.stats.doubles = doubleReport.pairs;
    atlas.stats.doublesMedianSep = doubleReport.medianSeparationArcsec;
    atlas.stats.doublesOnStars = doubleReport.byStar.size;
    atlas.stats.doublesUnattached = doubleReport.unresolved;
  }

  exoplanetPayload = await loadJson(EXOPLANET_DIR).catch(() => null);
  if (exoplanetPayload) {
    exoplanetReport = attachPlanets(exoplanetPayload, starIndex);
    atlas.stats.planets = exoplanetReport.planetsAttached;
    atlas.stats.planetSystems = exoplanetReport.matched;
    atlas.stats.planetSystemsUnmatched = exoplanetReport.unmatched;
  }

  atlas.rig.positionMetres = route.sample(0).positionMetres;
  applySharedView(sharedView);
  redraw();
  // The menu is a projection of the loaded state,
  // built once the boot has every tile in hand.
  menu.setModel(menuModel({
    loaded: menuLoaded(),
    bodies: celestialBodies,
  }));

  let previous = performance.now();
  const loop = (now) => {
    // requestAnimationFrame timestamps the start of a frame, which can predate a
    // performance.now() taken just before it, so the first delta can be negative.
    // The step is clamped so a long stall cannot teleport the camera; the
    // unclamped value is what the performance harness records.
    const measured = Math.max(0, (now - previous) / 1000);
    frameBudget.sample(measured * 1000); // unclamped: this is the real cost
    const delta = Math.min(measured, 0.1);
    previous = now;
    // Free flight takes over the moment a key is held: the route pauses and the
    // speed law applies unchanged from 1 AU to 100 kpc.
    flight.input(inputFromKeys(keys));
    if (flight.engaged) {
      if (!freeFlight) guide.record('flew');
      freeFlight = true;
      cardSelection = null;
    }

    if (cinematic.active) {
      // Wall-clock, not the clamped step: the clamp exists so a stall cannot
      // teleport the camera, but a presentation that runs in slow motion on a
      // slow machine is worse than one that keeps its timing.
      const step = cinematic.update(measured) ?? cinematic.current;
      if (step) {
        const previous = cinematic.steps[Math.max(0, cinematic.index - 1)] ?? step;
        const phase = cinematic.holding ? 1 : cinematic.stepPhase;
        atlas.rig.positionMetres = [0, 1, 2].map((axis) => previous.positionMetres[axis]
          + (step.positionMetres[axis] - previous.positionMetres[axis]) * phase);
        atlas.rig.lookAtAngles(step.yaw, step.pitch);
        atlas.stats.waypoint = `cinematic · ${step.id}`;
        renderCaption();
      }
    } else if (freeFlight) {
      atlas.rig.resetDrift();
      atlas.rig.positionMetres = flight.step(delta, atlas.rig.positionMetres);
      hideCaption();
      if (motion.drift) atlas.rig.lookAtAngles(atlas.rig.baseYaw, atlas.rig.basePitch);
      atlas.stats.waypoint = 'free flight';
    } else {
      routeTime += motion.autoPlayRoute ? delta : 0;
      atlas.stats.routeSeconds = routeTime;
      const shot = activeRoute.sample(routeTime);
      atlas.rig.positionMetres = shot.positionMetres;
      // The route says where to face: a deep field, or outward along the route.
      const look = anglesFromDirection(shot.lookDirection);
      atlas.rig.lookAtAngles(look.yaw, look.pitch);
      atlas.stats.waypoint = shot.name;
      renderRouteCaption(shot.name);
    atlas.stats.route = activeRouteName;
    }
    if (atlas.origin.recentredAt !== lastOriginEpoch) redraw();
    refreshViewRange();
    dropStaleSelection();
    atlas.frame(delta, measured);
    atlas.measure(now);
    if (budget.sample(delta).changed) redraw();
    updateLssVisibility();
    // Optional tiers defer with the same verdict the modelled
    // field reads: an optional tier must never be the reason
    // a frame is late.
    optionalTiers.applyBudget(frameBudget.deferred);
    // Markers are annotations: they face the camera and hold
    // their angular size at any distance.
    updateBlackHoleMarkers(blackHoleMarkers, atlas.camera, {
      fovDegrees: atlas.camera.fov,
      viewportHeight: canvas.clientHeight || 800,
    });
    updateHud();
    epochReadout();
    hintReadout();
    shareView(now);
    requestAnimationFrame(loop);
  };
  attachTourButtons();
  offerTour();
  requestAnimationFrame(loop);
}

/** What the renderer draws right now, in the shape the export and
 *  the integrity check both need: the drawn set is a selection,
 *  never a count. */
function drawnSelection() {
  return visible.map((chosen) => ({
    tileId: chosen.id,
    stride: chosen.stride,
    drawCount: chosen.drawCount,
  }));
}

/**
 * Export what is on screen. The gate runs before anything is written: a row that
 * cannot say whether it was measured or modelled does not reach the file.
 */
function downloadSlice() {
  const slice = buildSlice({
    picked: cardSelection,
    tiles,
    drawn: drawnSelection(),
    starIndex,
    exoplanetReport,
    originMetres: atlas.origin.originMetres,
    field: atlas.stats.lssVisible ? lssField : null,
    level: lssLevel,
    // Whatever the renderer decided to draw is what the file must contain.
    threshold: lssLevels.find((layer) => layer.visible)?.userData.threshold ?? 0,
  });
  const rows = slice.rows;
  assertFlagged(rows);

  const csv = toCsv(slice.columns, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `atlas-slice-${Math.round(atlas.stats.points)}p.csv`;
  link.click();
  URL.revokeObjectURL(url); // the click has taken its own reference by now
  atlas.stats.exported = rows.length;
  return rows.length;
}

/**
 * Does every light we are about to draw still name a catalogue row? Recomputed
 * whenever the drawn set changes, and published so a failure is visible rather
 * than silent.
 */
function checkIntegrity() {
  const report = sampleIntegrity({
    tiles,
    drawn: drawnSelection(),
    originMetres: atlas.origin.originMetres,
  });
  atlas.stats.integrity = report;
  return report;
}

/** Choose what to draw and rebuild the layers for the current origin. */
function redraw() {
  const previousEpoch = lastOriginEpoch;
  lastOriginEpoch = atlas.origin.recentredAt;
  const scale = Math.hypot(...atlas.rig.positionMetres);
  if (backdrop.needsRebuild(scale)) {
    backdrop.rebuild({ frameScaleMetres: scale, originMetres: atlas.origin.originMetres });
  }
  const position = atlas.rig.positionMetres;
  const direction = directionFromRig(atlas.rig);
  visible = tree.select({
    planes: planesFromCamera({ direction }),
    position,
    direction,
    budgetPoints: budget.budgetPoints,
  }).visible;

  atlas.clearPoints();
  let drawn = 0;
  for (const chosen of visible) {
    const tile = tiles.find((candidate) => candidate.header.tile_id === chosen.id);
    if (!tile) continue;
    atlas.addPoints(createStarLayer(tile, {
      cameraMetres: atlas.origin.originMetres,
      stride: chosen.stride,
      drawCount: chosen.drawCount,
      worldPositions: tile.worldPositions,
    }));
    drawn += chosen.drawCount;
  }
  // The medium depends on position and scale, never on the frame budget: under
  // load the budget ticks several times a second, and re-quantizing 70k noise
  // points for every tick was pure waste.
  if (previousEpoch !== lastOriginEpoch || mediumScale === 0
      || scale > mediumScale * 2 || scale < mediumScale / 2) {
    rebuildMediums(scale);
    mediumScale = scale;
  }
  atlas.stats.drawCount = drawn;
  checkIntegrity();
}

let nebulosity = null;
let dustLayers = [];
let mediumScale = 0;
let relationPayload = null;
const captionEl = document.getElementById('caption');
let captionShown = null;
let figureStarIndex = null;
let figureStarPayload = null;
let doubleReport = null;
/**
 * The cinematic path, read off the route we already fly: each waypoint as it is
 * first reached, with a hold so the eye can catch up with the scale.
 */
function buildCinematicSteps() {
  return cinematicStepsFromRoute(route, { toAngles: anglesFromDirection });
}

/**
 * The tour ends where the atlas stops: at the modelled tier, so the last thing
 * a viewer is told is that the sky beyond the measured one is a model.
 */
function appendModelledStep(steps) {
  if (!lssField) return steps;
  const metres = lssField.radiusMpc * MPC_METRES * 0.4;
  return [...steps, {
    id: 'large-scale-structure',
    kind: 'field',
    radiusMpc: lssField.radiusMpc,
    travel: 8,
    hold: 6,
    positionMetres: [metres, 0, 0],
    yaw: Math.PI / 2,
    pitch: 0,
  }];
}


/** Show a caption, or nothing. One writer, so two callers cannot disagree. */
function showCaption(caption) {
  if (!caption) return hideCaption();
  if (captionShown === caption.text) return;
  captionShown = caption.text;
  captionEl.textContent = `${caption.text} — ${caption.source}`;
  captionEl.hidden = false;
}

/** The caption belongs to the hold; it leaves the moment the sky is taken back. */
function renderCaption() {
  showCaption(captionFor(cinematic.active ? cinematic.current : null));
}

/**
 * The same captions on the guided routes, from the same copy: a journey is a
 * fly-through with holds, and a hold with nothing said is the emptiest part of
 * it. `captionFor` is the only source of these sentences.
 */
function renderRouteCaption(name) {
  if (cinematic.active) return;
  const waypoint = activeRoute?.waypoints?.find((candidate) => candidate.name === name);
  showCaption(captionFor(waypoint ? { radiusPc: waypoint.radiusPc, name: waypoint.name } : null));
}

function hideCaption() {
  captionShown = null;
  captionEl.hidden = true;
}

/** Reduced motion means this is never offered, not merely discouraged. */
function startCinematic() {
  // Checked live, not only at load: the preference can change mid-session, and
  // this mode moves the camera on its own.
  if (motion.reduced || prefersReducedMotion() || cinematic.steps.length === 0) return false;
  cinematic.start();
  guide.record('cinematic');
  document.body.classList.add('cinematic');
  renderCaption();
  freeFlight = false;
  return true;
}

function stopCinematic(action = 'dismissed') {
  if (!cinematic.dismiss(action)) return false;
  document.body.classList.remove('cinematic');
  hideCaption();
  return true;
}

let exoplanetReport = null;
let exoplanetPayload = null;
let starIndex = null;
let ribbons = [];

/** The medium between the catalogue stars: noise-driven dust plus a far/near
 *  unresolved shell. Rebuilt with the star layers because they all share one
 *  render space; the seeds keep the sky identical on every machine. */
function rebuildMediums(scale) {
  if (nebulosity) {
    atlas.scene.remove(nebulosity);
    nebulosity.geometry.dispose();
    nebulosity.material.dispose();
  }
  for (const layer of dustLayers) {
    atlas.scene.remove(layer);
    layer.geometry.dispose();
    layer.material.dispose();
  }
  nebulosity = createNebulosity({
    radiusMetres: Math.max(scale * 0.6, 1e3),
    count: 24000,
    cameraMetres: atlas.origin.originMetres,
  });
  dustLayers = createStarDust({
    innerRadiusMetres: Math.max(scale * 0.15, 1e2),
    outerRadiusMetres: Math.max(scale * 1.2, 1e4),
    count: 45000,
    cameraMetres: atlas.origin.originMetres,
  });
  atlas.scene.add(nebulosity, ...dustLayers);
  atlas.stats.nebulaPoints = nebulosity.userData.pointCount;
  atlas.stats.dustPoints = dustLayers.reduce(
    (total, layer) => total + layer.userData.pointCount, 0,
  );
  rebuildRibbons(scale);
  rebuildReticle();
  rebuildSparks(scale);
  rebuildSmallBodies();
  rebuildComets();
  rebuildPlanets();
  rebuildSatellites();
  rebuildGalaxies();
  rebuildBlackHoles();
}

/** Event markers. An event is only placed when the catalogue gives a distance:
 *  a sky position with no distance is a direction, not a place. */
function rebuildSparks() {
  for (const layer of sparkLayers) {
    atlas.scene.remove(layer);
    layer.geometry.dispose();
    layer.material.dispose();
  }
  sparkLayers = [];
  if (!eventPayload) return;

  const origin = atlas.origin.originMetres;
  const worldPositions = new Map();
  for (const event of eventPayload.events) {
    const distance = event.distance_kpc ? event.distance_kpc * 1000 * METRES_PER_PC : null;
    if (!distance) continue;
    const direction = celestialDirection(event.ra_deg, event.dec_deg);
    worldPositions.set(event.id, [
      direction[0] * distance - origin[0],
      direction[1] * distance - origin[1],
      direction[2] * distance - origin[2],
    ]);
  }

  sparkLayers = createSparkLayers({
    events: eventPayload.events,
    worldPositions,
    citation: eventPayload.citation,
  });
  for (const layer of sparkLayers) atlas.scene.add(layer);
  atlas.stats.events = sparkLayers.reduce((total, layer) => total + layer.userData.count, 0);
  // 559 of 598 of these rest on a dispersion measure. The layer says so with a
  // hollow glyph rather than a card row nobody opens.
  atlas.stats.eventsEstimated = sparkLayers.reduce((total, layer) => total + (layer.userData.estimated ?? 0), 0);
  atlas.stats.eventsMeasured = sparkLayers.reduce((total, layer) => total + (layer.userData.measured ?? 0), 0);
  // 15 of the 598 have no distance at all and are never drawn. Saying so keeps
  // the arithmetic closed: catalogued = drawn + unplaced.
  atlas.stats.eventsDrawn = atlas.stats.eventsMeasured + atlas.stats.eventsEstimated;
  atlas.stats.eventsUnplaced = atlas.stats.events - atlas.stats.eventsDrawn;
  atlas.stats.eventPlaced = worldPositions.size;
}

/**
 * The solar-system tier. Small bodies are points, not stars:
 * they shine by reflected sunlight, so their colour says
 * nothing about a temperature and the layer is one flat
 * amber rather than a blackbody ramp. The measured word
 * rides on the layer's provenance, the way every other
 * measured tier carries it.
 */
function rebuildSmallBodies() {
  disposeLayers(smallBodyLayers);
  smallBodyLayers = auTierLayers(smallBodyTile, 'small_body');
  for (const layer of smallBodyLayers) atlas.scene.add(layer);
  if (smallBodyTile) atlas.stats.smallBodies = smallBodyTile.count;
}

/** Comets: the same AU primitive, their own kind and colour. */
function rebuildComets() {
  disposeLayers(cometsLayers);
  cometsLayers = auTierLayers(cometsTile, 'comet');
  for (const layer of cometsLayers) atlas.scene.add(layer);
  if (cometsTile) atlas.stats.comets = cometsTile.count;
}

function rebuildPlanets() {
  disposeLayers(planetsLayers);
  planetsLayers = auTierLayers(planetsTile, 'planet');
  for (const layer of planetsLayers) atlas.scene.add(layer);
  if (planetsTile) atlas.stats.majorPlanets = planetsTile.count;
}

function rebuildSatellites() {
  disposeLayers(satellitesLayers);
  satellitesLayers = auTierLayers(satellitesTile, 'satellite');
  for (const layer of satellitesLayers) atlas.scene.add(layer);
  if (satellitesTile) atlas.stats.satellites = satellitesTile.count;
}

/** One AU-tier layer, decoded at the current origin. */
function auTierLayers(tile, kind) {
  if (!tile) return [];
  return [createAuLayer({
    positions: decodeAllPositions(tile, atlas.origin.originMetres),
    tile,
    kind,
  })];
}
/** Remove a layer and its GPU resources. */
function disposeLayers(layers) {
  for (const layer of layers) {
    atlas.scene.remove(layer);
    layer.geometry.dispose();
    layer.material.dispose();
  }
}

/**
 * The galaxy field: one point per catalogue row, far beyond
 * the solar system. An optional tier — the frame budget can
 * shed it — so it is registered with the budget, and
 * re-registered on every rebuild.
 */
function rebuildGalaxies() {
  for (const layer of galaxiesLayers) optionalTiers.unregister(layer);
  disposeLayers(galaxiesLayers);
  galaxiesLayers = galaxiesTile ? [createGalaxyLayer({
    positions: decodeAllPositions(galaxiesTile, atlas.origin.originMetres),
    tile: galaxiesTile,
  })] : [];
  for (const layer of galaxiesLayers) {
    optionalTiers.register(layer);
    atlas.scene.add(layer);
  }
  if (galaxiesTile) atlas.stats.galaxies = galaxiesTile.count;
}

/**
 * Black-hole markers: rings, not points. A black hole is not
 * a light source, and the ring says so. Optional, like the
 * galaxy field, and rebuilt with the medium because the
 * origin moves.
 */
function rebuildBlackHoles() {
  for (const marker of blackHoleMarkers) {
    optionalTiers.unregister(marker);
    atlas.scene.remove(marker);
    marker.geometry.dispose();
    marker.material.dispose();
  }
  blackHoleMarkers = blackHolesTile ? createBlackHoleMarkers({
    tile: blackHolesTile,
    positions: decodeAllPositions(blackHolesTile, atlas.origin.originMetres),
    rows: blackHolesRows,
    citation: blackHolesTile.header.provenance,
  }) : [];
  for (const marker of blackHoleMarkers) {
    optionalTiers.register(marker);
    atlas.scene.add(marker);
  }
  atlas.stats.blackHoles = blackHoleMarkers.length;
}

/**
 * Small bodies are picked in screen space, like the modelled
 * cells: they are points a few pixels wide, and a depth-scaled
 * raycast threshold would make them unclickable at 3 AU.
 * The same path picks every tiled tier, so a click, a search
 * and a deep link all resolve through one function.
 */
function pickSmallBodyAt(ndc) {
  if (smallBodyLayers.length === 0 || !smallBodyTile) return null;
  const rect = canvas.getBoundingClientRect();
  return pickTiledPoints(ndc, {
    layer: smallBodyLayers[0],
    tile: smallBodyTile,
    rows: smallBodyRows,
    camera: atlas.camera,
    originMetres: atlas.origin.originMetres,
    width: rect.width,
    height: rect.height,
  });
}

/**
 * A click names whatever is under it; a drag steers. The raycast threshold is
 * what a few pixels are worth at the depth of the object under the reticle, so
 * the pick is not easier at one scale than another.
 */
function pickAt(clientX, clientY) {
  if (!starIndex?.tile) return null;
  const rect = canvas.getBoundingClientRect();
  const ndc = new Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, atlas.camera);

  const reference = selectNearestToView(directionFromRig(atlas.rig));
  const depthPc = reference ? reference.world.length() / METRES_PER_PC : 1;
  const perPixel = worldWidthForPixels(depthPc * METRES_PER_PC, 1, atlas.camera.fov, rect.height);
  raycaster.params.Points.threshold = perPixel * 4;

  // Sparks are drawn on top of the stars, so they are picked on top of them:
  // a click must name what the viewer can actually see.
  const event = pickEventAt(ndc);
  if (event) return event;

  const relation = pickRelationAt(ndc);
  if (relation) return relation;

  // Ring markers are annotations drawn on top of everything,
  // so they pick before the content behind them.
  const blackHole = pickMarkersAt(ndc, {
    markers: blackHoleMarkers,
    tile: blackHolesTile,
    camera: atlas.camera,
    originMetres: atlas.origin.originMetres,
    width: rect.width,
    height: rect.height,
  });
  if (blackHole) return blackHole;

  const smallBody = pickSmallBodyAt(ndc);
  if (smallBody) return smallBody;

  // The remaining tiled tiers, in kind order: a comet is
  // not a planet, and a click must say which.
  const comet = pickTiledPoints(ndc, {
    layer: cometsLayers[0],
    tile: cometsTile,
    rows: cometsRows,
    camera: atlas.camera,
    originMetres: atlas.origin.originMetres,
    width: rect.width,
    height: rect.height,
  });
  if (comet) return comet;

  const planet = pickTiledPoints(ndc, {
    layer: planetsLayers[0],
    tile: planetsTile,
    rows: planetsRows,
    camera: atlas.camera,
    originMetres: atlas.origin.originMetres,
    width: rect.width,
    height: rect.height,
  });
  if (planet) return planet;

  const satellite = pickTiledPoints(ndc, {
    layer: satellitesLayers[0],
    tile: satellitesTile,
    rows: satellitesRows,
    camera: atlas.camera,
    originMetres: atlas.origin.originMetres,
    width: rect.width,
    height: rect.height,
  });
  if (satellite) return satellite;

  const galaxy = pickTiledPoints(ndc, {
    layer: galaxiesLayers[0],
    tile: galaxiesTile,
    rows: galaxiesRows,
    camera: atlas.camera,
    originMetres: atlas.origin.originMetres,
    width: rect.width,
    height: rect.height,
  });
  if (galaxy) return galaxy;

  const hits = raycaster.intersectObjects(atlas.layers, false).map((hit) => ({
    tileId: hit.object.userData?.tileId ?? null,
    index: hit.index,
    distance: hit.distance,
  }));
  const best = pickFromHits(hits, { tileId: starIndex.tile.header.tile_id });
  if (best) {
    const identity = identityAt({
      tile: starIndex.tile,
      index: best.index,
      originMetres: atlas.origin.originMetres,
    });
    if (identity) return { ...identity, world: starIndex.positions[best.index] };
  }
  return pickCellAt(ndc);
}

/**
 * Sparks are drawn with depth testing off and a high render order, so they sit
 * on top of the stars behind them. Picking in the same order keeps a click from
 * naming a star that is not what the viewer can see.
 */
function pickEventAt(ndc) {
  if (sparkLayers.length === 0) return null;
  const rect = canvas.getBoundingClientRect();
  for (const layer of sparkLayers) {
    const positions = layer.geometry.attributes.position.array;
    const count = positions.length / 3;
    const projected = new Float64Array(count * 3);
    const vertex = new Vector3();
    for (let i = 0; i < count; i += 1) {
      vertex.set(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2])
        .project(atlas.camera);
      projected[3 * i] = vertex.x;
      projected[3 * i + 1] = vertex.y;
      projected[3 * i + 2] = vertex.z;
    }
    const hit = nearestCellOnScreen(projected, ndc, { width: rect.width, height: rect.height });
    if (!hit) continue;
    const eventIndex = layer.userData.vertexEvent?.[hit.index];
    const event = layer.userData.events?.[eventIndex];
    return eventIdentity({ event, citation: layer.userData.citation });
  }
  return null;
}

/**
 * Ribbons are thin meshes — a line a few pixels wide — so they are picked in
 * screen space like the modelled cells, by projecting the curve and taking the
 * nearest within a few pixels of the click.
 */
function pickRelationAt(ndc) {
  if (!ribbons || ribbons.length === 0) return null;
  const rect = canvas.getBoundingClientRect();
  const vertex = new Vector3();
  for (const mesh of ribbons) {
    if (!mesh.visible) continue;
    const positions = mesh.geometry.attributes.position.array;
    const count = positions.length / 3;
    const projected = new Float64Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      vertex.set(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]).project(atlas.camera);
      projected[3 * i] = vertex.x;
      projected[3 * i + 1] = vertex.y;
      projected[3 * i + 2] = vertex.z;
    }
    const hit = nearestCellOnScreen(projected, ndc, { width: rect.width, height: rect.height, maxPixels: 14 });
    if (hit) return relationIdentity({ mesh });
  }
  return null;
}

/**
 * The modelled tier is pickable too, so a click on structure says what it hit.
 * The layer's geometry is compacted, so a vertex index is mapped back through
 * the cell list it was built from.
 */
function pickCellAt(ndc) {
  const visible = lssLevels.find((layer) => layer.visible);
  if (!visible || !lssField) return null;

  const rect = canvas.getBoundingClientRect();
  const positions = visible.geometry.attributes.position.array;
  const count = visible.userData.cellIndices.length;
  const projected = new Float64Array(count * 3);
  const vertex = new Vector3();
  for (let i = 0; i < count; i += 1) {
    vertex.set(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2])
      .project(atlas.camera);
    projected[3 * i] = vertex.x;
    projected[3 * i + 1] = vertex.y;
    projected[3 * i + 2] = vertex.z;
  }

  const hit = nearestCellOnScreen(projected, ndc, {
    width: rect.width,
    height: rect.height,
  });
  if (!hit) return null;
  // The tier's own size, so the card still says how much of it is drawn.
  return {
    ...cellIdentity({ field: lssField, cellIndex: visible.userData.cellIndices[hit.index] }),
    pointCount: visible.userData.pointCount,
  };
}

/**
 * When the LOD drops the star set, any star selection goes with it. A card
 * that keeps naming a star which is no longer drawn is the one lie this
 * project exists to avoid.
 */
function dropStaleSelection() {
  if (atlas.stats.points > 0) return;
  // Only star selections go stale when the star set is
  // dropped. Every other kind's tier is always drawn in
  // full -- a small body, a comet, a planet, a satellite,
  // a galaxy, a black-hole marker -- so its selection
  // cannot go stale with the stars, and a picked cell in
  // the modelled tier is still drawn; clearing any of
  // those would mean the tier could never be interrogated
  // from a viewpoint with no stars in it.
  const isStarSelection = (candidate) => candidate?.kind === 'star';
  if (!isStarSelection(cardSelection) && selection === null) return;
  if (isStarSelection(cardSelection)) cardSelection = null;
  selection = null;
  if (reticle) {
    atlas.scene.remove(reticle);
    reticle.geometry.dispose();
    reticle.material.dispose();
    reticle = null;
  }
  atlas.stats.selection = null;
}

/** Nearest measured star to the view centre: the object the reticle locks onto. */
function selectNearestToView(direction, maxAngleDeg = 6) {
  if (!starIndex) return null;
  const limit = Math.cos((maxAngleDeg * Math.PI) / 180);
  let best = -Infinity;
  let bestIndex = -1;
  for (let i = 0; i < starIndex.size; i += 1) {
    const dot = starIndex.directions[3 * i] * direction[0]
      + starIndex.directions[3 * i + 1] * direction[1]
      + starIndex.directions[3 * i + 2] * direction[2];
    if (dot > best) {
      best = dot;
      bestIndex = i;
    }
  }
  if (bestIndex < 0 || best < limit) return null;
  const id = starIndex.tile?.ids?.[bestIndex];
  return {
    world: starIndex.positions[bestIndex],
    id: id === undefined ? null : id.toString(),
    pointIndex: bestIndex,
  };
}

/** The annotation around the selected object, sized in screen space. */
function rebuildReticle() {
  if (reticle) {
    atlas.scene.remove(reticle);
    reticle.geometry.dispose();
    reticle.material.dispose();
    reticle = null;
  }
  const direction = directionFromRig(atlas.rig);
  // A clicked selection is pinned: the reticle stays on it instead of sliding
  // to whatever is at the centre of the screen.
  selection = cardSelection?.world ? cardSelection : selectNearestToView(direction);
  if (selection) guide.record('selected');
  atlas.stats.selection = selection?.id ?? null;
  if (!selection) return;

  const render = [
    selection.world.x - atlas.origin.originMetres[0],
    selection.world.y - atlas.origin.originMetres[1],
    selection.world.z - atlas.origin.originMetres[2],
  ];
  const distance = Math.hypot(...render);
  const radius = worldWidthForPixels(distance, 26, atlas.camera.fov, canvas.clientHeight || 800);
  reticle = createReticle({
    position: render,
    distance,
    radius,
    tickCount: 16,
    crosshairSize: radius * 1.25,
    uncertainty: { semiMajor: radius * 0.42, semiMinor: radius * 0.16, rotationDeg: 24, segments: 32 },
    label: selection.name ?? selection.id ?? 'nearest star',
  });
  atlas.scene.add(reticle);
}

/** Ribbons between measured stars. Rebuilt with the medium because the
 *  vertices live in render space; the star index itself never moves. */
/** The modelled large-scale tier: parsed, flagged, and added to the scene. */
async function loadLssField() {
  try {
    const [header, cube] = await Promise.all([
      loadJson(`${TILE_DIR}/lss-field.json`),
      fetch(`${TILE_DIR}/lss-field.bin`).then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.arrayBuffer();
      }),
    ]);
    const field = parseField(header, cube);
    lssField = field;
    lssLevels = [1, 2].map((stride) => {
      const layer = createLssLayer(field, {
        stride,
        originMetres: atlas.origin.originMetres,
      });
      layer.visible = false;
      atlas.scene.add(layer);
      return layer;
    });
    atlas.lss = { field, levels: lssLevels };
    return lssLevels;
  } catch (error) {
    window.__atlasFieldError = error.message;
    return null;
  }
}

/**
 * Coarse-first, refining only when a cell is big enough on screen to earn the
 * detail, and fading in across the seam so crossing it cannot pop.
 */
function updateLssVisibility() {
  if (!lssField || lssLevels.length === 0) return;
  const radius = Math.hypot(...atlas.rig.positionMetres);
  const fade = fadeForView(radius, { fadeEndMpc: LSS_FADE_END_MPC });
  const level = levelForView(lssField, Math.max(radius, 1));

  const affordable = !frameBudget.deferred;
  for (const [index, layer] of lssLevels.entries()) {
    const stride = index + 1;
    layer.visible = fade > 0 && affordable && stride === level;
    layer.material.opacity = fade;
  }
  lssLevel = level;
  atlas.stats.lssDeferred = !affordable;
  atlas.stats.lssVisible = fade > 0 && affordable;
  atlas.stats.lssLevel = level;
  atlas.stats.lssFade = Number(fade.toFixed(3));
}

function rebuildRibbons(scale) {
  for (const mesh of ribbons) {
    atlas.scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  ribbons = [];
  if (!relationPayload || !starIndex) return;
  const { meshes, report } = buildRelationRibbons({
    relations: relationPayload.relations,
    citation: figureCitation(figureStarPayload) ?? relationPayload.citation,
    index: figureStarIndex ?? starIndex,
    widthMetres: scale * 0.004,
    originMetres: atlas.origin.originMetres,
    maxRibbons: 400,
  });
  for (const mesh of meshes) atlas.scene.add(mesh);
  ribbons = meshes;
  atlas.stats.relations = report;
}

/** Keep the depth range wrapped around what is actually on screen. */
function refreshViewRange() {
  const position = atlas.rig.positionMetres;
  let min = Infinity;
  let max = 0;
  for (const chosen of visible) {
    const distance = chosen.box.distanceToPoint(position);
    min = Math.min(min, distance);
    max = Math.max(max, distance + chosen.box.boundingRadius());
  }
  // The backdrop planes sit far beyond the star tiles; a far plane computed from
  // the stars alone clips the entire deep field away.
  for (const group of backdrop.groups) {
    for (const plane of group.userData.planes) {
      const distance = plane.position.length();
      min = Math.min(min, Math.max(distance - planeScale(plane), 0));
      max = Math.max(max, distance + planeScale(plane));
    }
  }
  if (Number.isFinite(min)) atlas.setViewRange(min, Math.max(max, min * 10));
}

function planeScale(plane) {
  return plane.scale.x;
}

function directionFromRig(rig) {
  // The same convention the camera uses, so the culling frustum matches what is
  // actually on screen.
  return directionFromAngles(rig.yaw, rig.pitch);
}

let lastHudPaint = 0;

/** What is on screen, in the words the art direction uses. */
function updateHud(now = performance.now()) {
  if (now - lastHudPaint < 200) return;
  lastHudPaint = now;
  if (!hud) return;
  renderHud(hud, hudModel({
    stats: atlas.stats,
    selection: hudSelection(),
    flags: hudFlags(),
    sources: hudSources(),
    observerYear,
    minPc: hudRangePc()[0],
    maxPc: hudRangePc()[1],
  }));
}

let cardSelection = null;
// An optional tier must never be the reason a frame is late.
const frameBudget = createTierBudget({ budgetMs: 20 });
atlas.frameBudget = frameBudget;
let lssField = null;

/**
 * Built once the modelled tier has loaded, because the tour ends there and the
 * tier does not exist at module scope. Until then the app behaves as if there
 * is no cinematic, which is the same as there being nothing to interrupt.
 */
const IDLE_CINEMATIC = Object.freeze({
  active: false, current: null, steps: [], start: () => false,
  dismiss: () => false, record: () => false, update: () => null,
});
let cinematic = IDLE_CINEMATIC;

function buildPath() {
  cinematic = new Cinematic(appendModelledStep(buildCinematicSteps()));
}
let lssLevels = [];
let lssLevel = 2;
const LSS_FADE_END_MPC = 8;
let observerYear = new Date().getFullYear();
const guide = new Onboarding(OPENING_STEPS, { now: () => performance.now() / 1000 });
const tour = new Tour(TOUR_STEPS);
const TOUR_SEEN_KEY = 'u3-tour-seen';
// Someone who asks for reduced motion gets a still sky: no self-flying, no drift.
const motion = motionPolicy({ reduced: prefersReducedMotion() });
// The menu is a view over the loaded datasets. What a
// picked entry does — where it flies — belongs to the
// flight wiring, so the pick only closes the panel for
// now and hands the entry over.
const menu = new Menu({
  root: document,
  motion,
  onPick: (entry) => {
    // A menu pick is a search with the entry
    // pre-chosen: the same flight, the same
    // card, the same export row.
    flyToEntry(entry, 'picked');
    menu.close();
  },
});
const sharedView = decodeView(globalThis.location?.hash ?? '');
let lastSharedHash = '';

/** Restore a view someone shared: where, facing what, when, and what is selected. */
function applySharedView(view) {
  if (!view) return false;
  atlas.rig.resetDrift();
  atlas.rig.positionMetres = view.positionMetres;
  // The link speaks degrees, the rig speaks radians.
  atlas.rig.lookAtAngles((view.yaw * Math.PI) / 180, (view.pitch * Math.PI) / 180);
  if (view.observerYear !== null) {
    observerYear = view.observerYear;
    const slider = document.getElementById('epoch');
    if (slider) slider.value = String(observerYear - new Date().getFullYear());
  }
  if (view.selectionId) {
    // Every kind of selection a link can name, and an honest answer when it
    // names one we cannot restore.
    const resolved = resolveSelection({
      selectionId: view.selectionId,
      searchEntries: searchIndex?.entries ?? [],
      field: lssField,
      events: eventPayload?.events ?? [],
      starIds: starIndex?.tile?.ids ?? null,
    });
    atlas.stats.linkSelection = resolved.kind;
    cardSelection = resolved.kind === 'unknown'
      ? { kind: 'unresolved-link', requested: resolved.requested }
      : resolved.selection;
  }
  // A shared view is somebody's chosen vantage, not the route's opening shot.
  freeFlight = true;
  guide.record('selected');
  return true;
}

let lastShareAt = 0;
let pendingHash = '';
let pendingAt = 0;

/**
 * Publish the current view in the URL, quietly — whatever is on
 * screen, on a route or off it. A stopped sky is shareable the
 * moment it stops; a flying one publishes at most once a second so
 * the URL does not churn every frame.
 */
function shareView(now = performance.now()) {
  const hash = encodeView(makeView({
    positionMetres: atlas.rig.positionMetres,
    yaw: (atlas.rig.yaw * 180) / Math.PI,
    pitch: (atlas.rig.pitch * 180) / Math.PI,
    observerYear: atlas.observerYear,
    selectionId: cardSelection?.id ?? null,
  }));
  if (hash === lastSharedHash) return;
  if (hash !== pendingHash) {
    pendingHash = hash; // a new view waiting to be published
    pendingAt = now;
  }
  const settled = now - pendingAt >= 150;
  const due = now - lastShareAt >= 1000;
  if (!settled && !due) return;
  lastSharedHash = hash;
  pendingHash = '';
  lastShareAt = now;
  globalThis.history?.replaceState?.(null, '', hash);
}

/** The single hint line, when there is something worth saying.
 *  While the tour runs it owns the visitor's attention. */
function hintReadout() {
  const line = document.getElementById('hint');
  if (!line) return;
  if (tour.active) {
    line.textContent = '';
    return;
  }
  const hint = guide.current();
  line.textContent = hint ? hint.text : '';
}

/** A visitor is offered the walk once; the flag is theirs, not the app's. */
function tourSeen() {
  try {
    return globalThis.localStorage?.getItem(TOUR_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markTourSeen() {
  try {
    globalThis.localStorage?.setItem(TOUR_SEEN_KEY, '1');
  } catch {
    /* private mode: the walk will simply be offered again */
  }
}

/** Paint the tour, or put it away. One writer, like the caption. */
function paintTour() {
  const panel = document.getElementById('tour');
  if (!panel) return;
  const step = tour.current();
  if (!step) {
    panel.hidden = true;
    highlightTourTarget(document, null);
    return;
  }
  panel.hidden = false;
  renderTour(panel, step);
  highlightTourTarget(document, step.target);
}

/** Offer the walk: it takes the sky's attention, so it takes the cinematic too. */
function startTour() {
  if (!tour.steps.length) return;
  stopCinematic('tour');
  tour.start();
  paintTour();
}

/** End the walk and remember the visitor, so it is offered once. */
function endTour() {
  tour.skip();
  markTourSeen();
  paintTour();
}

/** A new visitor gets the walk once, after the sky has settled. */
function offerTour() {
  if (tourSeen()) return;
  setTimeout(() => {
    if (!tourSeen() && tour.finished) startTour();
  }, 2500);
}

function attachTourButtons() {
  const panel = document.getElementById('tour');
  if (!panel) return;
  panel.querySelector('[data-tour=next]')?.addEventListener('click', () => {
    if (!tour.next()) markTourSeen();
    paintTour();
  });
  panel.querySelector('[data-tour=back]')?.addEventListener('click', () => {
    tour.back();
    paintTour();
  });
  panel.querySelector('[data-tour=skip]')?.addEventListener('click', endTour);
}

/** The scrubber moves the observer's epoch. It does not re-render the sky: our
 *  catalogues describe one epoch, and pretending otherwise would be the easiest
 *  lie available to this project. */
function attachEpochScrubber() {
  const slider = document.getElementById('epoch');
  const line = document.getElementById('epoch-line');
  if (!slider) return;
  slider.addEventListener('input', () => {
    observerYear = new Date().getFullYear() + Number(slider.value);
    atlas.stats.observerYear = observerYear;
  });
  slider.hidden = false;
  line.hidden = false;
}

function epochReadout() {
  const line = document.getElementById('epoch-line');
  if (!line || !visible.length) return;
  const distances = [hudRangePc()[0] ?? 0, hudRangePc()[1] ?? 0];
  const span = epochSpan(distances, observerYear);
  line.textContent = `observer ${observerYear} CE · sky spans ${formatYear(span.oldestYear)} – ${formatYear(span.newestYear)}`;
}

function hudSelection() {
  if (cardSelection) return cardSelection;
  // Nothing else is selected and the tier is on screen: say what it is, and
  // more usefully what it is not. A click on a cell would need picking, which
  // is its own task; until then this reaches the card honestly.
  if (atlas.stats.lssVisible && lssField) {
    const live = lssLevels.find((layer) => layer.visible);
    return {
      kind: 'field',
      name: 'Large-scale structure',
      radiusMpc: lssField.radiusMpc,
      cellMpc: lssField.cellMpc,
      grid: lssField.grid,
      seed: lssField.seed,
      flag: lssField.flag,
      provenance: `generated · ${lssField.flag} · DESI DR1 is the science reference, not the source`,
      pointCount: live?.userData.pointCount ?? 0,
    };
  }
  if (!atlas.stats.points) return null; // nothing drawn, nothing to claim
  if (!selection || selection.pointIndex === undefined || !starIndex?.tile) return null;
  const tile = starIndex.tile;
  const index = selection.pointIndex;
  if (cardSelection) return cardSelection;
  return {
    kind: 'star',
    id: selection.id,
    planets: exoplanetReport?.byStar.get(index)?.planets ?? null,
    doubles: doubleReport?.byStar.get(index) ?? null,
    distancePc: selection.world.length() / METRES_PER_PC,
    magnitude: tile.magnitudes ? tile.magnitudes[index] / 1000 : null,
    colorIndex: null,
    provenance: `${tile.header.provenance.catalog} ${tile.header.provenance.release} · U3DTILE2 · measured`,
  };
}

function hudFlags() {
  const flags = {};
  if (atlas.layers.length > 0) flags.MEASURED = true;
  if (sparkLayers.length > 0) flags.MEASURED = true;
  if (smallBodyLayers.length > 0) flags.MEASURED = true;
  // The celestial-body tiers are measured content: each
  // layer answers for itself, from the flag its tile's
  // provenance baked into it. An optional tier the
  // frame budget shed is not on screen, so it does
  // not answer.
  for (const layers of [cometsLayers, planetsLayers, satellitesLayers]) {
    if (layers.some((layer) => layer.visible)) flags.MEASURED = true;
  }
  if (galaxiesLayers.some((layer) => layer.visible)) flags.MEASURED = true;
  if (blackHoleMarkers.some((marker) => marker.visible)) flags.MEASURED = true;
  if (dustLayers.length > 0) flags.UNRESOLVED = true;
  if (atlas.stats.lssVisible) flags.SIMULATED = true;
  return flags;
}

function hudSources() {
  const sources = [];
  for (const entry of tree?.tiles ?? []) sources.push(entry.id);
  if (relationPayload) sources.push('constellation figures');
  if (eventPayload) sources.push('ATNF pulsars');
  if (smallBodyPayload) sources.push('JPL small bodies');
  if (cometsPayload) sources.push('JPL comets');
  if (planetsPayload) sources.push('JPL planets');
  if (satellitesPayload) sources.push('JPL satellites');
  if (galaxiesPayload) sources.push('RC3 galaxies');
  if (blackHolesPayload) sources.push('Corral-Santana black holes');
  return sources;
}

function hudRangePc() {
  const position = atlas.rig.positionMetres;
  let min = Infinity;
  let max = 0;
  for (const chosen of visible) {
    const distance = chosen.box.distanceToPoint(position);
    min = Math.min(min, distance);
    max = Math.max(max, distance + chosen.box.boundingRadius());
  }
  if (!Number.isFinite(min)) return [null, null];
  return [min / METRES_PER_PC, max / METRES_PER_PC];
}

start().catch((error) => {
  if (hud) hud.dataset.error = error.message;
  window.__atlasError = error.message;
  throw error;
});