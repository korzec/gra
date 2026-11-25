const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const game = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8');

function functions(start, stop) {
  const first = game.indexOf('  function ' + start + '(');
  const last = game.indexOf('  function ' + stop + '(', first + 1);
  assert.ok(first >= 0 && last > first, 'expected ' + start + ' and ' + stop);
  return game.slice(first, last);
}

function engine() {
  const extract = functions('addDeathRemain', 'traceFallenSilhouette') +
    functions('makeTraces', 'predictGuestWalk');
  return runInNewContext(`
    (() => {
      let deathRemains = [], skidMarks = [], guards = [], carDrivers = [], ambulances = [];
      const dropPistol=()=>{throw new Error('non-NPC fixture must not drop a pistol')};
      const MAX_DEATH_REMAINS=64, DEATH_BODY_LIFETIME=10, DEATH_CHALK_LIFETIME=600,
        NPC_REMAIN_LIFETIME=60, MAX_SKID_MARKS=220, SKID_MARK_LIFETIME=2.25;
      const world={w:2800,h:2200};
      const AMBULANCE_LIMIT=2, AMBULANCE_SPEED=165, AMBULANCE_LOADING_TIME=2;
      const roadsX=[92,388,762,1118,1520,1876,2296,2708], roadsY=[94,390,733,1030,1416,1786,2108];
      const hospital={exitX:643,exitY:1695};
      const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
      ${extract}
      return { addDeathRemain, updateDeathRemains, makeTraces, applyTraces, updateAmbulances,
        remains:()=>deathRemains, ambulances:()=>ambulances };
    })()
  `, { Math, Number, Array });
}

test('all character kinds leave remains, with NPC outlines removed at precisely 60s', () => {
  const e = engine();
  e.addDeathRemain({id:1,color:'#d6f36a',facing:0},200,200);
  e.addDeathRemain({id:100,color:'#f18161',facing:1},300,300,true);
  e.addDeathRemain({id:200,color:'#e8a14e',facing:2},400,400,true);
  assert.deepEqual(Array.from(e.remains(), r => r.npc), [false,true,true]);
  e.updateDeathRemains(59.9);
  assert.equal(e.remains().length,3);
  e.updateDeathRemains(.1);
  assert.equal(e.remains().length,1);
  assert.equal(e.remains()[0].playerId,1);
  e.updateDeathRemains(549.9);
  assert.equal(e.remains().length,1);
  e.updateDeathRemains(.1);
  assert.equal(e.remains().length,0);
});

test('multiplayer trace tuples preserve NPC lifetime and accept legacy player tuples', () => {
  const host=engine(),guest=engine();
  host.addDeathRemain({id:1,color:'#d6f36a',facing:0},200,200);
  host.addDeathRemain({id:101,color:'#f18161',facing:1},400,400,true);
  const sent=host.makeTraces();
  assert.deepEqual(Array.from(sent.deathRemains, r=>r[5]),[0,1]);
  guest.applyTraces(sent);
  assert.deepEqual(Array.from(guest.remains(), r=>r.npc),[false,true]);
  guest.updateDeathRemains(60);
  assert.equal(guest.remains().length,1);
  guest.applyTraces({skidMarks:[],deathRemains:[[140,120,500,'#e8a14e',1000]]});
  assert.equal(guest.remains()[0].npc,false);
  // A delayed packet cannot resurrect NPC remains whose timestamp has expired.
  guest.applyTraces({skidMarks:[],deathRemains:[[140,120,500,'#e8a14e',60000,1]]});
  assert.equal(guest.remains().length,0);
});

test('at most two ambulances collect bodies and return before serving the next call', () => {
  const host=engine();
  const bodies=[[2296,1030],[762,390],[388,1786]];
  for(const [x,y] of bodies)host.addDeathRemain({id:1,color:'#d6f36a'},x,y);
  host.updateAmbulances(.05);
  const first=host.ambulances()[0];
  assert.equal(first.x,671);
  assert.equal(first.y,1695);
  assert.equal(first.remain,host.remains()[0]);

  let peak=0;
  let thirdDispatched=false;
  for(let i=0;i<1200;i++){
    host.updateDeathRemains(.05);
    host.updateAmbulances(.05);
    const active=host.ambulances();
    peak=Math.max(peak,active.length);
    assert.equal(new Set(active.map(a=>a.remain).filter(Boolean)).size,active.filter(a=>a.remain).length);
    if(active.some(a=>a.remain===host.remains()[2])){
      thirdDispatched=true;
      assert.ok(host.remains().slice(0,2).some(r=>r.collected));
    }
    if(active.length===0&&thirdDispatched)break;
  }
  assert.equal(peak,2);
  assert.ok(thirdDispatched);
  assert.equal(host.ambulances().length,0);
  assert.ok(host.remains().every(r=>r.collected&&!r.awaitingPickup));
  assert.ok(host.makeTraces().deathRemains.every(r=>r[4]>=10000),'pickup leaves a chalk trace');
});

test('guard death and destroyed driver both create short-lived NPC remains', () => {
  assert.match(game, /if\(g\.hp<=0\)\{addDeathRemain\(g,g\.x,g\.y,true\);guards\.splice/);
  assert.match(game, /addDeathRemain\(owner,owner\.x,owner\.y,true\)/);
  assert.match(game, /owner\.hp>0&&!c\)addDeathRemain\(owner,owner\.x,owner\.y,true\)/);
  assert.match(game, /addDeathRemain\(p,q\.x,q\.y\)/);
  assert.match(game, /if\(c\.npcInside\)addDeathRemain\(/);
  assert.match(game, /if\(owner\.carId===c\.id\)\{\s*addDeathRemain\(owner,owner\.x,owner\.y,true\)/);
});

test('Polish walking pedestrian silhouette is used for corpse and chalk', () => {
  const silhouette=functions('traceFallenSilhouette', 'traceFallenHead');
  assert.match(silhouette,/Right arm bends at the elbow/);
  assert.match(silhouette,/Left leg extends farther back/);
  const render=functions('drawDeathRemains', 'drawSkidMarks');
  assert.equal((render.match(/traceFallenSilhouette\(\)/g)||[]).length,2);
  assert.equal((render.match(/traceFallenHead\(\)/g)||[]).length,2);
  assert.match(render,/ctx\.fillStyle=trouserColor\(remain\.color\)/);
});

test('standing pants are visible when idle, and match corpse grey/brown palette', () => {
  const person=functions('drawPerson','cacheStaticSprites');
  assert.match(person,/for\(const leg of legs\)\{/);
  assert.doesNotMatch(person,/if\(moving\)for\(const leg of legs\)/);
  assert.match(person,/ctx\.strokeStyle=trouserColor\(p\.color\)/);
  const palette=functions('trouserColor','drawPerson');
  assert.match(palette,/#535a5d/);
  assert.match(palette,/#74614d/);
});

test('mobile view hides only the control legend, not player names or health', () => {
  assert.match(css,/@media \(max-width:800px\), \(hover:none\) and \(pointer:coarse\)/);
  assert.match(css,/\.play-page \.night-sidebar \.player-controls\{display:none!important\}/);
  assert.doesNotMatch(css,/\.play-page \.night-sidebar \.player-health\{display:none/);
});
