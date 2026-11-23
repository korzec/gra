const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
const helper = source.match(/  function steerCarToward\(c,dx,dy,dt,spec\)\{[\s\S]*?\n  \}/);
assert.ok(helper, 'world-space steering helper is present');

const context = {
  Math,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value))
};
runInNewContext(helper[0] + '\nthis.turn = steerCarToward;', context);
const spec = { turnRate: 2 };

test('car aims at an absolute map direction from either initial heading', () => {
  const fromRight = { angle: 0, speed: 0 };
  const fromLeft = { angle: Math.PI, speed: 0 };
  context.turn(fromRight, 0, 1, 0.1, spec);
  context.turn(fromLeft, 0, 1, 0.1, spec);
  assert.ok(fromRight.angle > 0, 'right-facing car turns toward down');
  assert.ok(fromLeft.angle < Math.PI, 'left-facing car turns toward down');
});

test('steering keeps the previous speed and limits rotation per tick', () => {
  const car = { angle: Math.PI / 2, speed: 150 };
  const maxTurn = 0.1 * spec.turnRate * (1.05 + 1);
  context.turn(car, 1, 0, 0.1, spec);
  assert.ok(Math.abs(car.angle - (Math.PI / 2 - maxTurn)) < 1e-10);
  assert.equal(car.speed, 150);
});

test('neutral input does not change heading and wrapped turns take the short path', () => {
  const car = { angle: 1.2, speed: 30 };
  context.turn(car, 0, 0, 0.1, spec);
  assert.equal(car.angle, 1.2);
  const crossing = { angle: Math.PI - 0.05, speed: 0 };
  const desired = -Math.PI + 0.05;
  context.turn(crossing, Math.cos(desired), Math.sin(desired), 0.1, spec);
  assert.ok(Math.abs(crossing.angle - (Math.PI + 0.05)) < 1e-10);
});

test('local car and guest prediction share the same world-space steering', () => {
  assert.match(source, /function drive\(p,dx,dy,dt\)/);
  assert.match(source, /const previousAngle=c.angle;steerCarToward\(c,dx\*direction,dy\*direction,dt,spec\)/);
  assert.match(source, /function predictGuestDrive[\s\S]*?steerCarToward\(c,dx\*direction,dy\*direction,dt,spec\)/);
  assert.match(source, /drive\(p,dx,dy,dt\)/);
});

test('reverse gear retains world-space controls while moving backward', () => {
  const c = { angle: 0, speed: 0 };
  // With R selected, pointing the stick left keeps the nose right.
  context.turn(c, -(-1), 0, 0.1, spec);
  assert.equal(c.angle, 0);
  assert.match(source, /direction=p\.gear==='R'\?-1:1/);
  assert.match(source, /c\.speed\+=direction\*throttle\*spec\.acceleration\*dt/);
});
