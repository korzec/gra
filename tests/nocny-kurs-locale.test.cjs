const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../nocny-kurs/locale.js'), 'utf8');

function loadLocale(language, stored = '') {
  const storage = new Map(stored ? [['nocny-kurs-language', stored]] : []);
  const picker = { value: '', addEventListener(type, callback) { this.change = callback; } };
  const heading = { dataset: { i18n: 'local' }, textContent: '' };
  const roomInput = {
    dataset: { i18nPlaceholder: 'joinPlaceholder', i18nAriaLabel: 'joinKeyAria' },
    attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }
  };
  const document = {
    documentElement: { lang: '' }, title: '',
    getElementById(id) { return id === 'language-select' ? picker : null; },
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return [heading];
      if (selector === '[data-i18n-placeholder]' || selector === '[data-i18n-aria-label]') return [roomInput];
      return [];
    }
  };
  const window = {};
  runInNewContext(source, {
    window, document, navigator: { language },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }
    }
  });
  return { document, picker, heading, roomInput, storage, locale: window.NocnyKursLocale };
}

test('Swedish is selected for Swedish browsers and localizes UI, attributes and parameters', () => {
  const h = loadLocale('sv-SE');
  assert.equal(h.locale.locale, 'sv');
  assert.equal(h.document.documentElement.lang, 'sv');
  assert.equal(h.document.title, 'Grand T — stadsspel');
  assert.equal(h.picker.value, 'sv');
  assert.equal(h.heading.textContent, 'Lokalt spel');
  assert.equal(h.roomInput.attrs.placeholder, 'ABCDEF eller länk');
  assert.equal(h.roomInput.attrs['aria-label'], 'Rumskod eller länk');
  assert.equal(h.locale.t('healthLabel', { id: 2, health: 1, max: 3 }), 'Hälsa för P2: 1 av 3');
  assert.equal(h.locale.t('roomFull'), 'Rummet är fullt (8 spelare).');
});

test('language selection updates immediately, notifies listeners and is persisted', () => {
  const h = loadLocale('en-US');
  assert.equal(h.locale.locale, 'pl');
  let changes = 0;
  h.locale.onChange(() => { changes++; });
  h.locale.setLocale('sv');
  assert.equal(changes, 1);
  assert.equal(h.heading.textContent, 'Lokalt spel');
  assert.equal(h.storage.get('nocny-kurs-language'), 'sv');
  h.locale.setLocale('sv');
  h.locale.setLocale('fr');
  assert.equal(changes, 1);
  h.locale.setLocale('pl');
  assert.equal(changes, 2);
  assert.equal(h.document.documentElement.lang, 'pl');
  assert.equal(h.heading.textContent, 'Gra lokalna');
});

test('saved locale overrides browser locale', () => {
  const h = loadLocale('sv-SE', 'pl');
  assert.equal(h.locale.locale, 'pl');
  assert.equal(h.picker.value, 'pl');
  assert.equal(h.locale.t('round'), '12 PRZESYŁEK');
});
