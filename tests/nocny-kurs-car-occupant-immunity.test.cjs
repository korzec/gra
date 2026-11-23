const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');
const SOURCE_PATH = resolve(__dirname, '../nocny-kurs/game.js');

function harness() {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  const damageStart = source.indexOf('  function damagePlayer(');
  const damageEnd = source.indexOf('  function eject(', damageStart);
  const explosionStart = source.indexOf('  function explodeCar(');
  const explosionEnd = source.indexOf('  function explodeRocket(', explosionStart);
  assert.ok(damageStart >= 0 && damageEnd > damageStart, 'damage helper exists');
  assert.ok(explosionStart >= 0 && explosionEnd > explosionStart, 'car explosion helper exists');
  const context = {
    Math, players: [], cars: [], carDrivers: [], carRespawns: [], explosions: [], lastUi: '',
    pos: p => p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y },
    killPlayer(p) { p.health = 0; p.alive = false; p.car = null },
    eject(p) { p.car = null },
    setGameStatus() {}, renderPlayers() {}, addDeathRemain() {},
    releasePursuitCar() {}, dropCashFromConvoy() {}
  };
  runInNewContext(source.slice(damageStart, damageEnd) + '\n' +
    source.slice(explosionStart, explosionEnd) +
    '\nthis.api = { damagePlayer, explodeCar };', context);
  return { ...context.api, state: context };
}

function player(car = null, x = 0, y = 0) {
  return { x, y, car, alive: true, maxHealth: 3, health: 3,
    hits: 0, damageCooldown: 0, invuln: 0, stun: 0 };
}

test('all ordinary damage sources leave a driver unharmed', () => {
  const { damagePlayer } = harness();
  const vehicle = { x: 0, y: 0, speed: 200 };
  const driver = player(vehicle);
  for (const reason of ['shot', 'ZDERZENIE', 'hitByCar', 'explosion']) {
    assert.equal(damagePlayer(driver, 3, reason), false, reason);
  }
  assert.equal(driver.health, 3);
  assert.equal(driver.hits, 0);
  assert.equal(driver.damageCooldown, 0);
  assert.equal(vehicle.speed, 200, 'blocked damage does not slow the car');
});

test('a player becomes vulnerable immediately after getting out', () => {
  const { damagePlayer } = harness();
  const p = player({ speed: 100 });
  assert.equal(damagePlayer(p, 1, 'shot'), false);
  p.car = null;
  assert.equal(damagePlayer(p, 1, 'shot'), true);
  assert.equal(p.health, 2);
  assert.equal(p.hits, 1);
  assert.equal(damagePlayer(p, 1, 'shot'), false, 'ordinary damage cooldown still applies');
});

test('only the exploding car hurts its occupant, regardless of hit cooldown', () => {
  const h = harness();
  const destroyedCar = { id: 1, x: 0, y: 0, angle: 0, type: 'car',
    health: 0, speed: 0, driver: null, npcInside: false, destroyed: false };
  const otherCar = { id: 2, x: 20, y: 0, angle: 0, type: 'car', speed: 0 };
  const occupant = player(destroyedCar);
  occupant.damageCooldown = 5;
  destroyedCar.driver = occupant;
  const protectedDriver = player(otherCar);
  const pedestrian = player(null, 92, 0);
  h.state.cars.push(destroyedCar, otherCar);
  h.state.players.push(occupant, protectedDriver, pedestrian);
  h.explodeCar(destroyedCar);
  assert.equal(occupant.health, 0, 'exploding occupied car is lethal at point blank range');
  assert.equal(occupant.alive, false);
  assert.equal(occupant.car, null);
  assert.equal(protectedDriver.health, 3, 'another intact car protects its occupant');
  assert.equal(pedestrian.health, 2, 'pedestrians still take splash damage');
  assert.equal(destroyedCar.destroyed, true);
});

test('crashes damage cars but not their drivers directly', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  const driveStart = source.indexOf('  function drive(');
  const driveEnd = source.indexOf('  function updateMedkitTimers(', driveStart);
  assert.ok(driveStart >= 0 && driveEnd > driveStart);
  const drive = source.slice(driveStart, driveEnd);
  assert.match(drive, /damageCarFromCrash\(c,impact\)/);
  assert.doesNotMatch(drive, /damagePlayer\(/);
});
