const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const root = resolve(__dirname, "..");
const html = readFileSync(resolve(root, "nocny-kurs/index.html"), "utf8");
const css = readFileSync(resolve(root, "style.css"), "utf8");
const game = readFileSync(resolve(root, "nocny-kurs/game.js"), "utf8");

test("Nocny Kurs D/R button includes a decorative gear-shift lever beside the letter", () => {
  const button = html.match(/<button data-touch-action="gear"[\s\S]*?<\/button>/);
  assert.ok(button, "touch gear button must exist");
  assert.match(button[0], /<svg class="touch-gear-icon"[^>]*aria-hidden="true"/);
  assert.match(button[0], /<span class="touch-gear-label">D<\/span>/);
  assert.match(css, /\.play-page \.touch-gear-icon\{[^}]*pointer-events:none/);
});

test("updating the selected gear only changes the letter, preserving the icon", () => {
  const helper = game.match(/  function updateTouchGearButton\(\)\{[\s\S]*?\n  \}/);
  assert.ok(helper, "gear button refresh helper exists");
  const letter = { textContent: "D" };
  const icon = { tagName: "svg" };
  const attrs = {};
  const button = {
    dataset: {}, disabled: true, title: "",
    querySelector(selector) {
      if (selector === ".touch-gear-label") return letter;
      return null;
    },
    setAttribute(key, value) { attrs[key] = value; }
  };
  const world = {
    document: { querySelector: selector => selector === '[data-touch-action="gear"]' ? button : null },
    players: [{ id: 1, car: { id: 20 }, alive: true }],
    multiplayer: { role: "host" },
    touchState: { gear: "F" },
    window: { NocnyKursLocale: { locale: "pl" } },
    translate: x => x
  };
  runInNewContext(helper[0] + "\nthis.update = updateTouchGearButton;", world);
  world.update();
  assert.equal(letter.textContent, "D");
  assert.equal(button.disabled, false);
  world.touchState.gear = "R";
  world.update();
  assert.equal(letter.textContent, "R");
  assert.equal(attrs["aria-pressed"], "true");
  assert.equal(button.querySelector(".touch-gear-label"), letter);
  assert.equal(icon.tagName, "svg");
});
