const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');
const source = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
const steer = source.match(/  function steerCarRelative\(c,steering,dt,spec\)\{[\s\S]*?\n  \}/);
assert.ok(steer, 'relative steering helper is present');
const drive = source.slice(source.indexOf('  function drive(p,dx,dy,dt){'), source.indexOf('\n  function updateMedkitTimers'));
assert.ok(drive.startsWith('  function drive('));
const context = {
  Math,
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  vehicleSpec: () => ({ acceleration: 400, drag: .975, forwardSpeed: 420, reverseSpeed: 160, turnRate: 1.5 }),
  updateBrakeLight() {}, emitTireMarks() {}, cars: [],
  vehicleBlockedAt: () => false, vehicleAtBoundary: () => false, hitPedestrians() {},
  TRUCK_TYPE: 'volvo-truck'
};
runInNewContext(steer[0] + '\n' + drive + '\nthis.steer = steerCarRelative;this.driveCar = drive;', context);
test('left and right are relative to the car regardless of world heading', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const c = { angle, speed: 120 };
    context.steer(c, 1, 0.1, context.vehicleSpec());
    assert.ok(c.angle > angle);
    context.steer(c, -1, 0.1, context.vehicleSpec());
    assert.ok(Math.abs(c.angle - angle) < 1e-9);
    assert.equal(c.speed, 120);
  }
});
test('neutral steering holds orientation while car coasts', () => {
  const car = { angle: 1.2, speed: 120, x: 0, y: 0, destroyed: false };
  context.driveCar({ car, stun: 0 }, 0, 0, 0.1);
  assert.equal(car.angle, 1.2);
  assert.ok(car.speed > 0 && car.speed < 120);
});
test('forward accelerates and brake decelerates without reversing', () => {
  const car = { angle: 0, speed: 0, x: 0, y: 0, destroyed: false };
  const p = { car, stun: 0 };
  context.driveCar(p, 0, -1, 0.1);
  assert.ok(car.speed > 0);
  const before = car.speed;
  context.driveCar(p, 0, 1, 0.1);
  assert.ok(car.speed < before);
  for (let i = 0; i < 20; i++) context.driveCar(p, 0, 1, 0.1);
  assert.equal(car.speed, 0);
});
test('guest prediction and local simulation share relative steering and pedal physics', () => {
  assert.match(source, /function predictGuestDrive[\s\S]*?steerCarRelative\(c,dx,dt,spec\)/);
  assert.match(source, /function predictGuestDrive[\s\S]*?brake\*spec.acceleration\*1\.7\*dt/);
  assert.doesNotMatch(source, /steerCarToward/);
});
