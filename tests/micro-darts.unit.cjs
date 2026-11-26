const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../mikro-sprint/game.js"), "utf8");

function setup() {
  const marker = "    window.MikroSprintDedicated = {";
  assert.ok(source.includes(marker));
  const instrumented = source.replace(marker, `    window.testHooks = {
      get cars() { return cars; }, get shots() { return shots; },
      get camera() { return camera; }, updateSpectator, resolveDarts,
      updateShots, pointAtDistance, chooseBotLane, dartAim, cameraBounds, updateCar
    };
${marker}`);
  const element = {
    getContext: () => ({}), addEventListener() {},
    classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} }
  };
  const window = { __MIKRO_SPRINT_DEDICATED__: true, __MIKRO_SPRINT_BOTS__: 2, addEventListener() {} };
  const document = { querySelector: () => element, querySelectorAll: () => [], addEventListener() {}, body: element };
  vm.runInNewContext(instrumented, { window, document, navigator: {}, performance: { now: () => 0 } });
  const engine = window.MikroSprintDedicated;
  engine.join("a", "pool"); engine.join("b", "pool");
  const h = window.testHooks, car = h.cars[0], p = h.pointAtDistance(200);
  Object.assign(h.camera, { x: p.x, y: p.y, scale: 1 });
  for (const other of h.cars.slice(1)) Object.assign(other, { x: p.x + 200, y: p.y + 200 });
  car.eliminated = true;
  return { h, car, engine };
}

test("eliminated driver aims and places an authoritative solid dart; cooldown and expiry", () => {
  const { h, car, engine } = setup();
  engine.input("a", { seq: 1, round: 1, dx: 1, dy: 0, fire: false });
  h.updateCar(car, 1 / 60);
  assert.ok(car.aimX > 0);
  assert.equal(car.lastAppliedInputSeq, 1);
  car.aimX = 0;
  engine.input("a", { seq: 2, round: 1, dx: 0, dy: 0, fire: true });
  h.updateCar(car, 1 / 60);
  const dart = engine.snapshot().shots.find(s => s.kind === "dart");
  assert.ok(dart);
  assert.equal(dart.owner, car.id);
  assert.equal(dart.vx, 0);
  assert.equal(dart.life, 8);
  car.aimX = 0.3;
  h.updateCar(car, 1 / 60);
  assert.equal(h.shots.filter(s => s.kind === "dart").length, 1);
  const target = h.cars[1];
  Object.assign(target, { x: dart.x - 20, y: dart.y, vx: 200, vy: 0, angle: 0 });
  h.resolveDarts(target);
  assert.ok(Math.hypot(target.x - dart.x, target.y - dart.y) >= 41.99);
  assert.ok(target.vx < 0);
  h.updateShots(9);
  assert.equal(engine.snapshot().shots.filter(s => s.kind === "dart").length, 0);
});

test("dart cannot be placed under a surviving car; eliminated bots cannot place darts", () => {
  const { h, car } = setup();
  const aim = h.dartAim(car);
  Object.assign(h.cars[1], aim);
  h.updateSpectator(car, 1 / 60, { dx: 0, dy: 0, fire: true });
  assert.equal(h.shots.length, 0);
  const bot = h.cars.find(c => !c.human);
  bot.eliminated = true;
  h.updateSpectator(bot, 1 / 60, { dx: 0, dy: 0, fire: true });
  assert.equal(h.shots.length, 0);
});

test("bot selects an alternate lane when a dart blocks its racing line", () => {
  const { h, car } = setup();
  const bot = h.cars.find(c => !c.human);
  bot.botDistance = 200;
  const p = h.pointAtDistance(290);
  const lane = -21;
  const x = p.x - Math.sin(p.angle) * lane, y = p.y + Math.cos(p.angle) * lane;
  h.shots.push({ kind: "dart", owner: car.id, x, y, life: 8 });
  assert.notEqual(h.chooseBotLane(bot, lane), lane);
});
