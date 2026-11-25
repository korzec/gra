const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('all game toolbars have a six pixel offset plus device safe area',()=>{
  for(const p of ['style.css','mikro-sprint/style.css']){
    const css=read(p);assert.match(css,/--game-top-offset:calc\(6px \+ env\(safe-area-inset-top, 0px\)\)/);
    assert.match(css,/height:calc\(62px \+ var\(--game-top-offset\)\)/);
    assert.match(css,/height:calc\(56px \+ var\(--game-top-offset\)\)/);
    assert.match(css,/padding:var\(--game-top-offset\)/);
    assert.match(css,/top:calc\(63px \+ var\(--game-top-offset\)\)/);
  }
  for(const game of ['grand-t','micro-m','swietliki','lesne-jednorozce'])assert.match(read(game+'/index.html'),/viewport-fit=cover/);
});
