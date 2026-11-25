const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('both games load and use the same passenger car renderer',()=>{
  const window={};vm.runInNewContext(read('shared-car-art.js'),{window});
  const rects=[],ctx={fillRect(...r){rects.push(r)},beginPath(){},arc(){},fill(){}};
  window.SharedCarArt.draw(ctx,{paint:'#abc',occupied:true});
  assert.ok(rects.some(r=>r.join(',')==='-21,-12,44,26'));
  assert.ok(rects.some(r=>r.join(',')==='-13,-13,8,3'));
  for(const [html,game] of [['grand-t/index.html','nocny-kurs/game.js'],['micro-m/index.html','mikro-sprint/game.js']]){
    const h=read(html);assert.ok(h.indexOf('shared-car-art.js')>=0&&h.indexOf('shared-car-art.js')<h.indexOf(game));
    assert.match(read(game),/window\.SharedCarArt\.draw\(/);
  }
});
