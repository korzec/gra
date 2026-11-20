(() => {
  'use strict';

  const TICK_SECONDS = 1 / 60;
  const MAX_REPLAY_INPUTS = 45;
  const SNAP_DISTANCE = 125;
  const CORRECTION_SPEED = 20;
  const MAX_EXTRAPOLATION_SECONDS = .2;
  const MAX_LATENCY_SECONDS = .18;
  const BOUNDS = { player: 210, car: 500, guard: 95 };

  function create() {
    let nextInputSeq = 0;
    let pendingInputs = [];
    let latencySeconds = .04;
    const observed = { player: new Map(), car: new Map(), guard: new Map() };

    function reset() {
      nextInputSeq = 0;
      pendingInputs = [];
      for (const values of Object.values(observed)) values.clear();
    }

    function recordInput(input) {
      const seq = ++nextInputSeq;
      pendingInputs.push({ ...input, seq });
      if (pendingInputs.length > MAX_REPLAY_INPUTS) {
        pendingInputs = pendingInputs.slice(-MAX_REPLAY_INPUTS);
      }
      return { ...input, seq };
    }

    function acknowledge(seq) {
      if (Number.isSafeInteger(seq) && seq >= 0) {
        pendingInputs = pendingInputs.filter(input => input.seq > seq);
      }
      return pendingInputs;
    }

    function observeLatency(rttMs) {
      if (Number.isFinite(rttMs) && rttMs >= 0 && rttMs < 1500) {
        latencySeconds = Math.min(MAX_LATENCY_SECONDS,
          latencySeconds * .8 + (rttMs / 2000) * .2);
      }
    }

    function wrapAngle(angle) {
      return Math.atan2(Math.sin(angle), Math.cos(angle));
    }

    // Purely visual reconciliation. New authoritative entities, teleports and
    // ownership changes snap immediately; ordinary drift decays over time.
    function reconcile(kind, visible, incoming, tick, targets = new Map()) {
      const prior = new Map(visible.map(object => [object.id, object]));
      const history = observed[kind];
      const alive = new Set();
      const result = [];
      for (const server of incoming) {
        if (!Number.isFinite(server.x) || !Number.isFinite(server.y)) continue;
        const id = server.id;
        alive.add(id);
        const old = prior.get(id);
        const previous = history.get(id);
        const deltaSeconds = previous && Number.isFinite(tick) && Number.isFinite(previous.tick)
          ? (tick - previous.tick) * TICK_SECONDS : 0;
        const canMeasure = deltaSeconds > 0 && deltaSeconds < .6;
        const velocityCap = BOUNDS[kind];
        const measuredX = canMeasure ? (server.x - previous.x) / deltaSeconds : 0;
        const measuredY = canMeasure ? (server.y - previous.y) / deltaSeconds : 0;
        const speed = Math.hypot(measuredX, measuredY);
        const factor = speed > velocityCap ? velocityCap / speed : 1;
        const vx = canMeasure ? measuredX * factor : previous?.vx || 0;
        const vy = canMeasure ? measuredY * factor : previous?.vy || 0;
        const angleVelocity = kind === 'car' && canMeasure && Number.isFinite(server.angle) &&
          Number.isFinite(previous.angle)
          ? Math.max(-5, Math.min(5, wrapAngle(server.angle - previous.angle) / deltaSeconds))
          : previous?.angleVelocity || 0;

        history.set(id, { x: server.x, y: server.y, angle: server.angle,
          vx, vy, angleVelocity, tick });

        const target = targets.get(id) || {
          x: server.x + vx * latencySeconds,
          y: server.y + vy * latencySeconds,
          ...(kind === 'car' && Number.isFinite(server.angle)
            ? { angle: server.angle + angleVelocity * latencySeconds } : {})
        };
        const ownershipChanged = kind === 'player' && old &&
          (old.carId !== server.carId || old.alive !== server.alive);
        const largeCorrection = old && Math.hypot(target.x - old.x, target.y - old.y) > SNAP_DISTANCE;
        const resultObject = { ...server };
        if (old && !ownershipChanged && !largeCorrection) {
          resultObject.x = old.x;
          resultObject.y = old.y;
          resultObject._correctionX = target.x - old.x;
          resultObject._correctionY = target.y - old.y;
          if (kind === 'car' && Number.isFinite(old.angle) && Number.isFinite(target.angle)) {
            resultObject.angle = old.angle;
            resultObject._correctionAngle = wrapAngle(target.angle - old.angle);
          }
        }
        resultObject._velocityX = vx;
        resultObject._velocityY = vy;
        resultObject._angularVelocity = angleVelocity;
        resultObject._predictionAge = 0;
        result.push(resultObject);
      }
      for (const id of history.keys()) if (!alive.has(id)) history.delete(id);
      return result;
    }

    function advance(kind, entities, dt, excludedIds = new Set()) {
      const alpha = 1 - Math.exp(-CORRECTION_SPEED * dt);
      for (const entity of entities) {
        entity._predictionAge = (entity._predictionAge || 0) + dt;
        if (!excludedIds.has(entity.id) && entity._predictionAge <= MAX_EXTRAPOLATION_SECONDS) {
          entity.x += (entity._velocityX || 0) * dt;
          entity.y += (entity._velocityY || 0) * dt;
          if (kind === 'car' && Number.isFinite(entity.angle)) {
            entity.angle += (entity._angularVelocity || 0) * dt;
          }
        }
        if (entity._correctionX) {
          const amount = entity._correctionX * alpha;
          entity.x += amount;
          entity._correctionX -= amount;
        }
        if (entity._correctionY) {
          const amount = entity._correctionY * alpha;
          entity.y += amount;
          entity._correctionY -= amount;
        }
        if (kind === 'car' && entity._correctionAngle) {
          const amount = entity._correctionAngle * alpha;
          entity.angle += amount;
          entity._correctionAngle -= amount;
        }
      }
    }

    return { reset, recordInput, acknowledge, observeLatency, reconcile, advance,
      get pendingCount() { return pendingInputs.length; } };
  }

  window.NocnyKursGuestPrediction = { create };
})();
