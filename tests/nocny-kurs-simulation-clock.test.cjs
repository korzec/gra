const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');

const clockSource = readFileSync(resolve(__dirname, '../nocny-kurs/simulation-clock.js'), 'utf8');
const gameSource = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../nocny-kurs/index.html'), 'utf8');

function clockHarness() {
  let time = 0;
  const intervals = [];
  const context = {
    window: {},
    setInterval(fn, ms) {
      const interval = { fn, ms, active: true };
      intervals.push(interval);
      return interval;
    },
    clearInterval(interval) { interval.active = false; }
  };
  runInNewContext(clockSource, context);
  return {
    create: context.window.NocnyKursSimulationClock.create,
    intervals,
    get time() { return time; },
    advance(ms) { time += ms; },
    now: () => time
  };
}

test('simulation runs at a fixed 30 Hz without any requestAnimationFrame callbacks', () => {
  const h = clockHarness();
  const timesteps = [];
  const clock = h.create(dt => timesteps.push(dt), h.now);
  assert.equal(h.intervals.length, 1);
  assert.ok(Math.abs(h.intervals[0].ms - 1000 / 30) < 1e-9);

  h.advance(1000 / 30);
  h.intervals[0].fn();
  assert.equal(timesteps.length, 1);
  assert.ok(Math.abs(timesteps[0] - 1 / 30) < 1e-9);

  h.advance(1000 / 30 * 2);
  h.intervals[0].fn();
  assert.equal(timesteps.length, 3);
  assert.ok(timesteps.every(dt => Math.abs(dt - 1 / 30) < 1e-9));

  clock.stop();
  assert.equal(h.intervals[0].active, false);
});

test('a one-second background timer delay advances simulation by one second', () => {
  const h = clockHarness();
  let steps = 0;
  h.create(() => { steps++; }, h.now);
  h.advance(1000);
  h.intervals[0].fn();
  assert.equal(steps, 30);
});

test('long browser suspensions cannot trigger unbounded catch-up or a permanent backlog', () => {
  const h = clockHarness();
  let steps = 0;
  h.create(() => { steps++; }, h.now);
  h.advance(60000);
  h.intervals[0].fn();
  assert.equal(steps, 30);

  h.advance(1000 / 30);
  h.intervals[0].fn();
  assert.equal(steps, 31);
});

test('host simulation and browser drawing have distinct schedulers', () => {
  assert.match(gameSource, /NocnyKursSimulationClock\.create\(dt => \{\s*if\(multiplayer\.role!==['"]guest['"]\)update\(dt\)/);
  const frame = gameSource.match(/function loop\(now\)\{([\s\S]*?)requestAnimationFrame\(loop\);\s*\}/);
  assert.ok(frame, 'rendering loop should still use requestAnimationFrame');
  assert.doesNotMatch(frame[1], /\bupdate\s*\(/, 'gameplay must not depend on drawing frames');
  assert.match(frame[1], /drawWorld\(/);
  assert.ok(html.indexOf('simulation-clock.js?v=') > 0);
  assert.ok(html.indexOf('simulation-clock.js?v=') < html.indexOf('game.js?v='));
});
