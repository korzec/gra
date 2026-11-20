const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/host-worker.js'), 'utf8');

function harness() {
  const messages = [], sockets = [], intervals = [];
  class Socket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.handlers = new Map();
      this.readyState = 0;
      this.bufferedAmount = 0;
      this.sent = [];
      sockets.push(this);
    }
    addEventListener(name, cb) { this.handlers.set(name, cb); }
    send(message) { this.sent.push(JSON.parse(message)); }
    open() { this.readyState = 1; this.handlers.get('open')(); }
    receive(data) { this.handlers.get('message')({ data: JSON.stringify(data) }); }
    close() {
      this.readyState = 3;
      this.handlers.get('close')?.();
    }
  }
  const self = {
    postMessage(message) { messages.push(message); },
    onmessage: null
  };
  runInNewContext(source, {
    self,
    WebSocket: Socket,
    setInterval(fn, ms) { const handle = { fn, ms, active: true }; intervals.push(handle); return handle; },
    clearInterval(handle) { handle.active = false; }
  });
  return {
    messages, sockets, intervals,
    send(message) { self.onmessage({ data: message }); }
  };
}

test('host worker owns WebSocket connection, joins and requests snapshots', () => {
  const h = harness();
  h.send({ type: 'connect', url: 'wss://example.com/ws', game: 'nocny-kurs', key: 'nocny-kurs-room-v1-ABCDEF' });
  assert.equal(h.sockets.length, 1);
  assert.equal(h.sockets[0].url, 'wss://example.com/ws');
  h.sockets[0].open();
  assert.equal(h.sockets[0].sent[0].type, 'join');
  assert.equal(h.sockets[0].sent[0].key, 'nocny-kurs-room-v1-ABCDEF');

  h.sockets[0].receive({ type: 'joined', peerId: 'host', peers: [] });
  assert.equal(h.intervals.length, 1);
  assert.equal(h.intervals[0].ms, 1000 / 15);
  assert.ok(h.messages.some(m => m.type === 'snapshot_request'));
  assert.ok(h.messages.some(m => m.type === 'message' && JSON.parse(m.data).type === 'joined'));

  const outbound = JSON.stringify({ type: 'data', payload: { kind: 'snapshot', state: { running: true } } });
  h.send({ type: 'send', data: outbound });
  assert.equal(h.sockets[0].sent[1].type, 'data');
  assert.equal(h.sockets[0].sent[1].payload.kind, 'snapshot');

  h.send({ type: 'close' });
  assert.equal(h.intervals[0].active, false);
  assert.equal(h.sockets[0].readyState, 3);
});

test('host worker enforces transport bounds', () => {
  const h = harness();
  h.send({ type: 'connect', url: 'wss://example.com/ws', game: 'nocny-kurs', key: 'sixletterroomkey' });
  const socket = h.sockets[0];
  socket.open();
  socket.receive({ type: 'joined', peerId: 'host', peers: [] });
  const before = socket.sent.length;
  h.send({ type: 'send', data: 'x'.repeat(16001) });
  assert.equal(socket.sent.length, before);
  socket.bufferedAmount = 256 * 1024;
  h.send({ type: 'send', data: '{"type":"data"}' });
  assert.equal(socket.sent.length, before);
  const requested = h.messages.length;
  h.intervals[0].fn();
  assert.equal(h.messages.length, requested, 'backpressured socket must not request new snapshots');
});
