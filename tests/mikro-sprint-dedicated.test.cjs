const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const root = resolve(__dirname, "..");
const gameSource = readFileSync(resolve(root, "mikro-sprint/game.js"), "utf8");
const onlineSource = readFileSync(resolve(root, "mikro-sprint/multiplayer.js"), "utf8");
const page = readFileSync(resolve(root, "mikro-sprint/index.html"), "utf8");

function dedicated(botCount = 3) {
  const node = () => ({
    value: "", textContent: "", innerHTML: "", hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty() {}, removeProperty() {} },
    getContext: () => ({}),
    addEventListener() {},
    getBoundingClientRect: () => ({ width: 390, height: 844 }),
    setAttribute() {}
  });
  const window = { __MIKRO_SPRINT_DEDICATED__: true, __MIKRO_SPRINT_BOTS__: botCount, addEventListener() {} };
  const doc = { querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  runInNewContext(gameSource, { window, document: doc,
    navigator: { getGamepads: () => [] }, performance: { now: () => 0 } }, { timeout: 3000 });
  return window.MikroSprintDedicated;
}

test("browser source runs authoritative physics in headless dedicated mode", () => {
  const simulation = dedicated();
  assert.ok(simulation && typeof simulation.tick === "function");
  assert.equal(simulation.join("a", "bath"), 1);
  assert.equal(simulation.join("b", "pool"), 5);
  const initial = simulation.snapshot();
  assert.equal(initial.track, "bath");
  assert.equal(initial.cars.filter(c => c.human).length, 2);
  for (let i = 0; i < 240; i++) simulation.tick(1 / 60);
  assert.equal(simulation.snapshot().phase, "racing");
  const before = simulation.snapshot().cars[0];
  simulation.input("a", { seq: 12, dx: 0, dy: -1, gas: 1, brake: 0, fire: false });
  for (let i = 0; i < 20; i++) simulation.tick(1 / 60);
  const after = simulation.snapshot().cars[0];
  assert.equal(after.lastAppliedInputSeq, 12);
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 1);
  simulation.leave("a");
  assert.equal(simulation.snapshot().cars[0].human, false);
});

test("dedicated player slots are server-owned and online room wire identity is namespaced", () => {
  const simulation = dedicated();
  const slots = new Set();
  for (let n = 0; n < 8; n++) slots.add(simulation.join("peer-" + n));
  assert.equal(slots.size, 8);
  assert.equal(simulation.join("extra"), null);
  assert.equal(simulation.snapshot().cars.length, 8);
  simulation.input("extra", { seq: 1, dx: 1, dy: 0, gas: 1 });
  assert.equal(simulation.playerCount, 8);
  assert.match(onlineSource, /mikro-sprint-room-v1-/);
  assert.match(onlineSource, /mikro-sprint-server/);
  assert.match(onlineSource, /kind: "input"/);
  assert.match(onlineSource, /type: "probe"/);
  assert.match(page, /id="online-create"/);
  assert.match(page, /id="online-join"/);
  assert.match(page, /multiplayer\.js\?v=__BUILD_SHA__/);
});

test("Online bot configuration is independent of arriving players", () => {
  const simulation = dedicated(2);
  assert.equal(simulation.join("first"), 1);
  assert.equal(simulation.snapshot().cars.length, 3);
  assert.equal(simulation.snapshot().cars.filter(car => !car.human).length, 2);
  for (let n = 1; n < 6; n++) simulation.join("next-" + n);
  assert.equal(simulation.snapshot().cars.length, 8);
  assert.equal(simulation.snapshot().cars.filter(car => !car.human).length, 2);
  simulation.join("seventh");
  assert.equal(simulation.snapshot().cars.filter(car => !car.human).length, 1);
  simulation.join("eighth");
  assert.equal(simulation.snapshot().cars.filter(car => !car.human).length, 0);
});

test("server camera ignores the last driver and eliminates cars that leave the screen", () => {
  const simulation = dedicated(1);
  simulation.join("stationary-driver", "pool");
  const start = simulation.snapshot();
  assert.equal(start.cars.length, 2);
  assert.equal(start.cars.every(car => car.eliminated === false), true);
  assert.ok(start.camera.scale >= 1 && start.camera.scale <= 2.2);
  for (let i = 0; i < 240; i++) simulation.tick(1 / 60);
  assert.equal(simulation.snapshot().phase, "racing");
  // The bot races away; the stationary rear driver must not hold the camera back.
  for (let i = 0; i < 800 && simulation.snapshot().phase !== "finished"; i++)
    simulation.tick(1 / 60);
  const result = simulation.snapshot();
  assert.equal(result.phase, "finished");
  assert.equal(result.winnerId, 1);
  assert.equal(result.cars[0].eliminated, true);
  assert.equal(result.cars[1].eliminated, false);
  assert.ok(result.camera.x > start.camera.x || result.camera.y !== start.camera.y);
  assert.ok(result.camera.scale >= 1 && result.camera.scale <= 2.2);
});

test("camera follows exactly the top two active cars within 20 car lengths", () => {
  // Expose the actual camera helpers in the VM without changing production code.
  const probeSource = gameSource.replace(
    '  if (dedicatedMode) {\n    humans = 0;',
    '  window.cameraProbe = { setCars(next) { cars = next; }, ' +
      'setViewport(w, h) { viewW = w; viewH = h; }, cameraTarget, cameraBounds, camera };\n' +
      '  if (dedicatedMode) {\n    humans = 0;'
  );
  assert.notEqual(probeSource, gameSource);
  const node = () => ({ getContext: () => ({}), addEventListener() {} });
  const window = { __MIKRO_SPRINT_DEDICATED__: true, addEventListener() {} };
  runInNewContext(probeSource, {
    window, document: { querySelector: node, querySelectorAll: () => [], addEventListener() {} },
    navigator: { getGamepads: () => [] }, performance: { now: () => 0 }
  });
  const probe = window.cameraProbe;
  const leaders = [
    { id: 0, x: 700, y: 500, raceProgress: 5, eliminated: false },
    { id: 1, x: 900, y: 550, raceProgress: 4, eliminated: false }
  ];
  probe.setCars([...leaders,
    { id: 2, x: 20, y: 20, raceProgress: 3, eliminated: false },
    { id: 3, x: 1530, y: 920, raceProgress: 2, eliminated: false }
  ]);
  const firstTarget = probe.cameraTarget();
  assert.equal(firstTarget.x, 800);
  assert.equal(firstTarget.y, 525);
  assert.ok(firstTarget.scale >= 1 && firstTarget.scale <= 2.2);
  probe.setCars([...leaders,
    { id: 2, x: 1550, y: 900, raceProgress: 3, eliminated: false },
    { id: 3, x: 10, y: 10, raceProgress: 2, eliminated: false }
  ]);
  assert.deepEqual([probe.cameraTarget().x, probe.cameraTarget().y],
    [firstTarget.x, firstTarget.y], "trailing cars cannot alter the view");
  probe.setCars([leaders[0], { ...leaders[1], x: 1100, y: 600 }]);
  assert.equal(probe.cameraTarget().x, 900, "second place influences the center");

  for (const [width, height] of [[1200, 700], [390, 844], [667, 375], [320, 640]]) {
    probe.setViewport(width, height);
    for (const scale of [1, 1.5, 2.2]) {
      probe.camera.scale = scale;
      const { halfW, halfH } = probe.cameraBounds();
      assert.ok(Math.max(2 * halfW, 2 * halfH) <= 20 * 47 + 0.00001,
        "the longest visible axis cannot exceed 20 car lengths");
    }
  }
});
