const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/player-names.js'), 'utf8');
const gameSource = readFileSync(resolve(__dirname, '../nocny-kurs/game.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../nocny-kurs/index.html'), 'utf8');
const context = { window: {} };
runInNewContext(source, context);
const names = context.window.NocnyKursPlayerNames;

test('empty and whitespace names fall back to stable player numbers', () => {
  assert.equal(names.label({ id: 1, name: '' }), 'P1');
  assert.equal(names.label({ id: 2, name: '   ' }), 'P2');
  assert.equal(names.label({ id: 8 }), 'P8');
  assert.equal(names.label({ id: 3, name: '  Ada  ' }), 'Ada');
});

test('names are bounded, preserve Polish and Unicode letters, and strip control characters', () => {
  assert.equal(names.normalize('  Żółw  🚗   i  kot  '), 'Żółw 🚗 i kot');
  assert.equal(names.normalize('Anna\nNowak\u0000'), 'AnnaNowak');
  assert.equal([...names.normalize('🐈'.repeat(40))].length, 18);
  assert.equal(names.normalize(123), '');
  assert.equal(names.normalize(null), '');
});

test('untrusted names are HTML-escaped before insertion into sidebar', () => {
  assert.equal(names.escapeHtml('<img src=x onerror="x">'),
    '&lt;img src=x onerror=&quot;x&quot;&gt;');
  assert.equal(names.escapeHtml("O'Connor & Co"), 'O&#39;Connor &amp; Co');
  assert.match(gameSource, /playerNames\.escapeHtml\(playerNames\.label\(p\)\)/);
  assert.match(gameSource, /name:playerNames\.normalize\(p\.name\)/);
  assert.match(gameSource, /state\.players\.map\(p=>\(\{\.\.\.p,name:playerNames\.normalize\(p\.name\)\}\)\)/);
});

test('the name is editable on start and in-game and is sent in existing input snapshots', () => {
  assert.match(html, /id="player-name-start"/);
  assert.match(html, /id="player-name-live"/);
  assert.ok(html.indexOf('player-names.js?v=') < html.indexOf('game.js?v='));
  assert.match(gameSource, /name:localPlayerName/);
  assert.match(gameSource, /typeof input\.name===['"]string['"]/);
  assert.match(gameSource, /drawPlayerTag\(p\)/);
});
