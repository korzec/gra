const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const root = resolve(__dirname, '..');
const html = readFileSync(resolve(root, 'grand-t/index.html'), 'utf8');
const css = readFileSync(resolve(root, 'style.css'), 'utf8');
const gestureJs = readFileSync(resolve(root, 'nocny-kurs/mobile-zoom.js'), 'utf8');

test('Nocny Kurs disables mobile viewport scaling without altering other pages', () => {
  assert.match(html, /name="viewport" content="[^"]*maximum-scale=1[^"]*user-scalable=no/);
  assert.match(html, /mobile-zoom\.js\?v=__BUILD_SHA__/);
  assert.match(css, /\.play-page\{[^}]*touch-action:manipulation/);
  assert.match(css, /\.play-page \.night-frame canvas\{touch-action:none\}/);
});

test('Safari pinch gestures are canceled without blocking normal multi-touch controls', () => {
  const listeners = new Map();
  const doc = { addEventListener: (type, callback, options) => listeners.set(type, { callback, options }) };
  runInNewContext(gestureJs, { document: doc });
  for (const type of ['gesturestart', 'gesturechange']) {
    const listener = listeners.get(type);
    assert.ok(listener, type + ' listener should be registered');
    assert.equal(listener.options.passive, false);
    let prevented = false;
    listener.callback({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
  }
  assert.ok(!listeners.has('touchmove'), 'normal touchmove/pointermove must still work');
});
