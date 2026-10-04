/**
 * The cinematic path, read off the route the atlas already flies.
 *
 * The route visits five scales in order. We want each as a step, with a hold so
 * the eye can read the scale it has arrived at.
 *
 * Arrivals are found by watching for the waypoint name to change, which needs a
 * patience longer than the longest segment between waypoints — the route's own
 * segments run 4 to 14 seconds, so an 8-second patience gives up after the second
 * waypoint and silently ships a two-step tour. Measured: 8 s finds 2 arrivals,
 * 20 s finds all 5.
 */

const DEFAULT_QUIET_SECONDS = 20;

export function cinematicStepsFromRoute(route, {
  toAngles,
  quietSeconds = DEFAULT_QUIET_SECONDS,
  maxSeconds = 240,
  hold = 5,
} = {}) {
  if (!route?.waypoints || typeof toAngles !== 'function') {
    throw new TypeError('cinematicStepsFromRoute needs a route and a toAngles function');
  }

  const arrivals = [];
  let lastName = null;
  let quiet = 0;
  for (let t = 0; t <= maxSeconds && quiet < quietSeconds; t += 0.25) {
    const shot = route.sample(t);
    if (shot.name !== lastName) {
      arrivals.push({ t, shot });
      lastName = shot.name;
      quiet = 0;
    } else {
      quiet += 0.25;
    }
  }

  return arrivals.map(({ t, shot }, index) => {
    const angles = toAngles(shot.lookDirection);
    const previous = index === 0 ? 0 : arrivals[index - 1].t;
    return {
      id: shot.name,
      radiusPc: route.waypoints[index]?.radiusPc ?? null,
      travel: Math.max(1, t - previous),
      hold,
      positionMetres: shot.positionMetres,
      yaw: angles.yaw,
      pitch: angles.pitch,
    };
  });
}
