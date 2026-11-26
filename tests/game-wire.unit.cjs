const assert = require('node:assert/strict');
const { test } = require('node:test');
const wire = require('../game-wire.js');
const { deflateRawSync } = require('node:zlib');

function snapshot(tick, n = 64) {
  return { tick, phase: 'racing', name: 'Ąström', cars: Array.from({length: n}, (_, id) => ({
    id, name: 'driver ' + id, type: 'car', color: '#88aabb', x: id * 12 + tick * 0.125,
    y: id * 3 + tick * 0.0625, angle: 0.23, speed: 20, health: 10, destroyed: false,
    driverId: null, turnSignal: 0, npcInside: true
  })), shots: [], pickups: [] };
}
function advance(stream, seq, raw, previous) {
  const state = wire.prepare(stream, seq, raw);
  const frame = wire.frame(stream, seq, state, previous);
  return { ...frame, seq, state };
}
test('binary round trip, deltas, deleted fields, array shrink and keyframe resync', () => {
  const receiver = wire.receiver();
  const initial = snapshot(1);
  const first = advance(0, 1, initial);
  assert.deepEqual(receiver.receive(first.bytes).state, wire.normalize(initial));
  const next = snapshot(3);
  delete next.phase;
  next.cars.pop();
  next.shots.push({x: -12.125, y: 2});
  const second = advance(0, 3, next, first);
  assert.deepEqual(receiver.receive(second.bytes).state, wire.normalize(next));
  const third = advance(0, 5, snapshot(5), second);
  const fourth = advance(0, 7, snapshot(7), third);
  const decoded = wire.decode(fourth.bytes);
  if (decoded[3]) assert.equal(receiver.receive(fourth.bytes), null);
  const keyframe = advance(0, 65, snapshot(65), fourth);
  assert.equal(wire.decode(keyframe.bytes)[3], 0);
  const received = receiver.receive(keyframe.bytes);
  received.state.cars[0].x = 999999;
  const later = advance(0, 67, snapshot(67), keyframe);
  assert.deepEqual(receiver.receive(later.bytes).state, wire.normalize(snapshot(67)));
  receiver.reset();
  assert.deepEqual(receiver.receive(first.bytes).state, wire.normalize(initial));
});
test('visual traces retain stable rows and encode insertions/removals in order', () => {
  const receiver = wire.receiver();
  const before = {skidMarks: Array.from({length: 150}, (_, i) => [i, i, 0, 100]), deathRemains: [[4, 5, 0, '#fff', 100, 1]]};
  const first = advance(1, 60, before);
  receiver.receive(first.bytes);
  const after = {skidMarks: before.skidMarks.slice(10).map(r => [...r.slice(0,3),200]), deathRemains: [[4, 5, 0, '#fff', 200, 1]]};
  after.skidMarks.push([170, 2, 1, 0]);
  const second = advance(1, 66, after, first);
  assert.ok(second.bytes.length < first.bytes.length / 5);
  assert.deepEqual(receiver.receive(second.bytes).state, after);
});
test('input sends immediately on changes and periodically for held input, omits unchanged name', () => {
  const messages = [];
  const sender = wire.inputSender((data, binary) => messages.push({data, binary}));
  const input = {kind: 'input', seq: 1, dx: 1, dy: 0, fire: false, name: 'P1'};
  assert.equal(sender.send(input, 0, true), true);
  assert.equal(sender.send({...input, seq: 2}, 16, true), false);
  assert.equal(sender.send({...input, seq: 3}, 100, true), true);
  assert.equal(sender.send({...input, seq: 4, fire: true}, 101, true), true);
  assert.equal(sender.send({...input, seq: 5, fire: false}, 102, true), true);
  assert.equal(wire.decodeInput(messages[0].data).payload.name, 'P1');
  assert.equal(wire.decodeInput(messages[1].data).payload.name, undefined);
  assert.equal(wire.decodeInput(messages[2].data).payload.fire, true);
  assert.equal(wire.decodeInput(messages[3].data).payload.fire, false);
  assert.equal(sender.send({...input, seq: 6}, 103, false), true);
  assert.equal(messages[4].binary, false);
  sender.reset();
  assert.equal(sender.send(input, 104, true), true);
  assert.equal(wire.decodeInput(messages[5].data).payload.name, 'P1');
});
test('reject malformed wire frames and prototype keys', () => {
  assert.throws(() => wire.decode(Uint8Array.of(5, 100)));
  assert.throws(() => wire.decode(Uint8Array.of(7, 255, 255, 255, 255, 127)));
  assert.throws(() => wire.decode(wire.encode(JSON.parse('{"__proto__":{}}'))));
  assert.throws(() => wire.decodeInput(wire.encode([2, 0, {}])));
});
test('report sample raw and deflate-level-1 snapshot size across 60 frames', t => {
  let previous, legacy = 0, compact = 0, legacyZip = 0, compactZip = 0;
  for (let tick = 1; tick <= 120; tick += 2) {
    const raw = snapshot(tick), full = Buffer.from(JSON.stringify({type:'data',from:'nocny-kurs-server',payload:{kind:'snapshot',state:raw}}));
    const frame = advance(0, tick, raw, previous);
    legacy += full.length; compact += frame.bytes.length;
    legacyZip += deflateRawSync(full,{level:1}).length;
    compactZip += frame.bytes.length >= 1024 ? deflateRawSync(frame.bytes,{level:1}).length : frame.bytes.length;
    previous = frame;
  }
  t.diagnostic(JSON.stringify({legacy, compact, legacyZip, compactZip, rawSavings:1-compact/legacy, compressedSavings:1-compactZip/legacyZip}));
  assert.ok(compact < legacy);
});
