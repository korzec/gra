const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../nocny-kurs/game.js'),'utf8');
const start=src.indexOf('  const MOUSE_AIM_IDLE_MS='),end=src.indexOf('  const touchAvailable=',start);
function harness(role='solo'){
  const held=new Set(),keysets=[['w','a','s','d'],['arrowup','arrowleft','arrowdown','arrowright']];
  const p={id:1,source:'key',sourceId:0,x:0,y:0,alive:true,facing:0};
  const run=new Function('held','keysets','multiplayer','canvas','document','screen',src.slice(start,end)+`
    let running=true;
    return {mouseAimFor,resetMouseAim,sampleMouseAim};
  `);
  let cameraX=0,cameraY=0;
  const api=run(held,keysets,{role},{getBoundingClientRect:()=>({left:0,top:0})},{querySelector:()=>null},(x,y)=>({x:x-cameraX,y:y-cameraY}));
  return {held,p,...api,move:(x,y,now)=>api.sampleMouseAim(p,x,y,now),camera:(x,y)=>{cameraX=x;cameraY=y;}};
}
test('mouse aim lasts one second, locks the heading while walking, and stays active until all direction keys are released',()=>{
  const h=harness();h.move(10,0,0);
  assert.equal(h.mouseAimFor(h.p,1000),0);
  h.held.add('w');h.held.add('s');h.p.y=10;
  assert.equal(h.mouseAimFor(h.p,2500),0);
  h.held.delete('w');h.held.add('a');h.p.x=-15;h.p.facing=Math.PI;
  h.camera(100,30);
  assert.equal(h.mouseAimFor(h.p,2800),0);
  h.move(115,10,2900);
  assert.equal(h.mouseAimFor(h.p,3000),Math.atan2(30,230));
  h.held.delete('a');
  h.held.delete('s');assert.equal(h.mouseAimFor(h.p,3900),Math.atan2(30,230));
  assert.equal(h.mouseAimFor(h.p,3901),null);
  h.held.add('d');assert.equal(h.mouseAimFor(h.p,3902),null);
  h.camera(0,0);h.move(20,10,3903);assert.equal(h.mouseAimFor(h.p,3903),0);
});
test('P2 keys do not keep local P1 aiming, but online P1 can use arrows',()=>{
  const local=harness();local.move(10,0,0);local.held.add('arrowup');
  assert.equal(local.mouseAimFor(local.p,1001),null);
  const online=harness('guest');online.move(10,0,0);online.held.add('arrowup');
  assert.equal(online.mouseAimFor(online.p,1001),0);
  online.p.car={};assert.equal(online.mouseAimFor(online.p,1002),null);
  online.p.car=null;assert.equal(online.mouseAimFor(online.p,1003),null);
});
