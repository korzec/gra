const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../nocny-kurs/game.js'),'utf8');
function harness(){
  const begin=source.indexOf('  function scoreStandings('),end=source.indexOf('  function refreshCompetitionHud(',begin);
  assert.ok(begin>=0&&end>begin);
  return vm.runInNewContext(`let players=[{id:1,score:0},{id:2,score:0}],running=true,winnerId=null,teamScore=0,lastUi='';
    const WIN_SCORE=20,playerNames={normalize:n=>n||''},refreshCompetitionHud=()=>{},renderPlayers=()=>{};
    ${source.slice(begin,end)}
    ({players,awardScore,scoreStandings,winner:()=>winnerId})`);
}
test('individual scores, first to twenty wins, subsequent awards stop',()=>{
  const h=harness(),[a,b]=h.players;
  for(let i=0;i<10;i++){h.awardScore(a,1,'deliveries');h.awardScore(b,1,'kills')}
  assert.equal(h.winner(),null);assert.equal(a.score,10);assert.equal(b.score,10);
  for(let i=0;i<5;i++)h.awardScore(b,2,'convoys');
  assert.equal(h.winner(),2);assert.equal(b.score,20);assert.equal(b.convoys,5);
  assert.equal(h.awardScore(a,2,'convoys'),false);assert.equal(a.score,10);assert.equal(h.scoreStandings()[0].id,2);
});
test('all three score sources are wired, and self-kills do not award points',()=>{
  assert.match(source,/awardScore\(p,1,'deliveries'\)/);
  assert.match(source,/if\(pack\.convoy\)awardScore\(p,2,'convoys'\)/);
  assert.match(source,/if\(attacker&&attacker!==p\)awardScore\(attacker,1,'kills'\)/);
  assert.match(source,/winnerId,finalResults/);
});
