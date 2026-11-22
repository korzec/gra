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
      let deathRemains = [], skidMarks = [];
      const MAX_DEATH_REMAINS=64, DEATH_BODY_LIFETIME=10, DEATH_CHALK_LIFETIME=600,
        NPC_REMAIN_LIFETIME=60, MAX_SKID_MARKS=220, SKID_MARK_LIFETIME=2.25;
      const world={w:2800,h:2200};
      const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
      ${extract}
      return { addDeathRemain, updateDeathRemains, makeTraces, applyTraces,
        remains:()=>deathRemains };
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

test('guard death and destroyed driver both create short-lived NPC remains', () => {
  assert.match(game, /if\(g\.hp<=0\)\{addDeathRemain\(g,g\.x,g\.y,true\);guards\.splice/);
  assert.match(game, /addDeathRemain\(owner,owner\.x,owner\.y,true\)/);
  assert.match(game, /owner\.hp>0&&!c\)addDeathRemain\(owner,owner\.x,owner\.y,true\)/);
  assert.match(game, /addDeathRemain\(p,q\.x,q\.y\)/);
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
