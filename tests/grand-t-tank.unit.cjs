const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../nocny-kurs/game.js'),'utf8');
const fn=name=>{const i=src.indexOf('  function '+name+'('),j=src.indexOf('\n  function ',i+5);assert.ok(i>=0&&j>i);return src.slice(i,j)}
test('tank spawns in a garden, unmanned and with 20 HP',()=>{
 const tank=vm.runInNewContext(fn('tankSpawn')+'\ntankSpawn()',{courtyards:[{kind:'cobble',x:0,y:0,w:200,h:200},{kind:'garden',x:100,y:100,w:100,h:80}],cars:[],vehicleBlockedAt:()=>false,vehicleAtBoundary:()=>false,blockedByPlayer:()=>false});
 assert.equal(tank.type,'tank');assert.equal(tank.x,150);assert.equal(tank.y,140);assert.equal(tank.health,20);assert.equal(tank.npcInside,false);
})
test('tank cannon uses game rockets without consuming personal ammunition',()=>{
 const bullets=[],muzzleFlashes=[],p={id:1,car:{id:7,x:100,y:100,angle:0},pistolAmmo:2,bazookaAmmo:3};
 vm.runInNewContext(fn('shootTank')+'\nshootTank(p)',{p,bullets,muzzleFlashes,MAX_MUZZLE_FLASHES:24,GUARD_GUNFIRE_MEMORY:3});
 assert.equal(bullets[0].rocket,true);assert.equal(bullets[0].carOwnerId,7);assert.equal(p.fireCooldown,1.2);assert.equal(p.pistolAmmo,2);assert.equal(p.bazookaAmmo,3);
})
