import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOT_SCRIPT } from '../apps/web/src/theme-boot.js';
import { FONT_VAR_KEYS } from '../packages/theme/fonts.js';

function runBoot(vars, storedTheme = 'auto') {
  const calls = new Map();
  const attrs = new Map();
  const store = new Map([
    ['merlin-brand', JSON.stringify({ v: 2, primaryHue: 200, accentHue: 90, type: { preset: 'geist' }, vars })],
    ['merlin-theme', storedTheme],
  ]);
  const root = {
    style: { setProperty: (key, value) => calls.set(key, value) },
    setAttribute: (key, value) => attrs.set(key, value),
  };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null };
  globalThis.document = { documentElement: root };
  try {
    new Function(BOOT_SCRIPT)();
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.document;
  }
  return { calls, attrs };
}

test('boot: stored font declarations paint before the sheet runs', () => {
  const vars = Object.fromEntries(FONT_VAR_KEYS.map((key) => [key, "'Geist', system-ui, sans-serif"]));
  vars['--tracking-display'] = '-0.012em';
  vars['--tracking-heading'] = '-0.005em';
  const { calls, attrs } = runBoot(vars);
  assert.equal(calls.size, FONT_VAR_KEYS.length, 'every role paints inline');
  assert.equal(calls.get('--font-body'), "'Geist', system-ui, sans-serif");
  assert.equal(calls.get('--tracking-display'), '-0.012em');
  assert.equal(attrs.get('data-theme'), 'light');
  assert.equal(attrs.get('data-theme-pref'), 'auto');
});

test('boot: a value that could break out of the declaration is ignored', () => {
  const vars = Object.fromEntries(FONT_VAR_KEYS.map((key) => [key, "'Geist', system-ui, sans-serif"]));
  vars['--font-body'] = "x; } body { display: none";
  vars['--font-evil'] = "'Nope'";
  const { calls } = runBoot(vars);
  assert.equal(calls.has('--font-body'), false, 'the unsafe value is dropped');
  assert.equal(calls.has('--font-evil'), false, 'an unknown key is dropped');
  assert.equal(calls.size, FONT_VAR_KEYS.length - 1, 'the safe declarations still paint');
});

test('boot: a legacy hue-only value paints no face', () => {
  const calls = new Map();
  const store = new Map([['merlin-brand', '280,90'], ['merlin-theme', 'auto']]);
  const root = { style: { setProperty: (key, value) => calls.set(key, value) }, setAttribute: () => {} };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null };
  globalThis.document = { documentElement: root };
  try {
    new Function(BOOT_SCRIPT)();
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.document;
  }
  assert.equal(calls.size, 0);
});
