const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../nocny-kurs/game.js'),'utf8');
function harness(){
  const start=source.indexOf('  function collectAmbulanceRemains('),end=source.indexOf('  function nearestStreet(',start);
  assert.ok(start>=0&&end>start);
  const context={AMBULANCE_TYPE:'ambulance',NPC_REMAIN_LIFETIME:60,deathRemains:[],awardScore(p,amount,category){if(p.score>=20)return false;p.score+=amount;p[category]=(p[category]||0)+1;return true;}};
  vm.runInNewContext(source.slice(start,end)+'\nthis.collect=collectAmbulanceRemains;',context);
  return context;
}
test('player ambulance collects available bodies once, including NPC and player remains',()=>{
  const h=harness(),p={score:0},q={score:0};
  p.car={type:'ambulance',x:0,y:0,driver:p};q.car={type:'ambulance',x:0,y:0,driver:q};
  const body={x:10,y:0,age:0,npc:true,awaitingPickup:true},other={x:48,y:0,age:5,awaitingPickup:true};
  h.deathRemains=[body,other,{x:49,y:0,age:0,awaitingPickup:true},{x:1,y:0,age:60,awaitingPickup:true},{x:1,y:0,age:0,awaitingPickup:false}];
  h.collect([p,q]);h.collect([p,q]);
  assert.equal(p.score,2);assert.equal(p.collectedBodies,2);assert.equal(q.score,0);
  assert.equal(body.collected,true);assert.equal(other.awaitingPickup,false);assert.equal(h.deathRemains[2].awaitingPickup,true);
});
test('only living ambulance drivers can collect and a finished score cannot consume a body',()=>{
  const h=harness(),p={score:0},body={x:0,y:0,age:0,awaitingPickup:true};
  h.deathRemains=[body];
  h.collect([p]);p.car={type:'car',x:0,y:0,driver:p};h.collect([p]);p.car.type='ambulance';p.alive=false;h.collect([p]);p.alive=true;p.car.driver=null;h.collect([p]);p.car.driver=p;p.car.destroyed=true;h.collect([p]);
  assert.equal(p.score,0);assert.equal(body.awaitingPickup,true);
  p.car.destroyed=false;p.score=20;h.collect([p]);assert.equal(body.awaitingPickup,true);
});
test('ambulance signal lights are active for both player and NPC drivers',()=>{
  assert.match(source,/signal=Boolean\(ambulance\.driver\|\|ambulance\.npcInside\)/);
  assert.ok(source.includes('collectAmbulanceRemains(active);'));
});
