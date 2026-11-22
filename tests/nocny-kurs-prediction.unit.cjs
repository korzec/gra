const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function create() {
  const window = {};
  runInNewContext(readFileSync('nocny-kurs/client-prediction.js', 'utf8'), { window });
  return window.NocnyKursGuestPrediction.create();
}

test('remote car interpolates server timeline across delayed snapshot packets', () => {
  const p = create();
  let cars = p.reconcile('car', [], [{ id: 7, x: 0, y: 0, angle: 3.05 }], 100);
  cars = p.reconcile('car', cars, [{ id: 7, x: 60, y: 0, angle: -3.05 }], 106);
  assert.equal(cars[0].x, 0, 'second snapshot must not teleport remote car');
  let previous = 0;
  for (let i = 0; i < 7; i++) {
    p.advance('car', cars, 1 / 60);
    assert.ok(cars[0].x >= previous, 'movement must be monotonic during interpolation');
    previous = cars[0].x;
  }
  assert.ok(cars[0].x > 0 && cars[0].x <= 160);
  assert.ok(Math.abs(cars[0].angle) > 2.5, 'angles interpolate across the ±π boundary');
});

test('remote extrapolation is capped after a stalled connection', () => {
  const p = create();
  let cars = p.reconcile('car', [], [{ id: 1, x: 0, y: 0, angle: 0 }], 1);
  cars = p.reconcile('car', cars, [{ id: 1, x: 40, y: 0, angle: 0 }], 7);
  for (let i = 0; i < 240; i++) p.advance('car', cars, 1 / 60);
  assert.ok(cars[0].x <= 140.1, 'remote car stops after no more than 200 ms extrapolation');
});

test('own player keeps predicted position and eases authoritative error', () => {
  const p = create();
  let players = [{ id: 1, x: 13, y: 0, alive: true, carId: null }];
  players = p.reconcile('player', players,
    [{ id: 1, x: 20, y: 0, alive: true, carId: null }], 10, new Map(), new Set([1]));
  assert.equal(players[0].x, 13);
  p.advance('player', players, 1 / 60, new Set([1]));
  assert.ok(players[0].x > 13 && players[0].x < 20);
});

test('late/out-of-order snapshots never replace newer remote state', () => {
  const p = create();
  let players = p.reconcile('guard', [], [{ id: 1, x: 100, y: 100 }], 100);
  players = p.reconcile('guard', players, [{ id: 1, x: 115, y: 100 }], 103);
  const tick = players[0]._playbackTick;
  players = p.reconcile('guard', players, [{ id: 1, x: 0, y: 0 }], 101);
  assert.equal(players[0]._playbackTick, tick);
  assert.notEqual(players[0].x, 0);
});
