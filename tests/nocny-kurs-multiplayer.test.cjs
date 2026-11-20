const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { webcrypto } = require('node:crypto');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/multiplayer.js'), 'utf8');

function harness(hash = '') {
  const elements = new Map();
  const sockets = [];
  const intervals = [];
  const timeouts = [];
  const received = { joined: [], left: [], inputs: [], actions: [], snapshots: [], welcome: [], host: 0, guest: 0 };
  const element = id => {
    if (!elements.has(id)) {
      const handlers = new Map();
      elements.set(id, {
        hidden: false, textContent: '', value: '', dataset: {}, attributes: {},
        classList: { add() {}, remove() {} },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(type, handler) { handlers.set(type, handler); },
        trigger(type, data = {}) {
          const handler = handlers.get(type);
          assert.ok(handler, 'missing event handler: ' + id + ' / ' + type);
          return handler({ preventDefault() {}, stopPropagation() {}, key: '', ...data });
        },
        setCustomValidity(message) { this.validation = message; },
        reportValidity() { return false; },
        focus() {}, select() {}
      });
    }
    return elements.get(id);
  };
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      this.handlers = new Map();
      sockets.push(this);
    }
    addEventListener(type, handler) { this.handlers.set(type, handler); }
    open() { this.readyState = 1; this.handlers.get('open')(); }
    receive(data) { this.handlers.get('message')({ data: JSON.stringify(data) }); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.handlers.get('close')?.(); }
  }
  const location = {
    href: 'https://korzec.github.io/gra/nocny-kurs/' + hash,
    hash
  };
  const context = {
    window: {}, location, document: { getElementById: element, execCommand() { return true; } },
    WebSocket: FakeWebSocket, crypto: webcrypto, URL, URLSearchParams, Uint8Array, console,
    navigator: { clipboard: { async writeText() {} } },
    setTimeout(fn) { const t = { fn, active: true }; timeouts.push(t); return t; },
    clearTimeout(t) { t.active = false; },
    setInterval(fn, ms) { const t = { fn, ms, active: true }; intervals.push(t); return t; },
    clearInterval(t) { t.active = false; }
  };
  runInNewContext(source, context);
  const client = context.window.NocnyKursMultiplayer.create({
    onHost() { received.host++; },
    onGuest() { received.guest++; },
    onPeerJoin(peerId) { received.joined.push(peerId); return 2; },
    onPeerLeft(peerId) { received.left.push(peerId); },
    onInput(peerId, data) { received.inputs.push({ peerId, data }); },
    onInteract(peerId) { received.actions.push(peerId); },
    onWelcome(playerId) { received.welcome.push(playerId); },
    onSnapshot(state) { received.snapshots.push(state); },
    makeSnapshot() { return { running: true, players: [], cars: [] }; },
    getInput() { return { dx: 1, dy: 0, fire: true }; }
  });
  return { client, element, sockets, intervals, timeouts, received, location, parseKey: context.window.NocnyKursMultiplayer.parseKey };
}

test('host creates a cryptographic room, sends a join and welcomes remote players', () => {
  const h = harness();
  h.element('multiplayer-host').trigger('click');
  assert.equal(h.client.role, 'host');
  assert.equal(h.received.host, 1);
  assert.equal(h.sockets.length, 1);
  const ws = h.sockets[0];
  assert.equal(ws.url, 'wss://gra.w.korzec-it.pl/ws');
  ws.open();
  assert.equal(ws.sent[0].type, 'join');
  assert.equal(ws.sent[0].game, 'nocny-kurs');
  assert.match(h.element('multiplayer-room-key').value, /^[A-Z]{6}$/);
  assert.equal(ws.sent[0].key, 'nocny-kurs-room-v1-' + h.element('multiplayer-room-key').value);
  assert.ok(h.element('multiplayer-link').value.endsWith('#room=' + h.element('multiplayer-room-key').value));
  ws.receive({ type: 'joined', peerId: 'host-1', peers: [] });
  ws.receive({ type: 'peer_joined', peerId: 'guest-1' });
  assert.deepEqual(h.received.joined, ['guest-1']);
  assert.ok(ws.sent.some(m => m.payload?.kind === 'welcome' &&
    m.payload.to === 'guest-1' && m.payload.playerId === 2 && m.payload.hostId === 'host-1'));
  assert.equal(h.intervals[0].ms, 1000 / 60);
  h.intervals[0].fn();
  assert.ok(ws.sent.some(m => m.payload?.kind === 'snapshot'));
  ws.receive({ type: 'data', from: 'guest-1', payload: { kind: 'input', dx: 1, fire: true } });
  ws.receive({ type: 'data', from: 'guest-1', payload: { kind: 'interact' } });
  ws.receive({ type: 'peer_left', peerId: 'guest-1' });
  assert.deepEqual(h.received.left, ['guest-1']);
  assert.equal(h.received.inputs[0].peerId, 'guest-1');
  assert.deepEqual(h.received.actions, ['guest-1']);
});

test('invitation link autojoins, accepts only host snapshots and relays guest input', () => {
  const key = 'ABCDEF';
  const h = harness('#room=' + key);
  assert.equal(h.client.role, 'guest');
  assert.equal(h.received.guest, 1);
  assert.equal(h.element('start').hidden, true);
  const ws = h.sockets[0];
  ws.open();
  assert.equal(ws.sent[0].key, 'nocny-kurs-room-v1-' + key);
  ws.receive({ type: 'joined', peerId: 'guest-1', peers: ['host-1'] });
  ws.receive({ type: 'data', from: 'host-1', payload: { kind: 'welcome', to: 'guest-1', hostId: 'host-1', playerId: 2 } });
  assert.equal(h.client.playerId, 2);
  assert.equal(h.client.ready, true);
  ws.receive({ type: 'data', from: 'guest-3', payload: { kind: 'snapshot', state: { poisoned: true } } });
  ws.receive({ type: 'data', from: 'host-1', payload: { kind: 'snapshot', state: { running: true } } });
  assert.equal(h.received.snapshots.length, 1);
  assert.equal(h.received.snapshots[0].running, true);
  assert.equal(h.intervals[0].ms, 1000 / 60);
  h.intervals[0].fn();
  assert.ok(ws.sent.some(m => m.payload?.kind === 'input' && m.payload.dx === 1));
  h.client.sendAction();
  assert.ok(ws.sent.some(m => m.payload?.kind === 'interact'));
  ws.receive({ type: 'peer_left', peerId: 'host-1' });
  assert.equal(h.client.ready, false);
  assert.match(h.element('multiplayer-status').textContent, /Gospodarz/);
});

test('manual join accepts either a room key or its invitation URL', () => {
  const h = harness(), key = 'BCDEFG';
  assert.equal(h.parseKey(' https://example.com/nocny-kurs/#room=' + key), key);
  assert.equal(h.parseKey('abcdef'), 'ABCDEF');
  assert.equal(h.parseKey('tooshort'), '');
  assert.equal(h.parseKey('b'.repeat(48)), 'b'.repeat(48)); // Old invitation links still work.
  h.element('multiplayer-key').value = key;
  h.element('multiplayer-join').trigger('click');
  assert.equal(h.client.role, 'guest');
  assert.equal(h.sockets.length, 1);
});

test('joining an abandoned room times out without claiming host authority', () => {
  const h = harness('#room=CDEFGH');
  const ws = h.sockets[0];
  ws.open();
  ws.receive({ type: 'joined', peerId: 'orphan', peers: [] });
  const timer = h.timeouts.find(t => t.active);
  assert.ok(timer);
  timer.fn();
  assert.equal(h.client.role, 'guest');
  assert.equal(h.client.ready, false);
  assert.match(h.element('multiplayer-status').textContent, /nie ma aktywnego gospodarza/);
});

test('room panel collapses on start, reopens on click and remains open through subsequent snapshots', () => {
  const h = harness();
  h.element('multiplayer-host').trigger('click');
  const panel = h.element('multiplayer-room');
  const toggle = h.element('multiplayer-toggle');
  assert.equal(panel.dataset.collapsed, 'false');
  assert.equal(toggle.attributes['aria-expanded'], 'true');

  h.client.setGameRunning(true);
  assert.equal(panel.dataset.collapsed, 'true');
  assert.equal(toggle.attributes['aria-expanded'], 'false');
  assert.equal(toggle.textContent, 'MULTIPLAYER ▾');

  toggle.trigger('click');
  assert.equal(panel.dataset.collapsed, 'false');
  assert.equal(toggle.attributes['aria-expanded'], 'true');

  h.client.setGameRunning(true);
  assert.equal(panel.dataset.collapsed, 'false', 'active-game snapshots must not collapse a manually expanded panel');

  toggle.trigger('click');
  assert.equal(panel.dataset.collapsed, 'true');

  h.client.setGameRunning(false);
  h.client.setGameRunning(true);
  assert.equal(panel.dataset.collapsed, 'true');
});

test('six-character codes are uniformly distributed over uppercase letters and use the relay-compatible key', () => {
  const keys = new Set();
  for (let i = 0; i < 30; i++) {
    const h = harness();
    h.element('multiplayer-host').trigger('click');
    const key = h.element('multiplayer-room-key').value;
    assert.match(key, /^[A-Z]{6}$/);
    keys.add(key);
    h.sockets[0].open();
    assert.equal(h.sockets[0].sent[0].key, 'nocny-kurs-room-v1-' + key);
    assert.ok(h.sockets[0].sent[0].key.length >= 16);
  }
  assert.ok(keys.size > 25);
});
