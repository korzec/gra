const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const src = fs.readFileSync(path.join(__dirname, '../nocny-kurs/game.js'), 'utf8');
function fn(name,next){const start=src.indexOf('  function '+name+'('),end=src.indexOf('  function '+next+'(',start);assert.ok(start>=0&&end>start);return src.slice(start,end)}
const harness = new Function(`
  const PISTOL_PICKUP_AMMO=20,PISTOL_MAX_AMMO=100,MAX_PISTOL_DROPS=64,KNIFE_RANGE=32,KNIFE_COOLDOWN=.48,KNIFE_DAMAGE=1.5;
  let pistolDrops=[],guards=[],carDrivers=[],players=[],bullets=[],muzzleFlashes=[];
  const GUARD_GUNFIRE_MEMORY=3,MAX_MUZZLE_FLASHES=24;
  const pos=p=>p,refreshAmmoHud=()=>{},clearGuardSight=()=>true,raiseWantedLevel=()=>{},setGameStatus=()=>{};
  const addDeathRemain=(p,x,y,npc)=>{if(npc)dropPistol(x,y)};
  const damageCarDriver=(p,n)=>p.hp-=n,damagePlayer=(p,n)=>p.hp-=n;
  ${fn('dropPistol','collectPistolDrops')}
  ${fn('collectPistolDrops','collectBazookaDrops')}
  ${fn('swingKnife','shoot')}
  ${fn('shoot','shootGuard')}
  return {dropPistol,collectPistolDrops,swingKnife,shoot,pistolDrops,carDrivers,players,bullets,setGuards:g=>guards=g,getGuards:()=>guards};
`);
const player=(ammo=0)=>({x:0,y:0,facing:0,pistolAmmo:ammo,bazookaAmmo:0,fireHeld:true,fireCooldown:0,stun:0,alive:true});
test('pistol pickup gives 20 rounds and cannot exceed 100; surplus stays on ground',()=>{
  const h=harness(),p=player();h.dropPistol(0,0);h.collectPistolDrops([p]);assert.equal(p.pistolAmmo,20);assert.equal(h.pistolDrops.length,0);
  p.pistolAmmo=95;h.dropPistol(0,0);h.collectPistolDrops([p]);assert.equal(p.pistolAmmo,100);assert.equal(h.pistolDrops[0][2],15);
  h.collectPistolDrops([p]);assert.equal(h.pistolDrops[0][2],15);
  const second=player();h.collectPistolDrops([second]);assert.equal(second.pistolAmmo,15);assert.equal(h.pistolDrops.length,0);
});
test('dead players and drivers cannot collect pistols',()=>{
  const h=harness(),dead=player(),driver=player();dead.alive=false;driver.car={};h.dropPistol(0,0);h.collectPistolDrops([dead,driver]);assert.equal(dead.pistolAmmo,0);assert.equal(driver.pistolAmmo,0);assert.equal(h.pistolDrops.length,1);
});
test('knife hits a nearby guard without firing and creates a pistol on defeat',()=>{
  const h=harness(),p=player(),g={x:25,y:0,hp:5};h.setGuards([g]);h.shoot(p);assert.equal(g.hp,3.5);assert.equal(h.bullets.length,0);assert.ok(p.knifeSwing>0);
  for(const remaining of [2,.5]){p.fireCooldown=0;h.shoot(p);assert.equal(g.hp,remaining);assert.equal(h.getGuards().length,1);}
  p.fireCooldown=0;h.shoot(p);assert.equal(h.getGuards().length,0);assert.equal(h.pistolDrops[0][2],20);
});
test('knife cannot hit a distant target; pistol consumes ammo and falls back to knife',()=>{
  const h=harness(),p=player(1),g={x:60,y:0,hp:2};h.setGuards([g]);h.shoot(p);assert.equal(p.pistolAmmo,0);assert.equal(h.bullets.length,1);
  p.fireCooldown=0;h.shoot(p);assert.equal(g.hp,2);assert.equal(h.bullets.length,1);
});
test('bazooka retains priority and does not consume pistol ammo',()=>{
  const h=harness(),p=player(20);p.bazookaAmmo=1;h.shoot(p);assert.equal(p.pistolAmmo,20);assert.equal(p.bazookaAmmo,0);assert.equal(h.bullets[0].rocket,true);
});

test('knife deals 1.5 damage to other players and pedestrians',()=>{
  const h=harness(),p=player(),other={...player(),x:20,hp:3};h.players.push(p,other);h.shoot(p);assert.equal(other.hp,1.5);
  h.players.length=0;const npc={x:20,y:0,hp:3};h.carDrivers.push(npc);p.fireCooldown=0;h.shoot(p);assert.equal(npc.hp,1.5);
});
