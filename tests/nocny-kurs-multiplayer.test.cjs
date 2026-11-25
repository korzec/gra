const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { webcrypto } = require('node:crypto');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/multiplayer.js'), 'utf8');
const localeSource = readFileSync(resolve(__dirname, '../nocny-kurs/locale.js'), 'utf8');
const htmlSource = readFileSync(resolve(__dirname, '../grand-t/index.html'), 'utf8');

function harness(hash = '') {
  const elements = new Map();
  const sockets = [];
  const intervals = [];
  const timeouts = [];
  const copiedLinks = [];
  let clock = 500;
  const received = { joined: [], left: [], inputs: [], actions: [], snapshots: [], traces: [], welcome: [], latencies: [], guest: 0 };
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
    href: 'https://korzec.github.io/gra/grand-t/' + hash,
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

const SERVER_HOST = 'nocny-kurs-server';

function welcome(h, playerId = 1, from = SERVER_HOST) {
  const ws = h.sockets.at(-1);
  const peerId = 'guest-' + h.sockets.length;
  ws.open();
  ws.receive({type:'joined', peerId, hostPeerId:SERVER_HOST, peers:[]});
  ws.receive({type:'data', from, payload:{kind:'welcome', to:peerId, hostId:from, playerId}});
  return ws;
}

test('only local and dedicated-online buttons exist; online creates a server-owned room', () => {
  assert.match(htmlSource, /id="multiplayer-online"[^>]*>Gra online<\/button>/);
  assert.doesNotMatch(htmlSource, /multiplayer-dedicated|multiplayer-host/);
  assert.doesNotMatch(source, /host-worker|openHostWorker|sendSnapshot|role\s*===\s*'host'/);
  const h = harness();
  h.element('multiplayer-online').trigger('click');
  assert.equal(h.client.role, 'guest');
  assert.equal(h.received.guest, 1);
  assert.equal(h.element('start').hidden, true);
  assert.equal(h.element('multiplayer-room').hidden, false);
  const ws = h.sockets[0];
  assert.equal(ws.url, 'wss://gra.w.korzec-it.pl/ws');
  ws.open();
  assert.equal(ws.sent[0].type, 'join');
  assert.equal(ws.sent[0].role, 'dedicated');
  assert.equal(ws.sent[0].game, 'nocny-kurs');
  assert.match(ws.sent[0].sessionId, /^[a-f0-9]{36}$/);
  const key = h.element('multiplayer-room-key').value;
  assert.match(key, /^[A-Z]{6}$/);
  assert.equal(ws.sent[0].key, 'nocny-kurs-room-v1-' + key);
  assert.ok(h.element('multiplayer-link').value.endsWith('#room=' + key));
  ws.receive({type:'joined', peerId:'p1', hostPeerId:SERVER_HOST, peers:[]});
  assert.equal(h.client.ready, false);
  ws.receive({type:'data', from:SERVER_HOST, payload:{
    kind:'welcome', to:'p1', hostId:SERVER_HOST, playerId:1}});
  assert.equal(h.client.ready, true);
  assert.equal(h.client.playerId, 1);
  assert.deepEqual(h.received.welcome,[1]);
});

test('join by code and invitation link always requests dedicated mode', () => {
  const key = 'BCDEFG';
  const h = harness('#room=' + key);
  const ws = h.sockets[0];
  ws.open();
  assert.equal(ws.sent[0].role, 'dedicated');
  assert.equal(ws.sent[0].key, 'nocny-kurs-room-v1-' + key);
  assert.equal(h.parseKey(' https://example.com/nocny-kurs/#room=' + key), key);
  assert.equal(h.parseKey('abcdef'), 'ABCDEF');
  assert.equal(h.parseKey('tooshort'), '');
  const manual = harness();
  manual.element('multiplayer-key').value = key;
  manual.element('multiplayer-join').trigger('click');
  manual.sockets[0].open();
  assert.equal(manual.sockets[0].sent[0].role, 'dedicated');
  assert.equal(manual.sockets[0].sent[0].key, ws.sent[0].key);
  assert.equal(manual.received.guest,1);
});

test('dedicated clients only accept the authoritative server identity', () => {
  const h=harness();
  h.element('multiplayer-online').trigger('click');
  const ws=h.sockets[0];
  ws.open();
  ws.receive({type:'joined',peerId:'p1',hostPeerId:SERVER_HOST,peers:[]});
  ws.receive({type:'data',from:'other-client',
    payload:{kind:'welcome',to:'p1',hostId:'other-client',playerId:1}});
  assert.equal(h.client.ready,false);
  ws.receive({type:'peer_joined',peerId:'other-client',isHost:true});
  assert.equal(h.client.ready,false);
  ws.receive({type:'data',from:SERVER_HOST,
    payload:{kind:'welcome',to:'p1',hostId:SERVER_HOST,playerId:1}});
  assert.equal(h.client.ready,true);
  ws.receive({type:'data',from:'other-client',
    payload:{kind:'snapshot',state:{poisoned:true}}});
  ws.receive({type:'data',from:SERVER_HOST,
    payload:{kind:'snapshot',state:{running:true}}});
  assert.equal(h.received.snapshots.length,1);
  assert.equal(h.received.snapshots[0].running,true);
  const traces={skidMarks:[[100,200,500,0]],deathRemains:[]};
  ws.receive({type:'data',from:'other-client',payload:{kind:'traces',traces}});
  ws.receive({type:'data',from:SERVER_HOST,payload:{kind:'traces',traces}});
  assert.equal(h.received.traces.length,1);
  const inputTimer=h.intervals.find(t=>t.ms===1000/60);
  assert.ok(inputTimer);
  inputTimer.fn();
  assert.ok(ws.sent.some(m=>m.payload?.kind==='input'&&m.payload.dx===1));
  h.client.sendAction();
  assert.ok(ws.sent.some(m=>m.payload?.kind==='interact'));
  assert.ok(ws.sent.every(m=>m.payload?.kind!=='snapshot'&&m.payload?.kind!=='welcome'));
});

test('joining a legacy browser-hosted room is rejected', () => {
  const h=harness('#room=ABCDEF');
  const ws=h.sockets[0];ws.open();
  ws.receive({type:'joined',peerId:'p1',hostPeerId:'browser-host',peers:['browser-host']});
  assert.equal(h.client.ready,false);
  assert.match(h.element('multiplayer-status').textContent,/dedicated_server_required/);
  assert.equal(ws.readyState,3);
});

test('joining without server welcome retries rather than claiming host authority', () => {
  const h=harness('#room=ABCDEF');
  const ws=h.sockets[0];ws.open();
  ws.receive({type:'joined',peerId:'p1',peers:[]});
  const timeout=h.timeouts.find(t=>t.active);
  assert.ok(timeout);timeout.fn();
  assert.equal(h.client.ready,false);
  const retry=h.timeouts.find(t=>t.active&&t!==timeout);
  assert.ok(retry);retry.fn();
  assert.equal(h.sockets.length,2);
  h.sockets[1].open();
  assert.equal(h.sockets[1].sent[0].role,'dedicated');
});

test('top bar shows room code and copy online, with permanent menu and settings', async () => {
  const roomMarkup=htmlSource.split('<div id="multiplayer-room"')[1]?.split('</div>')[0]||'';
  assert.equal((roomMarkup.match(/<button /g)||[]).length,1);
  assert.match(roomMarkup,/id="gt-room-code"/);
  assert.match(roomMarkup,/id="multiplayer-copy"/);
  const headerMarkup=htmlSource.split('<header class="topbar gt-topbar">')[1]?.split('</header>')[0]||'';
  assert.match(headerMarkup,/id="multiplayer-leave"/);
  assert.match(headerMarkup,/id="gt-settings-open"/);
  const h=harness();h.element('multiplayer-online').trigger('click');
  const panel=h.element('multiplayer-room');
  assert.equal(panel.hidden,false);
  assert.equal(h.element('gt-room-code').textContent,h.element('multiplayer-room-key').value);
  h.client.setGameRunning(true);
  await h.element('multiplayer-copy').trigger('click');
  assert.deepEqual(h.copiedLinks,[h.element('multiplayer-link').value]);
  assert.match(h.element('multiplayer-status').textContent,/Link skopiowany/);
  h.element('multiplayer-leave').trigger('click');
  assert.equal(h.location.href,'https://korzec.github.io/gra/grand-t/');
});

test('fresh online sessions generate unique uppercase six-letter codes', () => {
  const keys=new Set();
  for(let i=0;i<30;i++){
    const h=harness();h.element('multiplayer-online').trigger('click');
    const key=h.element('multiplayer-room-key').value;
    assert.match(key,/^[A-Z]{6}$/);
    keys.add(key);h.sockets[0].open();
    assert.equal(h.sockets[0].sent[0].role,'dedicated');
    assert.equal(h.sockets[0].sent[0].key,'nocny-kurs-room-v1-'+key);
  }
  assert.ok(keys.size>25);
});

test('server ping replies update latency; browser clients cannot spoof them', () => {
  const h=harness('#room=ABCDEF');
  const ws=welcome(h);
  ws.receive({type:'data',from:'other',payload:{kind:'pong',to:'guest-1',sentAt:400}});
  assert.equal(h.received.latencies.length,0);
  ws.receive({type:'data',from:SERVER_HOST,payload:{kind:'pong',to:'guest-1',sentAt:400}});
  assert.deepEqual(h.received.latencies,[100]);
  const input=h.intervals.find(t=>t.ms===1000/60);
  for(let i=0;i<120;i++)input.fn();
  assert.equal(ws.sent.filter(m=>m.payload?.kind==='ping').length,1);
});

test('multiplayer status follows Swedish locale without reconnecting', () => {
  const h=harness();h.element('multiplayer-online').trigger('click');
  const ws=h.sockets[0];ws.open();
  ws.receive({type:'joined',peerId:'p1',hostPeerId:SERVER_HOST,peers:[]});
  ws.receive({type:'data',from:SERVER_HOST,payload:{kind:'welcome',to:'p1',hostId:SERVER_HOST,playerId:1}});
  h.locale.setLocale('sv');
  assert.match(h.element('multiplayer-status').textContent,/du spelar som P1/);
  assert.equal(h.sockets.length,1);
});

test('dedicated client detects a silent relay and reconnects without changing room', () => {
  const h=harness();h.element('multiplayer-online').trigger('click');
  const ws=h.sockets[0];ws.open();
  const original=ws.sent[0];
  ws.receive({type:'joined',peerId:'old',hostPeerId:SERVER_HOST,peers:[]});
  ws.receive({type:'data',from:SERVER_HOST,payload:{kind:'welcome',to:'old',hostId:SERVER_HOST,playerId:1}});
  const probe=h.intervals.find(t=>t.ms===4000);
  assert.ok(probe);
  h.setClock(15001);probe.fn();
  assert.equal(h.client.ready,false);
  assert.equal(ws.readyState,3);
  const retry=h.timeouts.find(t=>t.active);
  assert.ok(retry);retry.fn();
  assert.equal(h.sockets.length,2);
  const next=h.sockets[1];next.open();
  assert.equal(next.sent[0].role,'dedicated');
  assert.equal(next.sent[0].key,original.key);
  assert.equal(next.sent[0].sessionId,original.sessionId);
  next.receive({type:'joined',peerId:'new',hostPeerId:SERVER_HOST,peers:[]});
  next.receive({type:'data',from:SERVER_HOST,payload:{kind:'welcome',to:'new',hostId:SERVER_HOST,playerId:1}});
  assert.equal(h.client.ready,true);
  assert.deepEqual(h.received.welcome,[1,1]);
});

test('dedicated client reconnects when snapshots stop despite healthy relay', () => {
  const h=harness('#room=ABCDEF');
  const ws=welcome(h);
  const probe=h.intervals.find(t=>t.ms===4000);
  const nonce=ws.sent.find(m=>m.type==='probe').nonce;
  h.setClock(9900);
  ws.receive({type:'probe_ack',nonce});
  probe.fn();
  assert.equal(h.client.ready,false);
  assert.match(h.element('multiplayer-status').textContent,/ponawiam połączenie/);
});
