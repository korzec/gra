const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../nocny-kurs/game.js'),'utf8');
const i=src.indexOf('  function samplePadInput('),j=src.indexOf('  function pollPads(',i);
assert.ok(i>=0&&j>i);
const sample=vm.runInNewContext(src.slice(i,j)+'\nsamplePadInput',{controllerFireButton:7});
const pad=(buttons=[],axes=[0,0])=>({axes,buttons:Array.from({length:8},(_,i)=>({pressed:buttons.includes(i),value:Number(buttons.includes(i))}))});
test('A jumps on foot and accelerates in car; B brakes and reverses',()=>{
  assert.equal(sample(pad([0]),false).jump,true);
  assert.equal(sample(pad([0]),false).fire,false);
  assert.equal(sample(pad([0]),true).dy,-1);
  assert.equal(sample(pad([0]),true).jump,false);
  assert.equal(sample(pad([1]),true).dy,1);
  assert.equal(sample(pad([0,1]),true).dy,1);
  assert.equal(sample(pad([1]),false).action,false);
});
test('X is action, RT fires, and only P1 uses Y to switch weapons',()=>{
  assert.equal(sample(pad([2]),false).action,true);
  assert.equal(sample(pad([2]),false).jump,false);
  assert.equal(sample(pad([3]),true).fire,true);
  assert.equal(sample(pad([3]),false,false,true).fire,false);
  assert.equal(sample(pad([3]),false,false,true).switchWeapon,true);
  assert.equal(sample(pad([3,7]),false,false,true).fire,true);
  assert.equal(sample(pad([7]),false).fire,true);
  assert.equal(sample(pad([],[.7,-.6]),true).dy,-.6);
  assert.equal(sample(pad([],[.1,.1]),false).dx,0);
});
test('local and online use shared mapping',()=>{
  assert.match(src,/samplePadInput\(pad,Boolean\(p.car\),p.padTriggerHeld,p.id===1\)/);
  assert.match(src,/samplePadInput\(pad,Boolean\(own\?\.car\),undefined,isPlayerOne\)/);
  assert.match(src,/if\(x&&!padXLatch.has\(i\)\)/);
});
