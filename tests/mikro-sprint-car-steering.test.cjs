const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const code = readFileSync(resolve(__dirname, "../mikro-sprint/game.js"), "utf8");
const helper = code.match(/  function steerCarToward\(car, dx, dy, dt, turnRate\) \{[\s\S]*?\n  \}/);
assert.ok(helper, "world-space steering helper must exist");
const math = {
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  angleWrap: delta => Math.atan2(Math.sin(delta), Math.cos(delta)),
  Math
};
runInNewContext(helper[0] + "\nthis.steer = steerCarToward;", math);

test("vehicle steers toward absolute world direction from different headings", () => {
  const eastFacing = { angle: 0, vx: 140, vy: 0 };
  const westFacing = { angle: Math.PI, vx: -120, vy: 0 };
  math.steer(eastFacing, 0, 1, 0.1, 2);
  math.steer(westFacing, 0, 1, 0.1, 2);
  assert.ok(eastFacing.angle > 0, "car initially facing east turns toward south");
  assert.ok(westFacing.angle < Math.PI, "car initially facing west turns toward south");
  assert.equal(eastFacing.vx, 140, "turning does not reset inertia");
  assert.equal(westFacing.vx, -120);
});

test("world steering limits rotation and neutral input preserves heading", () => {
  const car = { angle: Math.PI / 2, vx: 80, vy: 90 };
  math.steer(car, 1, 0, 0.1, 2.5);
  assert.ok(Math.abs(car.angle - (Math.PI / 2 - 0.25)) < 1e-10);
  const angle = car.angle;
  math.steer(car, 0, 0, 0.2, 3);
  assert.equal(car.angle, angle);
  assert.deepEqual([car.vx, car.vy], [80, 90]);
});

test("steering crosses the +/- pi boundary via shortest rotation", () => {
  const car = { angle: Math.PI - 0.05 };
  const target = -Math.PI + 0.05;
  math.steer(car, Math.cos(target), Math.sin(target), 0.1, 4);
  assert.ok(Math.abs(car.angle - (Math.PI + 0.05)) < 1e-10);
});

const mapping = code.match(/  const playerKeys = \[[\s\S]*?\n  \];/);
const reader = code.match(/  function readInput\(car\) \{[\s\S]*?\n  \}/);
assert.ok(mapping && reader, "current input mapping and reader must exist");
const world = {
  navigator: { getGamepads: () => [] },
  dedicatedMode: false,
  onlineActive: () => false,
  onlinePlayerSlot: -1,
  Math,
  keys: new Set(),
  touch: { x: 0, y: 0, gas: false, brake: false, fire: false }
};
runInNewContext(mapping[0] + "\n" + reader[0] + "\nthis.readInput = readInput;", world);

test("WASD keys aim north/south/east/west on the map and apply throttle", () => {
  world.keys.add("w");
  let input = world.readInput({ id: 0, human: true });
  assert.equal(input.dx, 0);
  assert.equal(input.dy, -1);
  assert.equal(input.gas, 1);
  assert.equal(input.brake, 0);
  world.keys.clear();
  world.keys.add("s");
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.dy, 1, "S drives south instead of braking");
  assert.equal(input.gas, 1);
  world.keys.clear();
  world.keys.add("d");
  world.keys.add("w");
  input = world.readInput({ id: 0, human: true });
  assert.ok(Math.abs(Math.hypot(input.dx, input.dy) - 1) < 1e-10);
  assert.ok(input.dx > 0 && input.dy < 0);
});

test("pedal gas and brake remain independent of steering vector", () => {
  world.keys.clear();
  world.touch.x = -0.8;
  world.touch.y = 0.6;
  let input = world.readInput({ id: 0, human: true });
  assert.ok(input.dx < 0 && input.dy > 0);
  assert.equal(input.gas, 1);
  world.touch.x = world.touch.y = 0;
  world.touch.gas = true;
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.gas, 1);
  assert.equal(input.dx, 0);
  world.touch.brake = true;
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.gas, 0, "brake must override directional and pedal throttle");
  assert.equal(input.brake, 1);
});

test("gamepad left stick selects world direction and gamepad brake still works", () => {
  world.touch.gas = world.touch.brake = false;
  world.navigator.getGamepads = () => [{
    connected: true, axes: [0, -1],
    buttons: Array.from({ length: 8 }, () => ({ pressed: false, value: 0 }))
  }];
  let input = world.readInput({ id: 0, human: true });
  assert.equal(input.dx, 0);
  assert.equal(input.dy, -1);
  assert.equal(input.gas, 1);
  world.navigator.getGamepads = () => [{
    connected: true, axes: [0, -1],
    buttons: Array.from({ length: 8 }, (_, i) => ({ pressed: i === 1, value: 0 }))
  }];
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.brake, 1);
  assert.equal(input.gas, 0);
});
