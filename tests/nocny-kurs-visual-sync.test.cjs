const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/visual-sync.js'), 'utf8');
const game = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../nocny-kurs/index.html'), 'utf8');

function create() {
  const context = { window: {} };
  runInNewContext(source, context);
  return context.window.NocnyKursVisualSync.create();
}

function tire(id, age = 0) {
  return { id, x: 100 + id, y: 200, angle: .5, age, lifetime: 2.25 };
}
function remain(id, age = 0) {
  return { id, x: 500 + id, y: 300, facing: .2, bodyFacing: 1.1,
    color: '#d6f36a', playerId: 1, age };
}

test('new effects are sent immediately, while history replay is periodic and bounded', () => {
  const host = create();
  const mark = tire(host.nextMarkId());
  const body = remain(host.nextRemainId());
  const first = host.snapshot([mark], [body]);
  assert.deepEqual([...first.marks.map(x => x.id)], [mark.id]);
  assert.deepEqual([...first.remains.map(x => x.id)], [body.id]);
  assert.notStrictEqual(first.marks[0], mark, 'snapshots do not expose mutable host objects');

  for (let i = 0; i < 4; i++) {
    const snapshot = host.snapshot([mark], [body]);
    assert.equal(snapshot.marks.length, 0);
    assert.equal(snapshot.remains.length, 0);
  }
  const replay = host.snapshot([mark], [body]);
  assert.equal(replay.marks[0].id, mark.id);
  assert.equal(replay.remains[0].id, body.id);
  assert.equal(replay.round, first.round);
});

test('a late joiner receives complete surviving trails and chalk outlines in paged snapshots', () => {
  const host = create(), guest = create();
  const marks = Array.from({ length: 220 }, () => tire(host.nextMarkId(), 1));
  const remains = Array.from({ length: 64 }, () => remain(host.nextRemainId(), 35));
  let localMarks = [], localRemains = [], largestWireSize = 0;
  // The host has already published all original additions before guest joins.
  for (let i = 0; i < 15; i++) host.snapshot(marks, remains);
  for (let i = 0; i < 120; i++) {
    const snapshot = host.snapshot(marks, remains);
    largestWireSize = Math.max(largestWireSize, JSON.stringify(snapshot).length);
    const received = guest.receive(snapshot, localMarks, localRemains);
    localMarks = received.marks;
    localRemains = received.remains;
  }
  assert.equal(localMarks.length, 220);
  assert.equal(localRemains.length, 64);
  assert.ok(largestWireSize < 4000, 'history should not overflow the 16KiB relay packet budget');
  assert.equal(new Set(localMarks.map(x => x.id)).size, localMarks.length);
  assert.equal(new Set(localRemains.map(x => x.id)).size, localRemains.length);
  assert.ok(localRemains.every(x => x.age >= 10), 'chalk phase is retained after late join');
});

test('replays do not reset fade ages or duplicate visible decals', () => {
  const host = create(), guest = create();
  const mark = tire(host.nextMarkId(), 0);
  const body = remain(host.nextRemainId(), 9.8);
  let result = guest.receive(host.snapshot([mark], [body]), [], []);
  const sameMark = result.marks[0], sameBody = result.remains[0];
  sameMark.age = 1.3;
  sameBody.age = 11;
  result = guest.receive({ round: 0, marks: [tire(mark.id, .4)], remains: [remain(body.id, 9.9)] },
    result.marks, result.remains);
  assert.equal(result.marks.length, 1);
  assert.equal(result.remains.length, 1);
  assert.strictEqual(result.marks[0], sameMark);
  assert.strictEqual(result.remains[0], sameBody);
  assert.equal(result.marks[0].age, 1.3);
  assert.equal(result.remains[0].age, 11);
});

test('new round clears tire marks without removing long-lived chalk', () => {
  const host = create(), guest = create();
  const first = host.snapshot([tire(host.nextMarkId())], [remain(host.nextRemainId(), 20)]);
  let result = guest.receive(first, [], []);
  host.nextRound();
  const after = host.snapshot([], [remain(1, 20)]);
  result = guest.receive(after, result.marks, result.remains);
  assert.equal(result.marks.length, 0);
  assert.equal(result.remains.length, 1);
  const stale = guest.receive(first, result.marks, result.remains);
  assert.equal(stale.marks.length, 0, 'stale round cannot reintroduce old tire tracks');
});

test('guest ignores invalid or oversized decal inputs and keeps existing world state', () => {
  const guest = create();
  const bad = { round: 0,
    marks: Array.from({ length: 500 }, (_, i) => tire(i + 1, i === 0 ? NaN : 0)),
    remains: [remain(1, 0), { id: 2, x: Infinity, y: 1, age: 0, bodyFacing: 0 }] };
  const result = guest.receive(bad, [], []);
  assert.ok(result.marks.length <= 64, 'only a bounded number of incoming marks are processed per packet');
  assert.equal(result.remains.length, 1);
});

test('game draws synchronized tire marks and remains and ages them on guests', () => {
  assert.match(game, /id:visualSync\.nextMarkId\(\)/);
  assert.match(game, /id:visualSync\.nextRemainId\(\)/);
  assert.match(game, /visual:visualSync\.snapshot\(skidMarks,deathRemains\)/);
  assert.match(game, /visualSync\.receive\(state\.visual,skidMarks,deathRemains\)/);
  assert.match(game, /function predictGuest\(dt\)\{[\s\S]*?updateTireMarks\(dt\);updateDeathRemains\(dt\)/);
  assert.match(game, /drawSkidMarks\(visible\)/);
  assert.match(game, /drawDeathRemains\(visible\)/);
  assert.ok(html.indexOf('visual-sync.js?v=') < html.indexOf('game.js?v='));
});
