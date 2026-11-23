const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const root = resolve(__dirname, "..");
const gameSource = readFileSync(resolve(root, "mikro-sprint/game.js"), "utf8");
const onlineSource = readFileSync(resolve(root, "mikro-sprint/multiplayer.js"), "utf8");
const page = readFileSync(resolve(root, "mikro-sprint/index.html"), "utf8");

function dedicated() {
  const node = () => ({
    value: "", textContent: "", innerHTML: "", hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty() {}, removeProperty() {} },
    getContext: () => ({}),
    addEventListener() {},
    getBoundingClientRect: () => ({ width: 390, height: 844 }),
    setAttribute() {}
  });
  const window = { __MIKRO_SPRINT_DEDICATED__: true, addEventListener() {} };
  const doc = { querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  runInNewContext(gameSource, { window, document: doc,
    navigator: { getGamepads: () => [] }, performance: { now: () => 0 } }, { timeout: 3000 });
  return window.MikroSprintDedicated;
}

test("browser source runs authoritative physics in headless dedicated mode", () => {
  const simulation = dedicated();
  assert.ok(simulation && typeof simulation.tick === "function");
  assert.equal(simulation.join("a", "bath"), 1);
  assert.equal(simulation.join("b", "pool"), 2);
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
  for (let n = 0; n < 4; n++) assert.equal(simulation.join("peer-" + n), n + 1);
  assert.equal(simulation.join("extra"), null);
  simulation.input("extra", { seq: 1, dx: 1, dy: 0, gas: 1 });
  assert.equal(simulation.playerCount, 4);
  assert.match(onlineSource, /mikro-sprint-room-v1-/);
  assert.match(onlineSource, /mikro-sprint-server/);
  assert.match(onlineSource, /kind: "input"/);
  assert.match(onlineSource, /type: "probe"/);
  assert.match(page, /id="online-create"/);
  assert.match(page, /id="online-join"/);
  assert.match(page, /multiplayer\.js\?v=__BUILD_SHA__/);
});
