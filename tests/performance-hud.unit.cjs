const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function setup() {
  let now = 0;
  const listeners = new Map();
  const element = () => ({
    children: [],
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    setAttribute() {}
  });
  const document = {
    hidden: false,
    createElement: element,
    addEventListener(name, fn) {
      const list = listeners.get(name) || [];
      list.push(fn);
      listeners.set(name, list);
    }
  };
  const window = {};
  vm.runInNewContext(readFileSync(join(__dirname, '..', 'performance-hud.js'), 'utf8'),
    { window, document, performance: { now: () => now } });
  const container = element();
  const report = window.createGamePerformanceHud(container);
  const [rendering, network] = container.children[0].children;
  return {
    metrics: window.GamePerformanceNetwork, report, rendering, network,
    at(value) { now = value; },
    visible(value) {
      document.hidden = !value;
      for (const fn of listeners.get('visibilitychange') || []) fn();
    }
  };
}

test('local games report frame performance and explicitly have no server', () => {
  const h = setup();
  assert.match(h.network.textContent, /PING — ms · JITTER — ms · SERVER LOCAL/);
  for (let i = 0; i <= 40; i++) h.report(i * 16, 2.5);
  assert.equal(h.rendering.textContent, 'FPS 63 · FRAME 16.0 ms · RENDER 2.5 ms');
});

test('probe RTT, smoothed jitter and actual connected version are displayed', () => {
  const h = setup(), m = h.metrics;
  m.reset(true);
  m.joined('sha-0123456789abcdef0123456789abcdef01234567');
  h.at(10); m.sent(1);
  h.at(50); m.ack(1);
  assert.equal(m.snapshot().ping, 40);
  assert.equal(m.snapshot().jitter, null);
  h.at(4000); m.sent(2);
  h.at(4060); m.ack(2);
  assert.equal(m.snapshot().ping, 60);
  assert.equal(m.snapshot().jitter, 20);
  h.at(8000); m.sent(3);
  h.at(8040); m.ack(3);
  assert.equal(m.snapshot().jitter, 20);
  h.report(8040, 3);
  assert.match(h.network.textContent, /PING 40 ms · JITTER 20 ms · SERVER sha-01234567/);
  assert.equal(h.network.title, 'sha-0123456789abcdef0123456789abcdef01234567');
});

test('ignore mismatched probes, stale measurements and hidden-tab latency', () => {
  const h = setup(), m = h.metrics;
  m.joined('dev');
  h.at(1); m.sent(5);
  h.at(51); m.ack(4);
  assert.equal(m.snapshot().ping, null);
  m.ack(5);
  assert.equal(m.snapshot().ping, 50);
  h.at(12052);
  assert.equal(m.snapshot().ping, null);
  m.sent(6);
  h.visible(false);
  h.at(12100); m.ack(6);
  assert.equal(m.snapshot().ping, null);
  h.visible(true);
  assert.equal(m.snapshot().version, 'dev');
  m.reset(true);
  assert.equal(m.snapshot().version, '');
  assert.equal(m.snapshot().ping, null);
  m.joined(undefined);
  h.report(13000, 2);
  assert.match(h.network.textContent, /SERVER —/);
});
