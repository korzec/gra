(() => {
  'use strict';

  const TICK_SECONDS = 1 / 60;
  const MAX_REPLAY_INPUTS = 45;
  const SNAP_DISTANCE = 125;
  const CORRECTION_SPEED = 20;
  const MAX_EXTRAPOLATION_SECONDS = .2;
  const MAX_LATENCY_SECONDS = .18;
  const MAX_BUFFERED_SNAPSHOTS = 24;
  const BOUNDS = { player: 210, car: 500, guard: 95, carDriver: 150 };

  function wrapAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function lerpAngle(a, b, fraction) {
    return a + wrapAngle(b - a) * fraction;
  }

  function create() {
    let nextInputSeq = 0;
    let pendingInputs = [];
    let latencySeconds = .04;
    let jitterSeconds = 0;
    let lastLatency = null;
    const observed = { player: new Map(), car: new Map(), guard: new Map(), carDriver: new Map() };
    const tracks = { player: new Map(), car: new Map(), guard: new Map(), carDriver: new Map() };

    function resetMotion() {
      for (const values of Object.values(observed)) values.clear();
      for (const values of Object.values(tracks)) values.clear();
    }

    function reset() {
      nextInputSeq = 0;
      pendingInputs = [];
      latencySeconds = .04;
      jitterSeconds = 0;
      lastLatency = null;
      resetMotion();
    }

    function recordInput(input) {
      const seq = ++nextInputSeq;
      pendingInputs.push({ ...input, seq });
      if (pendingInputs.length > MAX_REPLAY_INPUTS) pendingInputs = pendingInputs.slice(-MAX_REPLAY_INPUTS);
      return { ...input, seq };
    }

    function acknowledge(seq) {
      if (Number.isSafeInteger(seq) && seq >= 0) {
        pendingInputs = pendingInputs.filter(input => input.seq > seq);
      }
      return pendingInputs;
    }

    function observeLatency(rttMs) {
      if (!Number.isFinite(rttMs) || rttMs < 0 || rttMs >= 1500) return;
      const measured = Math.min(MAX_LATENCY_SECONDS, rttMs / 2000);
      if (lastLatency !== null) {
        jitterSeconds = jitterSeconds * .8 + Math.abs(measured - lastLatency) * .2;
      }
      lastLatency = measured;
      latencySeconds = latencySeconds * .8 + measured * .2;
    }

    // Playback is a few server ticks behind to absorb network delivery jitter.
    // Change delay slowly with observed jitter, not with the average RTT.
    function interpolationDelayTicks() {
      return clamp(Math.ceil((.07 + jitterSeconds * 2) / TICK_SECONDS), 5, 12);
    }

    function reconcile(kind, visible, incoming, tick, targets = new Map(), localIds = new Set()) {
      const prior = new Map(visible.map(object => [object.id, object]));
      const history = observed[kind];
      const paths = tracks[kind];
      const alive = new Set();
      const result = [];
      for (const server of incoming) {
        if (!Number.isFinite(server.x) || !Number.isFinite(server.y)) continue;
        const id = server.id;
        alive.add(id);
        const old = prior.get(id);
        const previous = history.get(id);
        const currentTick = Number.isFinite(tick) ? tick : (previous?.tick || 0) + 1;
        if (previous && currentTick <= previous.tick && old) {
          result.push(old); // Ignore old frames, including those arriving after reconnect.
          continue;
        }
        const deltaSeconds = previous ? (currentTick - previous.tick) * TICK_SECONDS : 0;
        const canMeasure = deltaSeconds > 0 && deltaSeconds < .6;
        const cap = BOUNDS[kind];
        const measuredX = canMeasure ? (server.x - previous.x) / deltaSeconds : 0;
        const measuredY = canMeasure ? (server.y - previous.y) / deltaSeconds : 0;
        const speed = Math.hypot(measuredX, measuredY);
        const factor = speed > cap ? cap / speed : 1;
        const vx = canMeasure ? measuredX * factor : previous?.vx || 0;
        const vy = canMeasure ? measuredY * factor : previous?.vy || 0;
        const angleVelocity = kind === 'car' && canMeasure &&
          Number.isFinite(server.angle) && Number.isFinite(previous.angle)
          ? clamp(wrapAngle(server.angle - previous.angle) / deltaSeconds, -5, 5)
          : previous?.angleVelocity || 0;
        history.set(id, { x: server.x, y: server.y, angle: server.angle,
          vx, vy, angleVelocity, tick: currentTick });

        const local = localIds.has(id) || targets.has(id);
        const target = targets.get(id) || { x: server.x, y: server.y,
          ...(kind === 'car' && Number.isFinite(server.angle) ? { angle: server.angle } : {}) };
        const ownershipChanged = kind === 'player' && old &&
          (old.carId !== server.carId || old.alive !== server.alive);
        const largeCorrection = old &&
          Math.hypot(target.x - old.x, target.y - old.y) > SNAP_DISTANCE;
        const resultObject = { ...server, _velocityX: vx, _velocityY: vy,
          _angularVelocity: angleVelocity, _predictionAge: 0 };

        if (!local) {
          // Keep a bounded history of authoritative poses. Remote objects are
          // interpolated at a stable server time; no velocity-plus-snap feedback.
          let path = paths.get(id);
          if (!path || ownershipChanged || largeCorrection) path = [];
          path.push({ tick: currentTick, x: server.x, y: server.y,
            angle: server.angle, vx, vy, angleVelocity });
          if (path.length > MAX_BUFFERED_SNAPSHOTS) path.shift();
          paths.set(id, path);
          resultObject._interpolated = true;
          if (old && !ownershipChanged && !largeCorrection) {
            resultObject.x = old.x;
            resultObject.y = old.y;
            if (kind === 'car' && Number.isFinite(old.angle)) resultObject.angle = old.angle;
            resultObject._playbackTick = Number.isFinite(old._playbackTick)
              ? old._playbackTick : currentTick - interpolationDelayTicks();
          } else {
            resultObject._playbackTick = currentTick - interpolationDelayTicks();
          }
        } else {
          paths.delete(id);
          resultObject._interpolated = false;
          if (old && !ownershipChanged && !largeCorrection) {
            resultObject.x = old.x;
            resultObject.y = old.y;
            // Keep locally simulated car throttle rather than overwriting on each packet.
            if (kind === 'car') resultObject.speed = old.speed;
            if (kind === 'player' && Number.isFinite(target.jumpTime)) { resultObject.jumpTime=target.jumpTime; resultObject.jumpHeld=target.jumpHeld; resultObject.jumpSafeX=target.jumpSafeX??null;resultObject.jumpSafeY=target.jumpSafeY??null; }
            resultObject._correctionX = target.x - old.x;
            resultObject._correctionY = target.y - old.y;
            if (kind === 'car' && Number.isFinite(old.angle) && Number.isFinite(target.angle)) {
              resultObject.angle = old.angle;
              resultObject._correctionAngle = wrapAngle(target.angle - old.angle);
            }
          }
        }
        result.push(resultObject);
      }
      for (const id of history.keys()) {
        if (!alive.has(id)) { history.delete(id); paths.delete(id); }
      }
      return result;
    }

    function advance(kind, entities, dt, excludedIds = new Set()) {
      const alpha = 1 - Math.exp(-CORRECTION_SPEED * dt);
      for (const entity of entities) {
        entity._predictionAge = (entity._predictionAge || 0) + dt;
        if (entity._interpolated && !excludedIds.has(entity.id)) {
          const path = tracks[kind].get(entity.id);
          if (path?.length >= 2) {
            const earliest = path[0], latest = path[path.length - 1];
            const desired = latest.tick - interpolationDelayTicks();
            const playback = Number.isFinite(entity._playbackTick)
              ? entity._playbackTick : desired;
            const drift = desired - playback;
            // A small adaptive playback-rate correction prevents backlog while
            // keeping normal motion independent from packet arrival times.
            const playbackRate = clamp(1 + drift * .08, .8, 1.6);
            const nextTick = Math.min(latest.tick + MAX_EXTRAPOLATION_SECONDS / TICK_SECONDS,
              playback + dt / TICK_SECONDS * playbackRate);
            entity._playbackTick = nextTick;
            let left = earliest, right = earliest, fraction = 0;
            if (nextTick >= latest.tick) {
              left = right = latest;
            } else if (nextTick > earliest.tick) {
              for (let i = 1; i < path.length; i++) {
                if (path[i].tick >= nextTick) {
                  left = path[i - 1];
                  right = path[i];
                  fraction = clamp((nextTick - left.tick) / (right.tick - left.tick), 0, 1);
                  break;
                }
              }
            }
            const extra = left === latest
              ? Math.min(MAX_EXTRAPOLATION_SECONDS, Math.max(0, (nextTick - latest.tick) * TICK_SECONDS))
              : 0;
            entity.x = left.x + (right.x - left.x) * fraction + (extra ? latest.vx * extra : 0);
            entity.y = left.y + (right.y - left.y) * fraction + (extra ? latest.vy * extra : 0);
            if (kind === 'car' && Number.isFinite(left.angle) && Number.isFinite(right.angle)) {
              entity.angle = lerpAngle(left.angle, right.angle, fraction) +
                (extra ? latest.angleVelocity * extra : 0);
            }
            continue;
          }
        }
        // Local player and car are predicted by game.js; only visual error is corrected.
        if (!excludedIds.has(entity.id) && !entity._interpolated &&
            entity._predictionAge <= MAX_EXTRAPOLATION_SECONDS) {
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

    return { reset, resetMotion, recordInput, acknowledge, observeLatency,
      reconcile, advance, get pendingCount() { return pendingInputs.length; } };
  }

  window.NocnyKursGuestPrediction = { create };
})();
