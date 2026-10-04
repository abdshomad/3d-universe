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

const TILE_DIR = '../assets/tiles';
const budget = new FrameBudgetController({ maxPoints: 120000, minPoints: 3000, window: 20 });
const route = createScaleOutPath();
let routeTime = 0;

const canvas = document.getElementById('view');
const readout = document.getElementById('readout');

const atlas = new AtlasScene({ canvas, aspect: 1 });
window.__atlas = atlas;
atlas.budget = budget;
atlas.route = route;

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

  const manifest = await loadJson(`${TILE_DIR}/manifest.json`);
  tree = new LodTree();
  for (const entry of manifest.tiles) {
    tree.addFromManifest(entry);
    tiles.push(await loadTile(`${TILE_DIR}/${entry.file}`));
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
    // Look outward along the route: the camera faces the direction it travels.
    atlas.rig.yaw = Math.atan2(shot.positionMetres[0], shot.positionMetres[2]);
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
  lastOriginEpoch = atlas.origin.recentredAt;
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
  atlas.stats.drawCount = drawn;
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
  if (Number.isFinite(min)) atlas.setViewRange(min, Math.max(max, min * 10));
}

function directionFromRig(rig) {
  const [x, y, z] = [
    Math.cos(rig.pitch) * Math.sin(rig.yaw),
    Math.sin(rig.pitch),
    Math.cos(rig.pitch) * Math.cos(rig.yaw),
  ];
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
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