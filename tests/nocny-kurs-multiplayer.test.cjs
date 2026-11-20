const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { webcrypto } = require('node:crypto');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/multiplayer.js'), 'utf8');
const localeSource = readFileSync(resolve(__dirname, '../nocny-kurs/locale.js'), 'utf8');
const htmlSource = readFileSync(resolve(__dirname, '../nocny-kurs/index.html'), 'utf8');

function harness(hash = '') {
  const elements = new Map();
  const sockets = [];
  const intervals = [];
  const timeouts = [];
  const copiedLinks = [];
  let clock = 500;
  const received = { joined: [], left: [], inputs: [], actions: [], snapshots: [], traces: [], welcome: [], latencies: [], host: 0, guest: 0 };
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
    window: {}, location, document: { getElementById: element, execCommand() { return true; }, documentElement: { lang: 'pl' }, querySelectorAll() { return []; } },
    WebSocket: FakeWebSocket, crypto: webcrypto, URL, URLSearchParams, Uint8Array, console,
    performance: { now() { return clock; } },
    navigator: { language: 'pl-PL', clipboard: { async writeText(value) { copiedLinks.push(value); } } },
    localStorage: { getItem() { return null; }, setItem() {} },
    setTimeout(fn) { const t = { fn, active: true }; timeouts.push(t); return t; },
    clearTimeout(t) { t.active = false; },
    setInterval(fn, ms) { const t = { fn, ms, active: true }; intervals.push(t); return t; },
    clearInterval(t) { t.active = false; }
  };
  runInNewContext(localeSource, context);
  runInNewContext(source, context);
  const client = context.window.NocnyKursMultiplayer.create({
    onHost() { received.host++; },
    onGuest() { received.guest++; },
    onPeerJoin(peerId) { received.joined.push(peerId); return 2; },
    onPeerLeft(peerId) { received.left.push(peerId); },
    onInput(peerId, data) { received.inputs.push({ peerId, data }); },
    onInteract(peerId) { received.actions.push(peerId); },
    onWelcome(playerId) { received.welcome.push(playerId); },
    onLatency(ms) { received.latencies.push(ms); },
    onSnapshot(state) { received.snapshots.push(state); },
    onTraces(traces) { received.traces.push(traces); },
    makeSnapshot() { return { running: true, players: [], cars: [] }; },
    makeTraces() { return { skidMarks: [[100, 200, 500, 0]], deathRemains: [[400, 500, 1000, '#d6f36a', 12000]] }; },
    getInput() { return { dx: 1, dy: 0, fire: true }; }
  });
  return { client, element, sockets, intervals, timeouts, received, copiedLinks, location, setClock(value) { clock = value; }, parseKey: context.window.NocnyKursMultiplayer.parseKey, locale: context.window.NocnyKursLocale };
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
  assert.match(h.element('multiplayer-status').textContent, /ponawiam połączenie/);
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
  assert.match(h.element('multiplayer-status').textContent, /ponawiam połączenie/);
  const retry = h.timeouts.find(t => t.active && t !== timer);
  assert.ok(retry, 'room without a host must retry instead of requiring reload');
  retry.fn();
  assert.equal(h.sockets.length, 2);
});

test('multiplayer stays a two-button copy link and disconnect toolbar during gameplay', async () => {
  const roomMarkup = htmlSource.split('<div id="multiplayer-room"')[1]?.split('</div>')[0] || '';
  assert.match(roomMarkup, /id="multiplayer-copy"/);
  assert.match(roomMarkup, /id="multiplayer-leave"/);
  assert.equal((roomMarkup.match(/<button /g) || []).length, 2);
  assert.doesNotMatch(roomMarkup, /multiplayer-toggle|multiplayer-details/);

  const h = harness();
  h.element('multiplayer-host').trigger('click');
  const panel = h.element('multiplayer-room');
  assert.equal(panel.hidden, false);
  h.client.setGameRunning(true);
  assert.equal(panel.hidden, false);
  assert.equal(panel.dataset.collapsed, undefined);
  await h.element('multiplayer-copy').trigger('click');
  assert.deepEqual(h.copiedLinks, [h.element('multiplayer-link').value]);
  assert.match(h.element('multiplayer-status').textContent, /Link skopiowany/);
  h.element('multiplayer-leave').trigger('click');
  assert.equal(h.location.href, 'https://korzec.github.io/gra/nocny-kurs/');
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

test('host answers latency probes and guest accepts only the host response', () => {
  const host = harness();
  host.element('multiplayer-host').trigger('click');
  const server = host.sockets[0];
  server.open();
  server.receive({ type: 'joined', peerId: 'host', peers: [] });
  server.receive({ type: 'data', from: 'guest', payload: { kind: 'ping', sentAt: 350 } });
  assert.ok(server.sent.some(message => message.payload?.kind === 'pong' &&
    message.payload.to === 'guest' && message.payload.sentAt === 350));

  const guest = harness('#room=ABCDEF');
  const client = guest.sockets[0];
  client.open();
  client.receive({ type: 'joined', peerId: 'guest', peers: ['host'] });
  client.receive({ type: 'data', from: 'host',
    payload: { kind: 'welcome', to: 'guest', hostId: 'host', playerId: 2 } });
  client.receive({ type: 'data', from: 'other',
    payload: { kind: 'pong', to: 'guest', sentAt: 400 } });
  assert.equal(guest.received.latencies.length, 0);
  client.receive({ type: 'data', from: 'host',
    payload: { kind: 'pong', to: 'guest', sentAt: 400 } });
  assert.deepEqual(guest.received.latencies, [100]);

  for (let i = 0; i < 120; i++) guest.intervals[0].fn();
  assert.equal(client.sent.filter(m => m.payload?.kind === 'ping').length, 1);
});

test('traces sync at 10 Hz and guests accept only the host trace history', () => {
  const host = harness();
  host.element('multiplayer-host').trigger('click');
  const socket = host.sockets[0];
  socket.open();
  socket.receive({ type: 'joined', peerId: 'host', peers: [] });
  for (let i = 0; i < 6; i++) host.intervals[0].fn();
  const traces = socket.sent.filter(m => m.payload?.kind === 'traces');
  assert.equal(traces.length, 1, 'one visual packet per six 60 Hz snapshots');
  assert.deepEqual(JSON.parse(JSON.stringify(traces[0].payload.traces.skidMarks)), [[100, 200, 500, 0]]);
  socket.receive({ type: 'peer_joined', peerId: 'guest' });
  assert.equal(socket.sent.filter(m => m.payload?.kind === 'traces').length, 2,
    'late joiners get the current complete trace history');

  const guest = harness('#room=ABCDEF');
  guest.sockets[0].open();
  guest.sockets[0].receive({ type: 'joined', peerId: 'guest', peers: ['host'] });
  guest.sockets[0].receive({ type: 'data', from: 'host',
    payload: { kind: 'welcome', to: 'guest', hostId: 'host', playerId: 2 } });
  guest.sockets[0].receive({ type: 'data', from: 'intruder',
    payload: { kind: 'traces', traces: traces[0].payload.traces } });
  assert.equal(guest.received.traces.length, 0);
  guest.sockets[0].receive({ type: 'data', from: 'host',
    payload: { kind: 'traces', traces: traces[0].payload.traces } });
  assert.equal(guest.received.traces.length, 1);
});

test('multiplayer status follows the selected Swedish locale without reconnecting', () => {
  const h = harness();
  h.element('multiplayer-host').trigger('click');
  const socket = h.sockets[0];
  socket.open();
  socket.receive({ type: 'joined', peerId: 'host', peers: [] });
  assert.match(h.element('multiplayer-status').textContent, /Pokój aktywny/);
  h.locale.setLocale('sv');
  assert.match(h.element('multiplayer-status').textContent, /Rummet är aktivt/);
  assert.equal(h.element('start').textContent, 'Spela igen ↗');
  socket.receive({ type: 'peer_joined', peerId: 'guest' });
  assert.match(h.element('multiplayer-status').textContent, /en spelare anslöt/);
});

test('host detects a silent relay when probe acknowledgements stop, then rejoins the same room', () => {
  const h = harness();
  h.element('multiplayer-host').trigger('click');
  const first = h.sockets[0];
  first.open();
  const firstJoin = first.sent[0];
  assert.equal(firstJoin.role, 'host');
  assert.match(firstJoin.sessionId, /^[a-f0-9]{36}$/);
  first.receive({ type: 'joined', peerId: 'host-old', hostPeerId: 'host-old', peers: [] });
  first.receive({ type: 'peer_joined', peerId: 'guest-old' });
  assert.equal(h.received.joined.length, 1);
  assert.equal(h.client.ready, true);

  const probeTimer = h.intervals.find(t => t.active && t.ms === 4000);
  assert.ok(probeTimer, 'live server health must be checked independently of snapshots');
  assert.ok(first.sent.some(message => message.type === 'probe'));
  // Even if readyState continues to report OPEN, a missed 14-second deadline
  // must mark the host offline and remove every orphaned game player.
  h.setClock(15001);
  probeTimer.fn();
  assert.equal(h.client.ready, false);
  assert.deepEqual(h.received.left, ['guest-old']);
  assert.match(h.element('multiplayer-status').textContent, /ponawiam połączenie/);
  assert.equal(first.readyState, 3);
  const retry = h.timeouts.find(t => t.active);
  assert.ok(retry);
  retry.fn();
  const second = h.sockets[1];
  second.open();
  assert.equal(second.sent[0].key, firstJoin.key, 'reconnect retains invitation code');
  assert.equal(second.sent[0].sessionId, firstJoin.sessionId,
    'reconnect must replace a zombie session instead of creating a new identity');
  // A waiting guest can already be in the room when the host returns.
  second.receive({ type: 'joined', peerId: 'host-new', hostPeerId: 'host-new', peers: ['guest-new'] });
  assert.equal(h.client.ready, true);
  assert.deepEqual(h.received.joined, ['guest-old', 'guest-new']);
  assert.ok(second.sent.some(m => m.payload?.kind === 'welcome' &&
    m.payload.to === 'guest-new' && m.payload.hostId === 'host-new'));
  const freshProbe = second.sent.find(m => m.type === 'probe');
  assert.ok(freshProbe);
  second.receive({ type: 'probe_ack', nonce: freshProbe.nonce });
  h.setClock(20000);
  h.intervals.find(t => t.active && t.ms === 4000).fn();
  assert.equal(h.client.ready, true, 'valid probe acknowledgement keeps connection alive');
});

test('guest recovers after connection loss when the new host joined after other guests', () => {
  const h = harness('#room=ABCDEF');
  const first = h.sockets[0];
  first.open();
  first.receive({ type: 'joined', peerId: 'guest-old', hostPeerId: 'host-old', peers: ['host-old'] });
  first.receive({ type: 'data', from: 'host-old',
    payload: { kind: 'welcome', to: 'guest-old', hostId: 'host-old', playerId: 2 } });
  assert.equal(h.client.ready, true);
  first.close();
  assert.equal(h.client.ready, false);
  assert.equal(h.received.guest, 1, 'reconnection must not reset the whole game');

  h.timeouts.find(t => t.active).fn();
  const second = h.sockets[1];
  second.open();
  assert.equal(second.sent[0].sessionId, first.sent[0].sessionId);
  second.receive({ type: 'joined', peerId: 'guest-new', hostPeerId: null, peers: ['another-guest'] });
  second.receive({ type: 'peer_joined', peerId: 'host-new', isHost: true });
  second.receive({ type: 'data', from: 'host-new', payload: {
    kind: 'welcome', to: 'guest-new', hostId: 'host-new', playerId: 2
  } });
  assert.equal(h.client.ready, true);
  assert.equal(h.client.playerId, 2);
  second.receive({ type: 'data', from: 'host-new',
    payload: { kind: 'snapshot', state: { running: true, tick: 1 } } });
  assert.equal(h.received.snapshots.at(-1).tick, 1);
  assert.equal(h.received.guest, 1);
  assert.equal(h.received.welcome.length, 2);
});

test('guest reconnects when host stops sending authoritative snapshots despite healthy relay replies', () => {
  const h = harness('#room=ABCDEF');
  const first = h.sockets[0];
  first.open();
  first.receive({ type: 'joined', peerId: 'guest-old', hostPeerId: 'host-old', peers: ['host-old'] });
  first.receive({ type: 'data', from: 'host-old',
    payload: { kind: 'welcome', to: 'guest-old', hostId: 'host-old', playerId: 2 } });
  const probeTimer = h.intervals.find(t => t.ms === 4000);
  h.setClock(9900);
  const firstProbe = first.sent.find(m => m.type === 'probe');
  first.receive({ type: 'probe_ack', nonce: firstProbe.nonce });
  probeTimer.fn();
  assert.equal(h.client.ready, false);
  assert.match(h.element('multiplayer-status').textContent, /ponawiam połączenie/);
});
