const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../mikro-sprint/game.js'),'utf8');
test('camera closes more than half of its position and zoom gap within 125 ms',()=>{
 const start=src.indexOf('  function updateCamera('),end=src.indexOf('\n  }',start)+4;assert.ok(start>=0&&end>start);
 const camera={x:500,y:500,scale:1};const context={camera,state:'racing',W:5000,H:5000,cameraTarget:()=>({x:600,y:600,scale:2}),cameraScaleLimit:()=>3,cameraBounds:()=>({halfW:100,halfH:100}),keepLeaderInFrame:()=>{},clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
 vm.runInNewContext(src.slice(start,end)+'\nupdateCamera(.125,false,[])',context);
 assert.ok(camera.x>550&&camera.x<600);assert.ok(camera.y>550&&camera.y<600);assert.ok(camera.scale>1.5&&camera.scale<2);
});
