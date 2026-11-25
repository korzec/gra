const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/client-prediction.js'), 'utf8');

function engine() {
  const context = { window: {}, Math, Map, Set };
  runInNewContext(source, context);
  return context.window.NocnyKursGuestPrediction.create();
}

test('guest buffers remote snapshots and resumes bounded movement at 60 Hz', () => {
  const guest = engine();
  let visible = guest.reconcile('car', [], [{ id: 1, x: 100, y: 100, angle: 0 }], 100);
  visible = guest.reconcile('car', visible, [{ id: 1, x: 103, y: 100, angle: 0 }], 102);
  assert.equal(visible[0].x, 100, 'network snapshots must not overwrite the current displayed position');
  const before = visible[0].x;
  // A five-tick interpolation buffer trades a short visual delay for jitter tolerance.
  for (let i = 0; i < 12; i++) guest.advance('car', visible, 1 / 60);
  assert.ok(visible[0].x > before + 2, 'car should smoothly resume beyond the buffered timeline');

  const after200ms = visible[0].x;
  for (let i = 0; i < 60; i++) guest.advance('car', visible, 1 / 60);
  assert.ok(visible[0].x < after200ms + 35, 'remote extrapolation must stop without fresh state');
});

test('small authoritative errors are smoothed; large teleports snap immediately', () => {
  const guest = engine();
  let entities = guest.reconcile('player', [], [{ id: 2, x: 10, y: 10, carId: null, alive: true }], 1);
  entities = guest.reconcile('player', entities, [{ id: 2, x: 18, y: 10, carId: null, alive: true }], 2,
    new Map([[2, { x: 20, y: 10 }]]));
  assert.equal(entities[0].x, 10);
  guest.advance('player', entities, 1 / 60, new Set([2]));
  assert.ok(entities[0].x > 10 && entities[0].x < 20, 'first correction should be partial');
  for (let i = 0; i < 30; i++) guest.advance('player', entities, 1 / 60, new Set([2]));
  assert.ok(Math.abs(entities[0].x - 20) < .01, 'correction should converge');

  entities = guest.reconcile('player', entities,
    [{ id: 2, x: 500, y: 600, carId: null, alive: true }], 3);
  assert.equal(entities[0].x, 500);
  assert.equal(entities[0].y, 600);
});

test('car ownership changes and respawns are immediate; entity removals are tracked', () => {
  const guest = engine();
  let entities = guest.reconcile('player', [], [{ id: 2, x: 1, y: 1, carId: null, alive: true }], 1);
  entities = guest.reconcile('player', entities, [{ id: 2, x: 40, y: 30, carId: 7, alive: true }], 2);
  assert.equal(entities[0].x, 40);

  entities = guest.reconcile('player', entities, [], 3);
  assert.equal(entities.length, 0);
  entities = guest.reconcile('player', entities, [{ id: 2, x: 120, y: 80, carId: null, alive: true }], 4);
  assert.equal(entities[0].x, 120);
});

test('input acknowledgement keeps only unconfirmed prediction steps', () => {
  const guest = engine();
  const one = guest.recordInput({ dx: 1, dy: 0 });
  const two = guest.recordInput({ dx: 0, dy: 1 });
  assert.equal(two.seq, one.seq + 1);
  assert.equal(guest.pendingCount, 2);
  const unconfirmed = guest.acknowledge(one.seq);
  assert.equal(unconfirmed.length, 1);
  assert.equal(unconfirmed[0].seq, two.seq);
  assert.equal(guest.pendingCount, 1);
  guest.resetMotion();
  assert.equal(guest.pendingCount, 1, 'resetting display must retain outstanding controls');
  guest.reset();
  assert.equal(guest.pendingCount, 0);
  assert.equal(guest.recordInput({ dx: 0 }).seq, 1);
});

test('host simulation and guest prediction remain separated', () => {
  const game = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
  const html = readFileSync(resolve(__dirname, '../grand-t/index.html'), 'utf8');
  assert.match(game, /if\(multiplayer\.role===['"]guest['"]\)predictGuest\(dt\);else\{simulationTick\+\+;update\(dt\)\}/);
  assert.match(game, /lastAppliedInputSeq:p\.lastAppliedInputSeq\|\|0/);
  assert.match(game, /guestPrediction\.recordInput\(guestInput\(\)\)/);
  assert.ok(html.indexOf('client-prediction.js') < html.indexOf('game.js'));
});
