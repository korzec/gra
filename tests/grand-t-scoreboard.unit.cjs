const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../nocny-kurs/game.js'),'utf8');
test('live ranking sorts by individual score with deterministic tie order',()=>{
 const players=[{id:3,score:1},{id:1,score:8},{id:4,score:12},{id:2,score:8}];
 const i=src.indexOf('  function rankedPlayers('),j=src.indexOf('  function renderPlayers(',i);assert.ok(i>=0&&j>i);
 const sorted=vm.runInNewContext(src.slice(i,j)+'\nrankedPlayers()',{players});
 assert.deepEqual(Array.from(sorted,p=>p.id),[4,1,2,3]);assert.equal(players[0].id,3);
});
