const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const root = resolve(__dirname, "..");
const html = readFileSync(resolve(root, "mikro-sprint/index.html"), "utf8");
const css = readFileSync(resolve(root, "mikro-sprint/style.css"), "utf8");
const game = readFileSync(resolve(root, "mikro-sprint/game.js"), "utf8");
const nocnyZoom = readFileSync(resolve(root, "nocny-kurs/mobile-zoom.js"), "utf8");
const zoom = readFileSync(resolve(root, "mikro-sprint/mobile-zoom.js"), "utf8");

test("Mikro Sprint uses the same mobile zoom safeguards as Nocny Kurs", () => {
  assert.match(html, /name="viewport" content="[^"]*minimum-scale=1[^"]*maximum-scale=1[^"]*user-scalable=no/);
  assert.match(html, /mobile-zoom\.js\?v=__BUILD_SHA__/);
  assert.match(css, /touch-action:manipulation/);
  assert.match(css, /#race,\.touch-joystick,\.touch-controls button\s*\{touch-action:none/);
  assert.match(css, /\.overlay\s*\{[^}]*touch-action:pan-y/);
  assert.equal(zoom, nocnyZoom, "Safari gesture protection should match the Nocny Kurs implementation");
  assert.match(game, /addEventListener\(["']touchmove["']/);
  assert.match(game, /\{ capture: true, passive: false \}/);
  assert.match(game, /if \(playing\(\) && event\.cancelable\) event\.preventDefault\(\)/);
});

test("Safari pinch is prevented without canceling multi-finger touchmove", () => {
  const listeners = new Map();
  const doc = { addEventListener: (type, callback, options) => listeners.set(type, { callback, options }) };
  runInNewContext(zoom, { document: doc });
  for (const type of ["gesturestart", "gesturechange"]) {
    const entry = listeners.get(type);
    assert.ok(entry, type);
    assert.equal(entry.options.passive, false);
    let prevented = false;
    entry.callback({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
  }
  assert.ok(!listeners.has("touchmove"));
});
