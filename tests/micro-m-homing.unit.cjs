const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const { performance } = require('node:perf_hooks')
const source = readFileSync(require('node:path').join(__dirname, '../mikro-sprint/game.js'), 'utf8')
function runGame() {
  // Expose only a test fixture inside the VM; production code has no debug mutation API.
  const marker = '  function fire(car) {'
  assert.ok(source.includes(marker))
  const instrumented = source.replace(marker, `  window.testHoming = (eliminated) => {
    cars = [makeCar(0), makeCar(1), makeCar(2)];
    cars[0].weapon = "homing"; cars[0].gun = 2;
    cars[1].raceProgress = 1; cars[2].raceProgress = 2;
    for (const id of eliminated) cars[id].eliminated = true;
    shots = [];
    fire(cars[0]);
    return { shot: shots[0], ammo: cars[0].gun };
  };
` + marker)
  const node = {
    value: '', classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty() {}, removeProperty() {} },
    addEventListener() {}, getContext() { return {} }
  }
  const window = {
    __MIKRO_SPRINT_DEDICATED__: true, __MIKRO_SPRINT_BOTS__: 2,
    addEventListener() {}
  }
  const document = {
    querySelector: () => node, querySelectorAll: () => [],
    getElementById: () => node, addEventListener() {}
  }
  runInNewContext(instrumented, { window, document, performance,
    navigator: { getGamepads: () => [] }, requestAnimationFrame() {} }, { timeout: 1000 })
  return window.testHoming
}
test('homing missile targets the leading active rival without stopping the game', () => {
  const fire = runGame()
  for (const [eliminated, expected] of [[[], 2], [[2], 1], [[1, 2], null]]) {
    const { shot, ammo } = fire(eliminated)
    assert.equal(shot.kind, 'homing')
    assert.equal(shot.targetId, expected)
    assert.ok(Number.isFinite(shot.vx) && Number.isFinite(shot.vy))
    assert.equal(ammo, 1)
  }
})
