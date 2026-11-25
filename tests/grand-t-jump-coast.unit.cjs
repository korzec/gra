const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../nocny-kurs/game.js'),'utf8');
function between(a,b){const i=source.indexOf('  function '+a+'('),j=source.indexOf('  function '+b+'(',i);assert.ok(i>=0&&j>i);return source.slice(i,j)}
test('jump is one hop per press and cannot start inside a car',()=>{
  const {stepJump,jumpHeight}=vm.runInNewContext(between('jumpHeight','walk')+'\n({stepJump,jumpHeight})');
  const p={alive:true};stepJump(p,true,1/60);assert.equal(p.jumpTime,.55);stepJump(p,true,.275);assert.ok(jumpHeight(p)>23);
  stepJump(p,true,.3);assert.equal(p.jumpTime,0);stepJump(p,true,.1);assert.equal(p.jumpTime,0);
  stepJump(p,false,.1);stepJump(p,true,.1);assert.equal(p.jumpTime,.55);
  p.car={};stepJump(p,true,.1);assert.equal(p.jumpTime,0);
});
test('unoccupied car coasts forward and backward, slowing until it stops',()=>{
  let blocked=false;const cars=[];const coast=vm.runInNewContext(between('coastCar','advanceTraffic')+'\ncoastCar',{cars,vehicleSpec:()=>({drag:.98}),carOverlapsAt:()=>false,vehicleBlockedAt:()=>blocked,vehicleAtBoundary:()=>false,damageCarFromCrash(){},hitPedestrians(){}});
  for(const speed of [120,-120]){const c={x:0,y:0,angle:0,speed};coast(c,1/60);assert.equal(Math.sign(c.x),Math.sign(speed));assert.ok(Math.abs(c.speed)<120);blocked=true;coast(c,1/60);assert.equal(c.speed,0);blocked=false}
  assert.match(source,/c.driver=null;p.car=null;p.enterTargetId=null;p.moveTime=0;emitExitDustPuff/);
});
test('jump is sent, applied and serialized',()=>{assert.match(source,/p.netJump=input.jump===true/);assert.match(source,/jumpTime:p.jumpTime\|\|0/);assert.match(source,/stepJump\(p,Boolean\(input.jump\),dt\)/)});
