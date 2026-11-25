const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
const between = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'weapon shop functions must be present');
  return source.slice(a, b);
};

function createWeaponEngine() {
  const purchase = between('  function refreshAmmoHud(){', '  function enterOrExit(p){');
  const shooting = between('  function shoot(p){', '  function shootGuard(');
  return runInNewContext(`
    (() => {
      let bonusScore=700,lastUi='';
      const refreshCompetitionHud=()=>{},renderPlayers=()=>{};
      let weaponShop={x:0,y:0};
      let running=true;
      let bullets=[],muzzleFlashes=[];
      const BAZOOKA_PRICE=500,BAZOOKA_ROCKETS=100;
      const MAX_MUZZLE_FLASHES=24,GUARD_GUNFIRE_MEMORY=3;
      const dedicatedMode=true;
      const player={id:1,x:0,y:0,alive:true,stun:0,fireHeld:true,
        fireCooldown:0,car:null,facing:0,bazookaAmmo:0,pistolAmmo:1,cash:700};
      const document={querySelector:()=>({textContent:''})};
      const translate=key=>key, multiplayer={role:'solo'};
      const players=[player];
      const pos=p=>p,vehicleSpec=()=>({halfLength:22});
      const statuses=[],setGameStatus=(key,vars)=>statuses.push({key,vars});
      ${purchase}
      ${shooting}
      return {player,buy:()=>buyBazooka(player),shoot:()=>{player.fireCooldown=0;shoot(player)},
        balance:()=>player.cash,bullets:()=>bullets,statuses};
    })()
  `, {Math});
}

test('store is proximity-gated, charges cash once, and grants exactly 100 rockets', () => {
  const game = createWeaponEngine();
  game.player.x=100;
  assert.equal(game.buy(), false);
  game.player.x=0;
  assert.equal(game.buy(), true);
  assert.equal(game.balance(), 200);
  assert.equal(game.player.bazookaAmmo, 100);
  assert.equal(game.buy(), true);
  assert.equal(game.balance(), 200, 'buying again cannot refill or double-charge');
});

test('rocket ammo decrements on every shot and bazooka disappears after shot 100', () => {
  const game = createWeaponEngine();
  game.buy();
  for (let i=0; i<100; i++) {
    game.shoot();
    assert.equal(game.player.bazookaAmmo, 99-i);
    assert.equal(game.bullets()[i].rocket, true);
  }
  assert.equal(game.statuses.at(-1).key, 'bazookaEmpty');
  game.shoot();
  assert.equal(game.player.bazookaAmmo, 0);
  assert.equal(game.bullets()[100].rocket, false, 'remaining pistol automatically returns');
  assert.equal(game.player.pistolAmmo,0);
});

test('rockets detonate in authoritative collision loop and state is synchronized', () => {
  assert.match(source, /function explodeRocket\(rocket\)/);
  assert.match(source, /if\(b\.rocket\)\{const impact=/);
  assert.match(source, /if\(impact&&b\.x>=0.*explodeRocket\(b\)/);
  assert.match(source, /bazookaAmmo:p\.bazookaAmmo\|\|0/);
  assert.match(source, /rocket:Boolean\(b\.rocket\)/);
  assert.match(source, /if\(!closest\)\{buyBazooka\(p\);return\}/);
});
