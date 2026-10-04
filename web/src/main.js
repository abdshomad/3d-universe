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
import { formatScale } from './core/units.js';
import { createScaleOutPath } from './routes/scale-out.js';
import { DEEP_FIELDS } from './data/deep-fields.js';
import { Backdrop } from './render/backdrop.js';
import { anglesFromDirection, directionFromAngles } from './core/view.js';
import { createNebulosity } from './render/nebulosity.js';
import { createStarDust } from './render/star-dust.js';
import { StarIndex, buildRelationRibbons } from './render/relation-layer.js';

const TILE_DIR = '../assets/tiles';
const RELATION_DIR = '../assets/relations/constellations.json';
const budget = new FrameBudgetController({ maxPoints: 120000, minPoints: 3000, window: 20 });
const route = createScaleOutPath();
let routeTime = 0;

const canvas = document.getElementById('view');
const readout = document.getElementById('readout');

const atlas = new AtlasScene({ canvas, aspect: 1 });
window.__atlas = atlas;
atlas.budget = budget;
atlas.route = route;
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

  const manifest = await loadJson(`${TILE_DIR}/manifest.json`);
  tree = new LodTree();
  for (const entry of manifest.tiles) {
    tree.addFromManifest(entry);
    tiles.push(await loadTile(`${TILE_DIR}/${entry.file}`));
  }
  relationPayload = await loadJson(RELATION_DIR).catch(() => null);
  if (relationPayload) {
    const biggest = tiles.reduce((a, b) => (b.count > a.count ? b : a));
    starIndex = new StarIndex(biggest.worldPositions);
  }

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
    routeTime += delta;
    const shot = route.sample(routeTime);
    atlas.rig.positionMetres = shot.positionMetres;
    // The route says where to face: a deep field, or outward along the route.
    const look = anglesFromDirection(shot.lookDirection);
    atlas.rig.yaw = look.yaw;
    atlas.rig.pitch = look.pitch;
    atlas.stats.waypoint = shot.name;
    atlas.stats.routeSeconds = routeTime;
    if (atlas.origin.recentredAt !== lastOriginEpoch) redraw();
    refreshViewRange();
    atlas.frame(delta, measured);
    atlas.measure(now);
    if (budget.sample(delta).changed) redraw();
    updateReadout();
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

function updateReadout() {
  const { fps, points, backend, near, far } = atlas.stats;
  const scale = formatScale(Math.hypot(...atlas.rig.positionMetres));
  if (readout) {
    readout.textContent = [
      `${atlas.stats.waypoint ?? 'free flight'} · ${fps.toFixed(1)} fps · ${backend}`,
      `${points}/${budget.budgetPoints} points`,
      `view scale ${scale}`,
      `depth ${near.toExponential(1)}–${far.toExponential(1)} m`,
    ].join(' · ');
  }
}

start().catch((error) => {
  if (readout) readout.textContent = `failed: ${error.message}`;
  window.__atlasError = error.message;
  throw error;
});