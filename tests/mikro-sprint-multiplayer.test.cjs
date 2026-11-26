const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { webcrypto } = require("node:crypto");
const { resolve } = require("node:path");

const source = readFileSync(resolve(__dirname, "../mikro-sprint/multiplayer.js"), "utf8");
const HOST = "mikro-sprint-server";

function harness(hash = "#room=ABCDEF", session = new Map(), persistent = new Map()) {
  const elements = new Map();
  const sockets = [];
  const timeouts = [];
  const intervals = [], copiedLinks = [];
  const element = id => {
    if (!elements.has(id)) {
      const handlers = new Map();
      elements.set(id, {
        hidden: false, textContent: "", value: "", classList: { add() {}, remove() {} },
        addEventListener(type, handler) { handlers.set(type, handler); },
        trigger(type, event = {}) {
          const handler = handlers.get(type);
          assert.ok(handler, "missing event handler: " + id + " / " + type);
          return handler({ preventDefault() {}, key: "", ...event });
        },
        setCustomValidity(message) { this.validation = message; },
        reportValidity() {}
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
    open() { this.readyState = 1; this.handlers.get("open")(); }
    receive(message) { this.handlers.get("message")({ data: JSON.stringify(message) }); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close(code = 1000) {
      this.readyState = 3;
      this.handlers.get("close")?.({ code, reason: "" });
    }
  }
  const location = {
    href: "https://korzec.github.io/gra/micro-m/" + hash,
    hash,
    reload() { this.reloaded = true; }
  };
  const context = {
    window: {},
    navigator: { clipboard: { async writeText(value) { copiedLinks.push(value); } } },
    localStorage: { getItem(key) { return persistent.get(key) ?? null; }, setItem(key, value) { persistent.set(key, value); }, removeItem(key) { persistent.delete(key); } },
    sessionStorage: { getItem(key) { return session.get(key) ?? null; }, setItem(key, value) { session.set(key, value); }, removeItem(key) { session.delete(key); } },
    document: { getElementById: element, querySelector() { return null; } },
    location,
    history: {
      replaceState(_state, _title, url) {
        location.href = url;
        location.hash = new URL(url).hash;
      }
    },
    WebSocket: FakeWebSocket,
    crypto: webcrypto,
    Uint8Array,
    URL,
    URLSearchParams,
    performance: { now() { return 100; } },
    setTimeout(fn, ms) { const timer = { fn, ms, active: true }; timeouts.push(timer); return timer; },
    clearTimeout(timer) { timer.active = false; },
    setInterval(fn, ms) { const timer = { fn, ms, active: true }; intervals.push(timer); return timer; },
    clearInterval(timer) { timer.active = false; }
  };
  runInNewContext(source, context);
  const lost = [];
  const client = context.window.MikroSprintMultiplayer.create({ onLost(reason) { lost.push(reason); } });
  return { client, element, sockets, timeouts, intervals, lost, location, copiedLinks };
}

test("server room idle closure reconnects to the same dedicated room", () => {
  const h = harness();
  const first = h.sockets[0];
  first.open();
  const originalJoin = first.sent.find(message => message.type === "join");
  first.receive({ type: "joined", peerId: "p1", hostPeerId: HOST, peers: [] });
  first.receive({ type: "data", from: HOST, payload: { kind: "welcome", to: "p1", playerId: 1 } });

  first.close(4002);

  assert.equal(h.client.ready, false);
  assert.match(h.client.status, /Pokój zamknięty/);
  assert.match(h.client.status, /ponawianie połączenia/);
  assert.equal(h.timeouts.filter(timer => timer.active).length, 1);
  assert.equal(h.sockets.length, 1);
  assert.equal(h.lost.length, 1);

  const retry = h.timeouts.find(timer => timer.active);
  retry.active = false;
  retry.fn();
  assert.equal(h.sockets.length, 2);

  const second = h.sockets[1];
  second.open();
  const reconnectJoin = second.sent.find(message => message.type === "join");
  assert.equal(reconnectJoin.key, originalJoin.key);
  assert.equal(reconnectJoin.sessionId, originalJoin.sessionId);
  assert.equal(reconnectJoin.role, "dedicated");
  second.receive({ type: "joined", peerId: "p2", hostPeerId: HOST, peers: [] });
  second.receive({ type: "data", from: HOST, payload: { kind: "welcome", to: "p2", playerId: 1 } });
  assert.equal(h.client.ready, true);
});

test("manual leave still stops retries", () => {
  const h = harness();
  h.sockets[0].open();
  h.element("online-leave").trigger("click");
  assert.equal(h.location.reloaded, true);
  assert.equal(h.timeouts.filter(timer => timer.active).length, 0);
  assert.equal(h.sockets.length, 1);
});


test('server choice defaults to DWA and Vercel requires session-only opt-in', () => {
  const session = new Map(), persistent = new Map([['sockets-server','vercel']]);
  const initial = harness('', session, persistent);
  const select = initial.element('sockets-server');
  assert.equal(select.value, 'dwa');
  assert.equal(persistent.has('sockets-server'), false);
  select.value = 'vercel';
  select.trigger('change');
  assert.equal(session.get('sockets-server'), 'vercel');
  assert.equal(persistent.has('sockets-server'), false);
  initial.element('online-create').trigger('click');
  assert.equal(initial.sockets[0].url, 'wss://sockets-korzecs-projects.vercel.app/ws');

  const reload = harness('#room=ABCDEF&server=vercel', session, persistent);
  assert.equal(reload.element('sockets-server').value, 'vercel');
  assert.equal(reload.sockets[0].url, 'wss://sockets-korzecs-projects.vercel.app/ws');
  const fresh = harness('#room=ABCDEF', new Map(), persistent);
  assert.equal(fresh.element('sockets-server').value, 'dwa');
  assert.equal(fresh.sockets[0].url, 'wss://gra.w.korzec-it.pl/ws');

  const changeBack = harness('', session, persistent);
  changeBack.element('sockets-server').value = 'dwa';
  changeBack.element('sockets-server').trigger('change');
  assert.equal(session.has('sockets-server'), false);
  changeBack.element('online-create').trigger('click');
  assert.equal(changeBack.sockets[0].url, 'wss://gra.w.korzec-it.pl/ws');
});

test('invite links carry the actual non-default server without changing the session preference', async () => {
  const session = new Map();
  const vercel = harness('#room=ABCDEF&server=vercel', session);
  assert.equal(vercel.sockets[0].url, 'wss://sockets-korzecs-projects.vercel.app/ws');
  assert.equal(vercel.element('sockets-server').value, 'vercel');
  assert.equal(session.has('sockets-server'), false);
  // Changing options cannot change the server of an already joined room.
  vercel.element('sockets-server').value = 'dwa';
  vercel.element('sockets-server').trigger('change');
  await vercel.element('online-copy').trigger('click');
  assert.match(vercel.copiedLinks[0], /#room=ABCDEF&server=vercel$/);
  const pasted = harness('', session);
  pasted.element('online-key').value = vercel.copiedLinks[0];
  pasted.element('online-join').trigger('click');
  assert.equal(pasted.sockets[0].url, 'wss://sockets-korzecs-projects.vercel.app/ws');
  assert.equal(session.has('sockets-server'), false);

  const optedIn = new Map([['sockets-server','vercel']]);
  const dwa = harness('#room=ABCDEF', optedIn);
  assert.equal(dwa.sockets[0].url, 'wss://gra.w.korzec-it.pl/ws');
  assert.equal(optedIn.get('sockets-server'), 'vercel');
  await dwa.element('online-copy').trigger('click');
  assert.match(dwa.copiedLinks[0], /#room=ABCDEF$/);

  const unknown = harness('#room=ABCDEF&server=wss%3A%2F%2Fevil.example', optedIn);
  assert.equal(unknown.sockets[0].url, 'wss://gra.w.korzec-it.pl/ws');
  const bare = harness('', optedIn);
  bare.element('online-key').value = 'ABCDEF';
  bare.element('online-join').trigger('click');
  assert.equal(bare.sockets[0].url, 'wss://sockets-korzecs-projects.vercel.app/ws');
});
