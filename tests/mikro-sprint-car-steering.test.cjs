const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const source = readFileSync(resolve(__dirname, "../mikro-sprint/game.js"), "utf8");
const helper = source.match(/  function steerCarRelative\(car, steer, dt, turnRate\) \{[\s\S]*?\n  \}/);
assert.ok(helper, "car-relative steering helper must exist");
const math = {
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  Math
};
runInNewContext(helper[0] + "\nthis.steer = steerCarRelative;", math);

test("steering turns in the same local direction regardless of compass heading", () => {
  const east = { angle: 0, vx: 140, vy: 0 };
  const west = { angle: Math.PI, vx: -120, vy: 0 };
  math.steer(east, 1, 0.1, 2);
  math.steer(west, 1, 0.1, 2);
  assert.ok(Math.abs(east.angle - 0.2) < 1e-10);
  assert.ok(Math.abs(west.angle - (Math.PI + 0.2)) < 1e-10);
  assert.equal(east.vx, 140, "turning does not reset inertia");
  assert.equal(west.vx, -120);
});

test("left, partial and neutral steering preserve momentum", () => {
  const car = { angle: Math.PI / 2, vx: 80, vy: 90 };
  math.steer(car, -1, 0.1, 2.5);
  assert.ok(Math.abs(car.angle - (Math.PI / 2 - 0.25)) < 1e-10);
  math.steer(car, -0.5, 0.2, 2);
  assert.ok(Math.abs(car.angle - (Math.PI / 2 - 0.45)) < 1e-10);
  const angle = car.angle;
  math.steer(car, 0, 0.2, 3);
  assert.equal(car.angle, angle);
  assert.deepEqual([car.vx, car.vy], [80, 90]);
});

const mapping = source.match(/  const playerKeys = \[[\s\S]*?\n  \];/);
const reader = source.match(/  function readInput\(car\) \{[\s\S]*?\n  \}/);
assert.ok(mapping && reader, "current input mapping and reader must exist");
const world = {
  navigator: { getGamepads: () => [] },
  dedicatedMode: false,
  onlineActive: () => false,
  onlinePlayerSlot: -1,
  Math,
  clamp: math.clamp,
  keys: new Set(),
  touch: { x: 0, y: 0, gas: false, brake: false, fire: false }
};
runInNewContext(mapping[0] + "\n" + reader[0] + "\nthis.readInput = readInput;", world);

test("W/S accelerate and reverse; A/D steer without forcing throttle", () => {
  world.keys.add("w");
  let input = world.readInput({ id: 0, human: true });
  assert.equal(input.dx, 0);
  assert.equal(input.dy, -1);
  assert.equal(input.gas, 1);
  assert.equal(input.brake, 0);
  world.keys.clear();
  world.keys.add("s");
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.dy, 1);
  assert.equal(input.gas, 0);
  assert.equal(input.brake, 1);
  world.keys.clear();
  world.keys.add("d");
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.dx, 1);
  assert.equal(input.gas, 0);
  assert.equal(input.brake, 0);
  world.keys.add("w");
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.dx, 1, "diagonal keyboard steering remains full strength");
  assert.equal(input.dy, -1);
  assert.equal(input.gas, 1);
});

test("touch joystick uses relative steering and independent pedals", () => {
  world.keys.clear();
  world.touch.x = -0.8;
  world.touch.y = -0.6;
  let input = world.readInput({ id: 0, human: true });
  assert.equal(input.dx, -0.8);
  assert.equal(input.gas, 0.6);
  assert.equal(input.brake, 0);
  world.touch.y = 0.6;
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.gas, 0);
  assert.equal(input.brake, 0.6);
  world.touch.x = world.touch.y = 0;
  world.touch.gas = true;
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.gas, 1);
  assert.equal(input.dx, 0);
  world.touch.brake = true;
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.gas, 0, "brake overrides throttle");
  assert.equal(input.brake, 1);
});

test("gamepad stick turns relatively and brake trigger overrides throttle", () => {
  world.touch.gas = world.touch.brake = false;
  world.navigator.getGamepads = () => [{
    connected: true, axes: [0.8, -0.4],
    buttons: Array.from({ length: 8 }, () => ({ pressed: false, value: 0 }))
  }];
  let input = world.readInput({ id: 0, human: true });
  assert.equal(input.dx, 0.8);
  assert.equal(input.dy, -0.4);
  assert.equal(input.gas, 0.4);
  world.navigator.getGamepads = () => [{
    connected: true, axes: [0.8, -0.4],
    buttons: Array.from({ length: 8 }, (_, i) => ({ pressed: i === 1, value: 0 }))
  }];
  input = world.readInput({ id: 0, human: true });
  assert.equal(input.brake, 1);
  assert.equal(input.gas, 0);
});
