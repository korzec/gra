(() => {
  'use strict';

  // Keep the authoritative game simulation independent of rendering frames.
  // Browser timers may still be throttled when a tab is hidden.
  const STEP_MS = 1000 / 30;
  const MAX_CATCHUP_STEPS = 30;

  function create(onStep, now = () => performance.now()) {
    let previous = now();
    let accumulated = 0;

    function tick() {
      const current = now();
      const elapsed = current - previous;
      previous = current;

      if (!Number.isFinite(elapsed) || elapsed < 0) {
        accumulated = 0;
        return;
      }

      // Recover up to one second after a delayed background timer without
      // running unbounded simulation work after the browser wakes up.
      accumulated = Math.min(accumulated + elapsed, STEP_MS * MAX_CATCHUP_STEPS);
      const steps = Math.min(MAX_CATCHUP_STEPS, Math.floor((accumulated + 1e-6) / STEP_MS));
      for (let i = 0; i < steps; i++) onStep(STEP_MS / 1000);
      accumulated = Math.max(0, accumulated - steps * STEP_MS);
    }

    const interval = setInterval(tick, STEP_MS);
    return { stop() { clearInterval(interval); } };
  }

  window.NocnyKursSimulationClock = { create };
})();
