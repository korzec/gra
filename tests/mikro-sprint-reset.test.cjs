const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../mikro-sprint/game.js"), "utf8");

const updateSource = source.match(/  function updateCar\(car, dt, inputOverride = null\) \{[\s\S]*?\n  \}/);
assert.ok(updateSource, "updateCar must exist");
function fixture(onRoad = false, pits = []) {
  const context = {
    Math, W: 1000, H: 1000, selectedTrack: "pool",
    course: { roadWidth: 100, pits, objects: [] },
    projectTrack: () => ({ distanceSquared: onRoad ? 0 : 10000 }),
    clamp: (v, low, high) => Math.max(low, Math.min(high, v)),
    steerCarRelative: () => {}, collectPickup: () => {}, fire: () => {},
    resetCar: car => { car.reset = true; }
  };
  const update = vm.runInNewContext(updateSource[0] + "\nupdateCar", context);
  const car = { x: 500, y: 500, vx: 0, vy: 0, angle: 0, speed: 0,
    human: true, finishAt: null, eliminated: false, trackDistance: 0,
    offroad: 1, invuln: 0, hit: 0, turbo: 0, fireCooldown: 0 };
  const input = { dx: 0, gas: 0, brake: 0, fire: false };
  return { car, step: () => update(car, 1 / 60, input) };
}
test("moving cars never reset off the road, in pits or beyond the recovery boundary", () => {
  for (const [vx, vy] of [[100, 0], [-100, 0], [0, 100]]) {
    for (const hazard of ["offroad", "pit", "edge"]) {
      const { car, step } = fixture(hazard !== "offroad", hazard === "pit" ? [[500, 500]] : []);
      Object.assign(car, { vx, vy, x: hazard === "edge" ? 60 : 500 });
      step();
      assert.equal(car.reset, undefined, hazard);
    }
  }
});
test("stationary cars recover only when a recovery condition is met", () => {
  for (const [onRoad, pits, x, offroad, expected] of [
    [false, [], 500, 1, true], [false, [], 500, 0, undefined],
    [true, [[500, 500]], 500, 0, true], [true, [], 60, 0, true],
    [true, [], 500, 0, undefined]
  ]) {
    const { car, step } = fixture(onRoad, pits);
    Object.assign(car, { x, offroad, vx: 3, vy: 3, speed: 100 });
    step();
    assert.equal(car.reset, expected);
  }
});
test("world edge stops outward movement without teleporting a moving car", () => {
  const { car, step } = fixture();
  Object.assign(car, { x: 999.5, vx: 100, vy: 0 });
  step();
  assert.equal(car.reset, undefined);
  assert.equal(car.x, 1000);
  assert.equal(car.vx, 0);
  step();
  assert.equal(car.reset, true);
});
