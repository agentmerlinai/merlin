import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_STORAGE_KEY,
  DEFAULT_BRAND,
  brandVars,
  readBrand,
  toThemeConfig,
  writeBrand,
} from './brand.js';

test('brand: a legacy hue pair survives as colour, with every later default', () => {
  const parsed = readBrand('135,330');
  assert.deepEqual(parsed.state, { ...DEFAULT_BRAND, primaryHue: 135, accentHue: 330 });
  assert.equal(parsed.migrated, true);
});

test('brand: a version-three value round-trips without a migration', () => {
  const state = {
    primaryHue: 200,
    accentHue: 40,
    type: { preset: 'geist' },
    iconKit: 'lucide',
    radius: 'round',
  };
  const parsed = readBrand(writeBrand(state));
  assert.deepEqual(parsed.state, state);
  assert.equal(parsed.migrated, false);
  assert.equal(parsed.stale, false);
});

/* Version two knew colour and type only. Those readers keep both and gain the
   new defaults; the old role overrides still degrade to the preset. */
test('brand: version two migrates colour and type, then adds kit and corners', () => {
  const raw = JSON.stringify({
    v: 2,
    primaryHue: 200,
    accentHue: 40,
    type: { preset: 'geist', overrides: { prose: 'Newsreader' } },
  });
  const parsed = readBrand(raw);
  assert.deepEqual(parsed.state, {
    primaryHue: 200,
    accentHue: 40,
    type: { preset: 'geist' },
    iconKit: 'phosphor',
    radius: 'soft',
  });
  assert.equal(parsed.migrated, true);
});

test('brand: malformed values are ignored, not repaired blindly', () => {
  assert.equal(readBrand(null), null);
  assert.equal(readBrand(''), null);
  assert.equal(readBrand('not json'), null);
  assert.equal(readBrand('{'), null);
  assert.equal(readBrand('400,90'), null);
  assert.equal(readBrand('{"v":2,"primaryHue":"200","accentHue":90}'), null);
});

test('brand: unknown type, kit, and corner values degrade and mark a migration', () => {
  const raw = JSON.stringify({
    v: 3,
    primaryHue: 200,
    accentHue: 90,
    type: { preset: 'unknown', overrides: { body: 'Nope', heading: 'Geist' } },
    iconKit: 'nope',
    radius: 'nope',
  });
  const parsed = readBrand(raw);
  assert.deepEqual(parsed.state.type, { preset: 'monaspace' });
  assert.equal(parsed.state.iconKit, 'phosphor');
  assert.equal(parsed.state.radius, 'soft');
  assert.equal(parsed.migrated, true);
});

test('brand: stale derived vars are detected and rewritten on hydration', () => {
  const state = { ...DEFAULT_BRAND, type: { preset: 'source' } };
  const stored = JSON.parse(writeBrand(state));
  stored.vars['--font-body'] = "'Nope', monospace";
  const parsed = readBrand(JSON.stringify(stored));
  assert.equal(parsed.stale, true);
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.state.type.preset, 'source');
});

test('brand: the boot layer carries every font, tracking, and radius declaration', () => {
  const vars = brandVars(DEFAULT_BRAND);
  for (const key of [
    '--font-body', '--font-heading', '--font-caption', '--font-code', '--font-agent', '--font-prose',
    '--font-code-keyword', '--font-code-string', '--font-code-fn', '--font-code-comment',
    '--tracking-display', '--tracking-heading',
    '--radius-none', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full',
  ]) {
    assert.equal(typeof vars[key], 'string', key);
  }
});

test('brand: the theme config resolves fonts, code, and the corner style', () => {
  const config = toThemeConfig({ ...DEFAULT_BRAND, type: { preset: 'plex' }, radius: 'sharp' });
  assert.equal(config.fonts.heading, 'IBM Plex Serif');
  assert.equal(config.fonts.code, 'IBM Plex Mono');
  assert.deepEqual(new Set(Object.values(config.code)), new Set(['IBM Plex Mono']));
  assert.equal(config.radius, 'sharp');
  assert.equal(BRAND_STORAGE_KEY, 'merlin-brand');
});
