import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODE_ROLES,
  DEFAULT_TYPE,
  FONT_FAMILIES,
  FONT_ROLES,
  FONT_VAR_KEYS,
  TYPE_PRESETS,
  allFamilies,
  fontVars,
  presetFamilies,
  resolveCode,
  resolveFonts,
} from './fonts.js';
import { DEFAULT_THEME, computeTheme } from './tokens.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(root, 'fonts.css'), 'utf8');
const semantic = fs.readFileSync(path.join(root, 'semantic.css'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema.json'), 'utf8'));

test('fonts: every preset names every role with a registered family', () => {
  for (const [key, preset] of Object.entries(TYPE_PRESETS)) {
    assert.deepEqual(Object.keys(preset.fonts).sort(), [...FONT_ROLES].sort(), `${key}: roles`);
    assert.deepEqual(Object.keys(preset.code).sort(), [...CODE_ROLES].sort(), `${key}: code roles`);
    for (const family of [...Object.values(preset.fonts), ...Object.values(preset.code)]) {
      assert.ok(FONT_FAMILIES[family], `${key}: unknown family ${family}`);
    }
  }
});

/* The preload reads this set. It must cover every preset and list each family
   once, or a face can stay unloaded until the reader switches to it. */
test('fonts: the preload set covers every preset family exactly once', () => {
  const expected = new Set(Object.values(TYPE_PRESETS).flatMap((preset) => [
    ...Object.values(preset.fonts), ...Object.values(preset.code),
  ]));
  const all = allFamilies();
  assert.equal(new Set(all).size, all.length, 'each family appears once');
  assert.deepEqual([...all].sort(), [...expected].sort(), 'every preset family is covered');
  for (const key of Object.keys(TYPE_PRESETS)) {
    for (const family of presetFamilies(key)) assert.ok(expected.has(family), `${key}: ${family}`);
  }
});

test('fonts: every family carries a fallback stack with a generic tail', () => {
  for (const [family, face] of Object.entries(FONT_FAMILIES)) {
    assert.match(face.stack, new RegExp(`^'${family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',`), family);
    assert.match(face.stack, /(sans-serif|serif|monospace)$/, `${family}: generic tail`);
    assert.ok(face.weights[0] < face.weights[1], `${family}: variable range`);
    assert.equal(face.license, 'OFL-1.1', family);
  }
});

test('fonts: the default preset is Monaspace with its code mix', () => {
  assert.equal(DEFAULT_TYPE.preset, 'monaspace');
  assert.deepEqual(resolveFonts(DEFAULT_TYPE), TYPE_PRESETS.monaspace.fonts);
  assert.deepEqual(resolveCode(DEFAULT_TYPE), TYPE_PRESETS.monaspace.code);
  assert.deepEqual(DEFAULT_THEME.fonts, TYPE_PRESETS.monaspace.fonts);
});

test('fonts: a non-Monaspace preset keeps code on one face', () => {
  for (const key of Object.keys(TYPE_PRESETS).filter((name) => name !== 'monaspace')) {
    const selection = { preset: key, overrides: {} };
    const code = resolveCode(selection);
    assert.deepEqual(new Set(Object.values(code)), new Set([resolveFonts(selection).code]), key);
  }
});

test('fonts: overriding the code role collapses the Monaspace mix', () => {
  const selection = { preset: 'monaspace', overrides: { code: 'Geist Mono' } };
  assert.deepEqual(new Set(Object.values(resolveCode(selection))), new Set(['Geist Mono']));
  const bodyOnly = { preset: 'monaspace', overrides: { body: 'Geist' } };
  assert.deepEqual(resolveCode(bodyOnly), TYPE_PRESETS.monaspace.code);
});

test('fonts: an unknown family or preset fails loudly', () => {
  assert.throws(() => resolveFonts({ preset: 'nope', overrides: {} }), /Unknown type preset/);
  assert.throws(() => resolveFonts({ preset: 'geist', overrides: { body: 'Nope' } }), /Unknown font family/);
});

test('fonts: the CSS layer declares exactly the registered families and files exist', () => {
  const declared = new Set([...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]));
  assert.deepEqual([...declared].sort(), Object.keys(FONT_FAMILIES).sort());
  for (const [, file] of css.matchAll(/url\('([^']+)'\)/g)) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  }
});

test('fonts: every bundled file has provenance and a license', () => {
  const sources = JSON.parse(fs.readFileSync(path.join(root, 'fonts/sources.json'), 'utf8'));
  const files = new Set(sources.fonts.map((entry) => entry.file));
  for (const name of fs.readdirSync(path.join(root, 'fonts'))) {
    if (!name.endsWith('.woff2')) continue;
    assert.ok(files.has(name), `${name}: missing provenance`);
  }
  for (const entry of sources.fonts) {
    assert.ok(fs.existsSync(path.join(root, 'fonts', entry.license)), `${entry.file}: missing license`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${entry.file}: sha256`);
  }
});

test('fonts: the schema lists exactly the registered families', () => {
  const families = Object.keys(FONT_FAMILIES).sort();
  for (const [group, keys] of [['fonts', FONT_ROLES], ['code', CODE_ROLES]]) {
    const properties = schema.properties[group].properties;
    for (const key of keys) assert.deepEqual([...properties[key].enum].sort(), families, `${group}.${key}`);
  }
});

test('fonts: generated defaults match the static semantic CSS', () => {
  const vars = fontVars(DEFAULT_THEME.fonts, DEFAULT_THEME.code);
  assert.deepEqual(Object.keys(vars).sort(), [...FONT_VAR_KEYS].sort(), 'the var list and the writer agree');
  for (const [key, value] of Object.entries(vars)) {
    const line = semantic.match(new RegExp(`^\\s*${key}: (.+);$`, 'm'));
    assert.ok(line, `${key}: missing from semantic.css`);
    assert.equal(line[1], value, `${key}: static CSS drifted; run npm run generate`);
  }
});

test('theme: a face change reaches the primitives without a monospace tail', () => {
  const geist = resolveFonts({ preset: 'geist', overrides: {} });
  const theme = computeTheme({ fonts: geist, code: resolveCode({ preset: 'geist', overrides: {} }) });
  assert.match(theme.primitives['--font-body'], /^'Geist', system-ui/);
  assert.doesNotMatch(theme.primitives['--font-body'], /, monospace$/);
  assert.match(theme.primitives['--font-code-keyword'], /^'Geist Mono',/);
  assert.equal(theme.primitives['--tracking-display'], '-0.03em');
});

test('theme: a serif heading loosens display tracking', () => {
  const plex = TYPE_PRESETS.plex.fonts;
  const theme = computeTheme({ fonts: plex, code: resolveCode({ preset: 'plex', overrides: {} }) });
  assert.equal(theme.primitives['--tracking-display'], '-0.012em');
  assert.equal(theme.primitives['--tracking-heading'], '-0.005em');
});
