(() => {
  'use strict';

  // A full cycle is 26 seconds. Each direction gets a green, amber and
  // all-red clearance period; opposing traffic is never green together.
  const GREEN_SECONDS = 10;
  const AMBER_SECONDS = 2;
  const CLEARANCE_SECONDS = 1;
  const HALF_CYCLE = GREEN_SECONDS + AMBER_SECONDS + CLEARANCE_SECONDS;
  const CYCLE_SECONDS = HALF_CYCLE * 2;
  const PHASE_OFFSET = CYCLE_SECONDS / 4;

  function phase(xi, yi, time) {
    const offset = ((xi * 3 + yi * 5) % 4) * PHASE_OFFSET;
    return ((time + offset) % CYCLE_SECONDS + CYCLE_SECONDS) % CYCLE_SECONDS;
  }

  function signal(xi, yi, time, axis) {
    const t = phase(xi, yi, time);
    if (axis === 'horizontal') {
      if (t < GREEN_SECONDS) return 'green';
      if (t < GREEN_SECONDS + AMBER_SECONDS) return 'amber';
      return 'red';
    }
    if (t >= HALF_CYCLE && t < HALF_CYCLE + GREEN_SECONDS) return 'green';
    if (t >= HALF_CYCLE + GREEN_SECONDS &&
        t < HALF_CYCLE + GREEN_SECONDS + AMBER_SECONDS) return 'amber';
    return 'red';
  }

  // Return the distance from the vehicle centre to the nearest stop
  // position ahead. The stop position keeps the front bumper behind the
  // painted line. Once the centre is past that position, it may clear the
  // intersection even if the lights change.
  function upcomingStop({x, y, angle, halfLength, time, roadsX, roadsY,
                         roadWidth, laneOffset, lookahead = 260}) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const horizontal = Math.abs(dx) > .94;
    const vertical = Math.abs(dy) > .94;
    if (!horizontal && !vertical) return null;

    const laneTolerance = laneOffset + 10;
    const nearRoad = (roads, coord) => {
      let best = -1, distance = Infinity;
      for (let i = 0; i < roads.length; i++) {
        const diff = Math.abs(roads[i] - coord);
        if (diff < distance) { distance = diff; best = i; }
      }
      return distance <= laneTolerance ? best : -1;
    };

    const sign = horizontal ? Math.sign(dx) : Math.sign(dy);
    const roadIndex = horizontal ? nearRoad(roadsY, y) : nearRoad(roadsX, x);
    if (roadIndex < 0) return null;
    const junctions = horizontal ? roadsX : roadsY;
    const position = horizontal ? x : y;
    const axis = horizontal ? 'horizontal' : 'vertical';
    const margin = roadWidth / 2 + halfLength + 4;
    let closest = null;
    for (let index = 0; index < junctions.length; index++) {
      const stopPosition = junctions[index] - sign * margin;
      const distance = (stopPosition - position) * sign;
      if (distance < 0 || distance > lookahead) continue;
      const xi = horizontal ? index : roadIndex;
      const yi = horizontal ? roadIndex : index;
      const color = signal(xi, yi, time, axis);
      if (color === 'green') continue;
      if (!closest || distance < closest.distance) {
        closest = {distance, xi, yi, axis, color};
      }
    }
    return closest;
  }

  // Limit forward travel smoothly on approach, without crossing the
  // red-light stop position; the caller still handles other collisions.
  function permittedStep(stop, maxSpeed, dt) {
    if (!stop) return maxSpeed * dt;
    const remaining = Math.max(0, stop.distance - .25);
    const brakingSpeed = Math.sqrt(2 * 340 * remaining);
    return Math.min(maxSpeed, brakingSpeed) * dt;
  }

  const api = {signal, phase, upcomingStop, permittedStep, CYCLE_SECONDS};
  if (typeof window !== 'undefined') window.NocnyKursTrafficLights = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();