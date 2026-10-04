/**
 * Entry point: load the baked tiles, choose what to draw, and fly.
 *
 * The star geometry is rebased whenever the floating origin moves, because the
 * tiles are metres from the Sun and the GPU only ever sees coordinates near
 * zero.
 */

import { FrameBudgetController } from './core/frame-budget.js';
import { LodTree } from './core/lod-tree.js';
import { planesFromCamera } from './core/frustum.js';
import { decodeAllPositions, readTile } from './data/tile-reader.js';
import { createStarLayer } from './render/star-layer.js';
import { AtlasScene } from './render/scene.js';
import { createScaleOutPath } from './routes/scale-out.js';
import { DEEP_FIELDS } from './data/deep-fields.js';
import { Backdrop } from './render/backdrop.js';
import { anglesFromDirection, directionFromAngles } from './core/view.js';
import { createNebulosity } from './render/nebulosity.js';
import { createStarDust } from './render/star-dust.js';
import { StarIndex, buildRelationRibbons } from './render/relation-layer.js';
import { createReticle, worldWidthForPixels } from './render/reticles.js';
import { createSparkLayers } from './render/sparks.js';
import { METRES_PER_PC, metresToPc } from './core/units.js';
import { celestialDirection } from './core/celestial.js';
import { hudModel, renderHud } from './ui/hud.js';
import { FlightController, inputFromKeys } from './core/flight-controls.js';
import { journeyFromLandmarks } from './core/journey.js';
import { SearchIndex, flightPathTo } from './core/search.js';
import { epochSpan, formatYear } from './core/light-travel.js';
import { Onboarding } from './core/onboarding.js';
import { motionPolicy, prefersReducedMotion } from './core/accessibility.js';
import { OPENING_STEPS } from './data/onboarding.js';
const flight = new FlightController();
const keys = new Set();
let freeFlight = false;
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === '/' && document.activeElement !== document.getElementById('search')) {
    event.preventDefault();
    document.getElementById('search')?.focus();
    return;
  }
  if (key === 'escape') {
    guide.dismiss();
    document.activeElement?.blur?.();
    return;
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
const EVENT_DIR = '../assets/events/pulsars.json';
const LANDMARK_DIR = '../assets/landmarks/landmarks.json';
const SEARCH_DIR = '../assets/search/nearby.json';
let eventPayload = null;
let sparkLayers = [];
const budget = new FrameBudgetController({ maxPoints: 120000, minPoints: 3000, window: 20 });
const route = createScaleOutPath();
let journeyRoute = null;
let activeRoute = route;
let activeRouteName = 'scale out';
let routeTime = 0;

const canvas = document.getElementById('view');
const hud = document.getElementById('hud');

const atlas = new AtlasScene({ canvas, aspect: 1 });
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
  box.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const match = searchIndex.best(box.value);
    if (!match) {
      result.textContent = `nothing found for "${box.value}"`;
      return;
    }
    const fromPc = Math.max(metresToPc(Math.hypot(...atlas.rig.positionMetres)), 1e-4);
    const path = flightPathTo(match, { fromPc });
    guide.record('searched');
    cardSelection = { ...match, kind: 'landmark' };
    switchRoute(path, `flight to ${match.name ?? `HIP ${match.hip}`}`);
    result.textContent = `${match.name ?? `HIP ${match.hip}`} · ${match.distance_pc.toFixed(3)} pc · HIP ${match.hip}`;
    atlas.stats.searchResult = match.id;
  });
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
    tree.addFromManifest(entry);
    tiles.push(await loadTile(`${TILE_DIR}/${entry.file}`));
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
  relationPayload = await loadJson(RELATION_DIR).catch(() => null);
  eventPayload = await loadJson(EVENT_DIR).catch(() => null);

  const biggest = tiles.reduce((a, b) => (b.count > a.count ? b : a));
  starIndex = new StarIndex(biggest.worldPositions);
  starIndex.tile = biggest;

  atlas.rig.positionMetres = route.sample(0).positionMetres;
  redraw();

  let previous = performance.now();
  const loop = (now) => {
    // requestAnimationFrame timestamps the start of a frame, which can predate a
    // performance.now() taken just before it, so the first delta can be negative.
    // The step is clamped so a long stall cannot teleport the camera; the
    // unclamped value is what the performance harness records.
    const measured = Math.max(0, (now - previous) / 1000);
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

    if (freeFlight) {
      atlas.rig.resetDrift();
      atlas.rig.positionMetres = flight.step(delta, atlas.rig.positionMetres);
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
    atlas.stats.route = activeRouteName;
    }
    if (atlas.origin.recentredAt !== lastOriginEpoch) redraw();
    refreshViewRange();
    atlas.frame(delta, measured);
    atlas.measure(now);
    if (budget.sample(delta).changed) redraw();
    updateHud();
    epochReadout();
    hintReadout();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
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
}

let nebulosity = null;
let dustLayers = [];
let mediumScale = 0;
let relationPayload = null;
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
  atlas.stats.eventPlaced = worldPositions.size;
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
  selection = selectNearestToView(direction);
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
    label: selection.id ?? 'nearest star',
  });
  atlas.scene.add(reticle);
}

/** Ribbons between measured stars. Rebuilt with the medium because the
 *  vertices live in render space; the star index itself never moves. */
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
    citation: relationPayload.citation,
    index: starIndex,
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
let observerYear = new Date().getFullYear();
const guide = new Onboarding(OPENING_STEPS, { now: () => performance.now() / 1000 });
// Someone who asks for reduced motion gets a still sky: no self-flying, no drift.
const motion = motionPolicy({ reduced: prefersReducedMotion() });

/** The single hint line, when there is something worth saying. */
function hintReadout() {
  const line = document.getElementById('hint');
  if (!line) return;
  const hint = guide.current();
  line.textContent = hint ? hint.text : '';
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
  if (!selection || selection.pointIndex === undefined || !starIndex?.tile) return null;
  const tile = starIndex.tile;
  const index = selection.pointIndex;
  if (cardSelection) return cardSelection;
  return {
    kind: 'star',
    id: selection.id,
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
  if (dustLayers.length > 0) flags.UNRESOLVED = true;
  return flags;
}

function hudSources() {
  const sources = [];
  for (const entry of tree?.tiles ?? []) sources.push(entry.id);
  if (relationPayload) sources.push('constellation figures');
  if (eventPayload) sources.push('ATNF pulsars');
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