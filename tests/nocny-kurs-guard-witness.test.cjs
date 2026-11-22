const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');

test('player and guard bullet tracers are half the original dimensions', () => {
  // Drawing is shared for player and guard bullets, preserving their team
  // colors while halving stroke width, trail length and glow radius.
  const draw = source.match(/for\(const b of bullets\)\{if\(!visible\(b\.x,b\.y,15\)\)[^\n]+/);
  assert.ok(draw, 'bullet drawing must use a reduced visibility radius');
  assert.match(draw[0], /b\.team==='guard'\?'#ff8775':'#fff0a8'/);
  assert.match(draw[0], /ctx\.lineWidth=3\.5/);
  assert.match(draw[0], /ctx\.shadowBlur=8/);
  assert.match(draw[0], /ctx\.moveTo\(b\.x-b\.vx\*\.0125,b\.y-b\.vy\*\.0125\)/);
  // Collision and hit rules are intentionally left unchanged.
  assert.match(source, /distance<16\)\{damagePlayer\(p,1/);
});

test('guards retain per-guard, per-player eyewitness memory instead of treating hearing as proof', () => {
  assert.match(source, /GUARD_WITNESSED_SHOT_SECONDS=5/);
  assert.match(source, /p\.shotThisTick=true/);
  assert.match(source, /g\.witnessedShots=new Map\(\)/);
  assert.match(source, /if\(p\.shotThisTick\)g\.witnessedShots\.set\(p\.id,GUARD_WITNESSED_SHOT_SECONDS\)/);
  assert.match(source, /witnessedTarget&&g\.fireCooldown<=0/);
  assert.match(source, /for\(const p of players\)p\.shotThisTick=false/);
});
