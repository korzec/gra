const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');
const SOURCE_PATH = resolve(__dirname, '../nocny-kurs/game.js');

function interactionHarness() {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  const start = source.indexOf('  function carEdgePoint(c,x,y){');
  const end = source.indexOf('  function damageCarDriver(owner,amount){', start);
  assert.ok(start >= 0 && end > start, 'car interaction helpers are present');
  const cars = [];
  let hideCar = false;
  const context = {
    Math, cars, lastUi: '',
    CAR_SELECT_RADIUS: 20, CAR_BOARD_GAP: 12, CAR_CHASE_MAX_DISTANCE: 240,
    clamp: (n, a, b) => Math.min(b, Math.max(a, n)),
    vehicleSpec: () => ({ halfLength: 22, halfWidth: 13 }),
    blocked: (x) => hideCar && x > 8 && x < 20,
    hijackCar: car => { car.npcInside = false },
    buyBazooka: () => false,
    CAR_SELECT_RADIUS: 20, CAR_BOARD_GAP: 12, CAR_CHASE_MAX_DISTANCE: 240,
    renderPlayers() {},
    refreshAmmoHud() {},
    carSidePosition: car => ({ x: car.x - 35, y: car.y }),
    emitExitDustPuff() {}
  };
  runInNewContext(source.slice(start, end) +
    '\nthis.api = { carEdgePoint, carBodyGap, carVisibleFrom, chaseCarInput, enterOrExit };', context);
  return { ...context.api, cars, setObstructed: value => { hideCar = value } };
}

function car(id, x, y) {
  return { id, x, y, angle: 0, type: 'car', driver: null, pursuitOwnerId: null, npcInside: true };
}

test('10 m search is measured to the car edge, not its center', () => {
  const h = interactionHarness();
  const near = car(1, 39, 0); // body edge is 17 units = 8.5 m away
  const far = car(2, 48, 0);  // body edge is 26 units = 13 m away
  h.cars.push(far, near);
  const p = { x: 0, y: 0, alive: true, car: null, enterTargetId: null, moveTime: 0 };
  h.enterOrExit(p);
  assert.equal(p.enterTargetId, near.id);
  assert.equal(p.car, null, 'approach starts before boarding');
});

test('pursuit follows the moving target and boards when near enough', () => {
  const h = interactionHarness();
  const target = car(3, 39, 0);
  h.cars.push(target);
  const p = { x: 0, y: 0, alive: true, car: null, enterTargetId: null, moveTime: 0 };
  h.enterOrExit(p);
  let step = h.chaseCarInput(p, 0, 0, false, h.cars);
  assert.ok(step.dx > 0.99 && Math.abs(step.dy) < 0.01);
  target.y = 25;
  step = h.chaseCarInput(p, 0, 0, false, h.cars);
  assert.ok(step.dy > 0, 'chase direction follows car position updates');
  p.x = 6;p.y = 25;
  h.chaseCarInput(p, 0, 0, false, h.cars);
  assert.equal(p.car, target);
  assert.equal(target.driver, p);
  assert.equal(p.enterTargetId, null);
});

test('manual steering, repeat action, and obstructed visibility prevent unwanted pursuit', () => {
  const h = interactionHarness();
  const target = car(4, 39, 0);
  h.cars.push(target);
  const p = { x: 0, y: 0, alive: true, car: null, enterTargetId: null };
  h.setObstructed(true);
  h.enterOrExit(p);
  assert.equal(p.enterTargetId, null, 'a wall hides the car');
  h.setObstructed(false);
  h.enterOrExit(p);
  assert.equal(p.enterTargetId, target.id);
  h.enterOrExit(p);
  assert.equal(p.enterTargetId, null, 'second interaction cancels');
  h.enterOrExit(p);
  const movement = h.chaseCarInput(p, 0, -1, false, h.cars);
  assert.equal(p.enterTargetId, null);
  assert.equal(movement.dy, -1, 'manual input takes precedence');
});

test('driver uses relative steering and brakes to reverse instead of gears', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  assert.match(source, /steerCarRelative\(c,dx,dt,spec\)/);
  assert.match(source, /throttle=clamp\(-dy,0,1\),brake=clamp\(dy,0,1\)/);
  assert.match(source, /if\(brake>0\)/);
  assert.match(source, /Math\.max\(0,c\.speed-brake\*spec\.acceleration\*1\.7\*dt\)/);
  assert.match(source, /c\.speed-brake\*spec\.acceleration\*\.7\*dt/);
  assert.match(source, /else if\(throttle>0\)/);
  assert.doesNotMatch(source, /steerCarToward/);
});
