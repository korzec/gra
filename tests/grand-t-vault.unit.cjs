const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../nocny-kurs/game.js'),'utf8');
function extract(a,b){const i=src.indexOf('  function '+a+'('),j=src.indexOf('  function '+b+'(',i);assert.ok(i>=0&&j>i);return src.slice(i,j)}
function harness(type='car'){
 const cars=[{type,x:100,y:100,angle:0}],fences=[],buildings=[],world={w:500,h:500};
 const context={cars,fences,buildings,world,TRUCK_TYPE:'truck',PLAYER_RUN_SPEED:77.5,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),blockedByPlayer:()=>false,carBlocksCircle:(c,x,y,r)=>Math.abs(x-c.x)<22+r&&Math.abs(y-c.y)<13+r};
 const fence=extract('gardenFences','carBlocksCircle');
 const start=src.indexOf('  function jumpHeight('),walkStart=src.indexOf('  function walk(',start);const movement=src.slice(start,src.indexOf('\n  function ',walkStart+5));
 // Extract only through the end of walk: subsequent helpers may depend on unrelated globals.
 const end=movement.indexOf('\n  function ',movement.indexOf('  function walk(')+5);
 const code=fence+movement.slice(0,end<0?movement.length:end)+'\n({stepJump,walk,gardenFences,walkObstacle})';
 const api=vm.runInNewContext(code,context);return {...api,cars,fences,buildings};
}
test('running jump clears passenger car but not truck, no jump means collision',()=>{
 for(const type of ['car','truck']){
  const h=harness(type),p={x:65,y:100,alive:true,moveTime:.5};
  for(let i=0;i<91;i++){h.stepJump(p,true,1/60);h.walk(p,1,0,1/60)}
  assert.ok(type==='car'?p.x>132:p.x<=68);
 }
 const h=harness(),p={x:65,y:100,alive:true,moveTime:.5};h.walk(p,1,0,.1);assert.ok(p.x<=68);
});
test('garden fence is solid on foot, can be vaulted, and has a gate',()=>{
 const h=harness();h.cars.length=0;h.fences.push(...h.gardenFences({kind:'garden',x:100,y:100,w:90,h:80}));
 assert.equal(h.walkObstacle({x:120,y:85},120,102),true);
 assert.equal(h.walkObstacle({x:120,y:85,jumpTime:.75},120,102),false);
 assert.equal(h.walkObstacle({x:145,y:190},145,177),false);
 h.buildings.push({x:100,y:100,w:90,h:80});
 assert.equal(h.walkObstacle({x:120,y:85,jumpTime:.75},120,102),true);
});
test('landing on a car returns to a clear point',()=>{
 const h=harness(),p={x:100,y:100,alive:true,jumpTime:.01,jumpSafeX:60,jumpSafeY:100};
 h.stepJump(p,false,.02);h.walk(p,0,0,.02);assert.equal(p.x,60);
});

test('jump never increases horizontal walking speed',()=>{const h=harness();h.cars.length=0;const a={x:50,y:50,alive:true,moveTime:0},b={...a};for(let i=0;i<30;i++){h.stepJump(a,true,1/60);h.walk(a,1,0,1/60);h.walk(b,1,0,1/60)}assert.equal(a.x,b.x);});
