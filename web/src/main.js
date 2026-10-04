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
import { attachPlanets, planetRows } from './data/exoplanets.js';
import { figureCitation, figureStarPositions } from './data/figure-stars.js';
import { sampleIntegrity } from './core/integrity.js';
import { Cinematic } from './core/cinematic.js';
import {
  cellIdentity,
  identityAt,
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
import { cinematicStepsFromRoute } from './routes/cinematic-path.js';
import { createScaleOutPath } from './routes/scale-out.js';
import { DEEP_FIELDS } from './data/deep-fields.js';
import { Backdrop } from './render/backdrop.js';
import { anglesFromDirection, directionFromAngles } from './core/view.js';
import { createNebulosity } from './render/nebulosity.js';
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
import { METRES_PER_PC, metresToPc } from './core/units.js';
import { celestialDirection } from './core/celestial.js';
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
const EXOPLANET_DIR = '../assets/relations/exoplanets.json';
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
  await loadLssField();
  buildPath();
  relationPayload = await loadJson(RELATION_DIR).catch(() => null);
  const figurePayload = await loadJson(FIGURE_STAR_DIR).catch(() => null);
  if (figurePayload) {
    // Figure endpoints resolve against measured Hipparcos rows, not against
    // whatever star in the neighbourhood tile happens to be nearby.
    figureStarIndex = new StarIndex(figureStarPositions(figurePayload));
    figureStarPayload = figurePayload;
  }
  eventPayload = await loadJson(EVENT_DIR).catch(() => null);

  const biggest = tiles.reduce((a, b) => (b.count > a.count ? b : a));
  starIndex = new StarIndex(biggest.worldPositions);
  starIndex.tile = biggest;

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
    dropStaleSelection();
    atlas.frame(delta, measured);
    atlas.measure(now);
    if (budget.sample(delta).changed) redraw();
    updateLssVisibility();
    updateHud();
    epochReadout();
    hintReadout();
    shareView();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/**
 * Export what is on screen. The gate runs before anything is written: a row that
 * cannot say whether it was measured or modelled does not reach the file.
 */
function downloadSlice() {
  const slice = buildSlice({
    starIndex,
    drawnPoints: atlas.stats.points,
    originMetres: atlas.origin.originMetres,
    field: atlas.stats.lssVisible ? lssField : null,
    level: lssLevel,
    // Whatever the renderer decided to draw is what the file must contain.
    threshold: lssLevels.find((layer) => layer.visible)?.userData.threshold ?? 0,
  });
  const planets = exoplanetReport ? planetRows(exoplanetReport) : [];
  const rows = [...slice.rows, ...planets];
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
    starIndex,
    drawnPoints: atlas.stats.points,
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


/** The caption belongs to the hold; it leaves the moment the sky is taken back. */
function renderCaption() {
  const caption = captionFor(cinematic.active ? cinematic.current : null);
  if (!caption) return hideCaption();
  if (captionShown === caption.text) return;
  captionShown = caption.text;
  captionEl.textContent = `${caption.text} — ${caption.source}`;
  captionEl.hidden = false;
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
  // Only star selections go stale when the star set is dropped. A picked cell
  // in the modelled tier is still drawn, and clearing it would mean the tier
  // could never be interrogated from a viewpoint with no stars in it.
  const isStarSelection = (candidate) => candidate
    && (candidate.kind === 'star' || candidate.pointIndex !== undefined);
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
    label: selection.id ?? 'nearest star',
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
// Someone who asks for reduced motion gets a still sky: no self-flying, no drift.
const motion = motionPolicy({ reduced: prefersReducedMotion() });
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
    const wanted = String(view.selectionId);
    const byId = searchIndex?.entries.find((entry) => String(entry.id) === wanted);
    if (byId) cardSelection = { ...byId, kind: 'landmark' };
  }
  // A shared view is somebody's chosen vantage, not the route's opening shot.
  freeFlight = true;
  guide.record('selected');
  return true;
}

/** Publish the current view in the URL, quietly. */
function shareView() {
  if (!freeFlight) return;
  const hash = encodeView(makeView({
    positionMetres: atlas.rig.positionMetres,
    yaw: (atlas.rig.yaw * 180) / Math.PI,
    pitch: (atlas.rig.pitch * 180) / Math.PI,
    observerYear,
    selectionId: cardSelection?.id ?? (selection?.id ? String(selection.id) : null),
  }));
  if (hash === lastSharedHash) return;
  lastSharedHash = hash;
  globalThis.history?.replaceState?.(null, '', hash);
}

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
  if (atlas.stats.lssVisible) flags.SIMULATED = true;
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