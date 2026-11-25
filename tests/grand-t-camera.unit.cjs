const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../nocny-kurs/game.js'),'utf8');
const start=src.indexOf('  function groupCameraFrame('),end=src.indexOf('  function updateGroupCamera(',start);
assert.ok(start>=0&&end>start);
const frame=vm.runInNewContext(src.slice(start,end)+'\ngroupCameraFrame',{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
const viewport=(width,height)=>({width,height,worldWidth:2800,worldHeight:2200});
function visible(p,f,v){return Math.abs(p.x-f.x)*f.zoom<=v.width/2+1e-8&&Math.abs(p.y-f.y)*f.zoom<=v.height/2+1e-8;}
test('group camera fits every player immediately for landscape and portrait',()=>{
  for(const v of [viewport(1200,700),viewport(390,844),viewport(844,390)]){
    const points=[{x:20,y:25},{x:20+v.width*1.1,y:25+v.height*.7},{x:30,y:30}];
    const f=frame(points,v,{x:2500,y:2000,zoom:1},1/60);
    assert.ok(f.zoom>=.5&&f.zoom<1);
    for(const p of points)assert.ok(visible(p,f,v),'every player visible even after a teleport');
  }
});
test('50 percent is a hard floor and camera remains centered between separated players',()=>{
  const v=viewport(390,844),points=[{x:50,y:50},{x:2700,y:2100}];
  for(const order of [points,[...points].reverse()]){
    const f=frame(order,v,{x:50,y:50,zoom:1},1/60);
    assert.equal(f.zoom,.5);assert.equal(f.x,1375);assert.equal(f.y,1075);
  }
});
test('asymmetric groups are centered on their full bounding rectangle, independent of viewport and player order',()=>{
  const points=[{x:100,y:200},{x:120,y:500},{x:1000,y:300},{x:130,y:250}];
  for(const v of [viewport(1200,700),viewport(390,844)]){
    const f=frame(points,v,{x:0,y:0,zoom:1},1/60);
    assert.equal(f.x,550);assert.equal(f.y,350);
  }
});
test('when players regroup, camera zooms in smoothly and never exceeds 100 percent',()=>{
  const v=viewport(1200,700),p={x:1400,y:1100},points=[p,{x:1450,y:1150}];
  let f=frame(points,v,{...p,zoom:.5},1/60);
  assert.ok(f.zoom>.5&&f.zoom<1);
  for(let i=0;i<500;i++)f=frame(points,v,f,1/60);
  assert.ok(f.zoom>.999&&f.zoom<=1);
  for(const p of points)assert.ok(visible(p,f,v));
});
test('a viewport larger than the world does not invert camera bounds',()=>{
  const v=viewport(4000,3000),p={x:0,y:0};
  const f=frame([p],v,{x:1400,y:1100,zoom:1},1/60);
  assert.ok(visible(p,f,v));assert.equal(f.zoom,1);assert.equal(f.x,0);assert.equal(f.y,0);
});
