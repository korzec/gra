const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const root = resolve(__dirname, "..");
const gameSource = readFileSync(resolve(root, "mikro-sprint/game.js"), "utf8");
const onlineSource = readFileSync(resolve(root, "mikro-sprint/multiplayer.js"), "utf8");
const page = readFileSync(resolve(root, "micro-m/index.html"), "utf8");

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

test("server awards round points, preserves them on restart and ends at ten", () => {
  const simulation = dedicated(1);
  simulation.join("stationary-driver", "pool");
  const start = simulation.snapshot();
  assert.equal(start.cars.length, 2);
  simulation.input("stationary-driver", { seq: 1, name: "  Żaneta  " });
  assert.equal(simulation.snapshot().cars[0].name, "Żaneta");
  for (let i = 0; i < 240; i++) simulation.tick(1 / 60);
  assert.equal(simulation.snapshot().phase, "racing");
  let first;
  for (let i = 0; i < 1400 && !(first = simulation.snapshot()).roundResults.length; i++)
    simulation.tick(1 / 60);
  assert.equal(first.phase, "roundEnd");
  assert.equal(first.roundWinnerId, 1);
  assert.equal(first.winnerId, null);
  assert.equal(first.cars[0].eliminated, true);
  assert.equal(first.cars[0].points, 1);
  assert.equal(first.cars[1].points, 2);
  assert.deepEqual(Array.from(first.roundResults, r => r.delta), [2, 1]);
  const winnerPosition = { x: first.cars[1].x, y: first.cars[1].y };
  for (let i = 0; i < 241; i++) simulation.tick(1 / 60);
  const restarted = simulation.snapshot();
  assert.equal(restarted.phase, "countdown");
  assert.equal(restarted.matchRound, 2);
  assert.equal(restarted.cars[0].eliminated, false);
  assert.equal(restarted.cars[0].points, 1);
  assert.equal(restarted.cars[1].points, 2);
  assert.ok(restarted.cars[1].raceProgress > restarted.cars[0].raceProgress,
    "the winner stays ahead of the second row at the next start");
  assert.ok(Math.hypot(restarted.cars[1].x - winnerPosition.x,
    restarted.cars[1].y - winnerPosition.y) < 1);

  let finished;
  for (let i = 0; i < 16000 && (finished = simulation.snapshot()).phase !== "finished"; i++)
    simulation.tick(1 / 60);
  assert.equal(finished.phase, "finished");
  assert.ok(finished.cars.some(c => c.points >= 10));
  assert.ok(Number.isInteger(finished.winnerId));
  for (let i = 0; i < 600; i++) simulation.tick(1 / 60);
  assert.equal(simulation.snapshot().phase, "finished", "match must not restart automatically");
});

test("camera follows exactly the top two active cars within 20 car lengths", () => {
  // Expose the actual camera helpers in the VM without changing production code.
  const probeSource = gameSource.replace(
    '  if (dedicatedMode) {\n    humans = 0;',
    '  window.cameraProbe = { setCars(next) { cars = next; }, ' +
      'setViewport(w, h) { viewW = w; viewH = h; }, ' +
      'cameraTarget, cameraBounds, updateCamera, eliminateOutsideCamera, camera, ' +
      'makeCar, pointAtDistance, updateRaceProgress, raceStandings };\n' +
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
  probe.setViewport(1200, 700);
  probe.setCars([
    { id: 0, x: 1150, y: 500, raceProgress: 8, eliminated: false },
    { id: 1, x: 120, y: 500, raceProgress: 7, eliminated: false }
  ]);
  probe.updateCamera(1 / 60, true);
  const { halfW, halfH } = probe.cameraBounds();
  assert.ok(Math.abs(probe.camera.x - 1150) < halfW - 25,
    "the leader must stay fully visible");
  assert.ok(Math.abs(probe.camera.y - 500) < halfH - 25);
  const winner = probe.eliminateOutsideCamera();
  assert.equal(winner.id, 0, "trailing car is eliminated when it hits the edge");

  const grid = Array.from({ length: 8 }, (_, id) => probe.makeCar(id));
  grid[0].human = true;
  probe.setCars(grid);
  function placeAtDistance(car, distance) {
    const { x, y } = probe.pointAtDistance(distance);
    Object.assign(car, { x, y });
    probe.updateRaceProgress(car);
    assert.ok(Math.abs(car.trackDistance - distance) < 0.001);
  }
  const [driver, nearbyBot, , trailingBot] = grid;
  assert.ok(nearbyBot.trackDistance > trailingBot.trackDistance);
  placeAtDistance(driver, driver.trackDistance + 10);
  placeAtDistance(trailingBot, trailingBot.trackDistance + 50);
  assert.equal(probe.raceStandings()[0].id, driver.id,
    "a bot from a later row stays behind even after travelling farther");
  placeAtDistance(driver, -2);
  placeAtDistance(nearbyBot, 2);
  assert.equal(probe.raceStandings()[0].id, nearbyBot.id, "the overtake crosses the start line");
  placeAtDistance(nearbyBot, -4);
  assert.equal(probe.raceStandings()[0].id, driver.id, "reversing across the line gives back first place");
  placeAtDistance(nearbyBot, 5);

  probe.setViewport(390, 844);
  probe.camera.x = 1450;
  probe.camera.y = 900;
  probe.camera.scale = 2.2;
  const packOrder = probe.raceStandings();
  probe.updateCamera(1 / 60, false, packOrder);
  const portrait = probe.cameraBounds();
  assert.ok(Math.abs(nearbyBot.x - probe.camera.x) < portrait.halfW - 25);
  assert.ok(Math.abs(nearbyBot.y - probe.camera.y) < portrait.halfH - 25);
  probe.eliminateOutsideCamera(packOrder);
  assert.ok(grid.some(car => car.eliminated), "the edge check eliminates trailing cars");
  assert.equal(nearbyBot.eliminated, false, "the leader survives a lagging camera in an eight-car race");
});

test("four-car elimination standings award +2, +1, -1 and -2", () => {
  const probed = gameSource.replace(
    '  if (dedicatedMode) {\n    humans = 0;',
    '  window.scoreProbe = { setCars(v) { cars = v; }, ' +
      'setRacing() { state = "racing"; }, finishRound, getResults() { return roundResults; }, ' +
      'setOrder(v) { eliminationOrder = v; } };\n' +
    '  if (dedicatedMode) {\n    humans = 0;'
  );
  assert.notEqual(probed, gameSource);
  const node = () => ({ getContext: () => ({}), addEventListener() {} });
  const window = { __MIKRO_SPRINT_DEDICATED__: true, addEventListener() {} };
  runInNewContext(probed, {
    window, document: { querySelector: node, querySelectorAll: () => [], addEventListener() {} },
    navigator: { getGamepads: () => [] }, performance: { now: () => 0 }
  });
  const p = window.scoreProbe;
  p.setCars(Array.from({ length: 4 }, (_, id) =>
    ({ id, x: 800, y: 500, raceProgress: 4 - id, points: 0, name: "", human: false })));
  p.setOrder([3, 2, 1]); p.setRacing();
  p.finishRound({ id: 0, x: 800, y: 500 });
  assert.deepEqual(Array.from(p.getResults(), r => r.delta), [2, 1, -1, -2]);
  assert.deepEqual(Array.from(p.getResults(), r => r.points), [2, 1, -1, -2]);
});
