const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');

function convoyEngine() {
  const start = source.indexOf('  function spawnCashConvoy(');
  const end = source.indexOf('  function livingPlayers(', start);
  assert.ok(start >= 0 && end > start, 'convoy simulation helpers are present');
  const helpers = source.slice(start, end);
  return runInNewContext(`
    (() => {
      let cars = [], cashPacks = [], cashConvoyClock = 0, nextCarId = 28;
      const roadsY = [94,390,733,1030,1416,1786,2108], trafficRows = [1,2,4,5];
      const laneOffset = 18, trafficMinX = 92, trafficMaxX = 2708;
      const TRUCK_TYPE = 'volvo-truck', CAR_MAX_HEALTH = 10;
      const CASH_CONVOY_INTERVAL = 60, CASH_CONVOY_LIFETIME = 115, CASH_CONVOY_VALUE = 500;
      const vehicleBlockedAt = () => false, vehicleAtBoundary = () => false;
      const blockedByPlayer = () => false, carOverlapsAt = () => false;
      const vehicleSpec = () => ({trafficSpeed:68});
      const trafficLoop = (y, east) => [[east?2708:92, y]];
      const rnd = (a,b) => (a+b)/2;
      const statuses = [], setGameStatus = status => statuses.push(status);
      ${helpers}
      return {tick:updateCashConvoys,spawnCashConvoy,dropCashFromConvoy,
        cars:()=>cars,packs:()=>cashPacks,statuses};
    })()
  `, { Math });
}

test('convoys spawn after 60 seconds, repeat each minute and despawn after 115 seconds', () => {
  const game = convoyEngine();
  game.tick(59.99);
  assert.equal(game.cars().length, 0);
  game.tick(.01);
  assert.equal(game.cars().length, 1);
  assert.equal(game.cars()[0].type, 'volvo-truck');
  assert.equal(game.cars()[0].cashConvoy, true);
  assert.equal(game.cars()[0].npcInside, true);
  assert.deepEqual(Array.from(game.statuses), ['cashConvoyArrived']);
  game.tick(60);
  assert.equal(game.cars().length, 2, 'a second convoy spawns at 120 seconds');
  game.tick(55);
  assert.equal(game.cars().length, 1, 'the original convoy leaves after 115 seconds');
  game.tick(5);
  assert.equal(game.cars().length, 2, 'third convoy spawns at 180 seconds');
});

test('money convoy carries 500 cash and synchronizes its identity to guests', () => {
  const game = convoyEngine();
  game.tick(60);
  game.dropCashFromConvoy(game.cars()[0]);
  assert.equal(game.packs().length, 1);
  assert.equal(game.packs()[0].value, 500);
  assert.match(source, /if\(c\.cashConvoy\)dropCashFromConvoy\(c\)/);
  assert.match(source, /cashConvoy:Boolean\(c\.cashConvoy\)/);
  assert.match(source, /if\(!running\)return;updateCashConvoys\(dt\)/);
});
