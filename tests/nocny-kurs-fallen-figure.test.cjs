const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
const span = (start, next) => {
  const from = source.indexOf('  function ' + start + '(');
  const to = source.indexOf('  function ' + next + '(', from + 1);
  assert.ok(from !== -1 && to > from, 'expected drawing helper ' + start);
  return source.slice(from, to);
};

test('fallen person outline includes two wide arms, separate legs and a head', () => {
  const calls = [];
  const ctx = {
    beginPath: () => calls.push(['begin']),
    moveTo: (...v) => calls.push(['move', ...v]),
    lineTo: (...v) => calls.push(['line', ...v]),
    quadraticCurveTo: (...v) => calls.push(['curve', ...v]),
    closePath: () => calls.push(['close']),
    ellipse: (...v) => calls.push(['ellipse', ...v])
  };
  runInNewContext(span('traceFallenSilhouette', 'traceFallenHead') +
    span('traceFallenHead', 'drawDeathRemains') +
    'traceFallenSilhouette(); traceFallenHead();', { ctx, Math });
  const coords = calls.flatMap(call => {
    if (call[0] === 'move' || call[0] === 'line') return [[call[1], call[2]]];
    if (call[0] === 'curve') return [[call[1], call[2]], [call[3], call[4]]];
    return [];
  });
  const minX = Math.min(...coords.map(([x]) => x));
  const maxX = Math.max(...coords.map(([x]) => x));
  const maxY = Math.max(...coords.map(([, y]) => y));
  assert.ok(minX <= -21 && maxX >= 21, 'both arms extend visibly outward');
  assert.ok(maxY >= 21, 'legs extend below the torso');
  assert.ok(coords.some(([x, y]) => x < -8 && y > 18), 'left leg spreads sideways');
  assert.ok(coords.some(([x, y]) => x > 8 && y > 18), 'right leg spreads sideways');
  assert.ok(calls.some(call => call[0] === 'ellipse' && call[2] < -12), 'head is separate and above torso');
  assert.equal(calls.filter(call => call[0] === 'close').length, 1);
});

test('fallen body and its chalk trace share exactly the same silhouette paths', () => {
  const render = span('drawDeathRemains', 'drawSkidMarks');
  assert.equal((render.match(/traceFallenSilhouette\(\)/g) || []).length, 2);
  assert.equal((render.match(/traceFallenHead\(\)/g) || []).length, 2);
  assert.match(render, /deathRemainVisualAge\(remain\)>=DEATH_BODY_LIFETIME/);
  assert.match(render, /ctx\.rotate\(remain\.bodyFacing\+Math\.PI\/2\)/);
  assert.match(render, /ctx\.fillStyle=remain\.color/);
  assert.match(render, /ctx\.strokeStyle='#d5cfb6'/);
});

test('sleeves use identical colour to the torso on standing characters', () => {
  const person = span('drawPerson', 'cacheStaticSprites');
  assert.match(person, /ctx\.strokeStyle=p\.color;ctx\.lineWidth=4\.5/);
  assert.match(person, /ctx\.fillStyle=p\.color;capsulePath/);
});
