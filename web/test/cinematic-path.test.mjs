/**
 * A tour that silently loses three quarters of its steps is worse than none.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { cinematicStepsFromRoute } from '../src/routes/cinematic-path.js';
import { createScaleOutPath } from '../src/routes/scale-out.js';

const toAngles = () => ({ yaw: 0, pitch: 0 });

test('the real route yields one step per waypoint', () => {
  const route = createScaleOutPath();
  const steps = cinematicStepsFromRoute(route, { toAngles });
  assert.equal(steps.length, route.waypoints.length,
    `expected ${route.waypoints.length} steps, got ${steps.length}: ${steps.map((s) => s.id).join(', ')}`);
  assert.deepEqual(steps.map((s) => s.id), route.waypoints.map((w) => w.name));
});

test('impatience loses waypoints, which is why the patience is 20 seconds', () => {
  const route = createScaleOutPath();
  const impatient = cinematicStepsFromRoute(route, { toAngles, quietSeconds: 8 });
  assert.ok(impatient.length < route.waypoints.length,
    'the old 8s patience is expected to lose waypoints — that is the bug');
  assert.ok(cinematicStepsFromRoute(route, { toAngles }).length > impatient.length);
});

test('each step carries the radius its caption will quote', () => {
  const route = createScaleOutPath();
  const steps = cinematicStepsFromRoute(route, { toAngles });
  assert.deepEqual(steps.map((s) => s.radiusPc), route.waypoints.map((w) => w.radiusPc));
});

test('a step holds, and travel is never zero', () => {
  const steps = cinematicStepsFromRoute(createScaleOutPath(), { toAngles });
  for (const step of steps) {
    assert.ok(step.travel >= 1, `${step.id} travel ${step.travel}`);
    assert.equal(step.hold, 5, `${step.id} holds so the eye can read the scale`);
  }
});

test('refuses to guess without a route and an angle function', () => {
  assert.throws(() => cinematicStepsFromRoute(null, { toAngles }), /route/);
  assert.throws(() => cinematicStepsFromRoute(createScaleOutPath(), {}), /toAngles/);
});
