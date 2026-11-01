/* Icon registry contract: every page inlines the whole three-kit registry, so
   the registry must equal the ids the source references and every kit must
   carry the same canonical glyph names. A missing glyph paints an empty box at
   runtime; a dead entry bloats every page for nothing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CANONICAL_NAMES, icons } from '../scripts/icons.mjs';
import { ICON_ID, renderSprite } from '../scripts/sprites.mjs';
import { ICON_KITS } from '../packages/theme/kits.js';

const ROOT = join(import.meta.dirname, '..');
const SOURCES = ['apps/web/src', 'packages/ui/src'];
const CODE = /\.(?:tsx?|jsx?|mjs)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (CODE.test(entry.name)) yield path;
  }
}

/* Ids the client can reference: literal strings in any source file, including
   the maps an island swaps at runtime. That is why the scan reads source, not
   the rendered document. */
function referenced() {
  const ids = new Set();
  for (const dir of SOURCES) {
    for (const file of walk(join(ROOT, dir))) {
      for (const [id] of readFileSync(file, 'utf8').matchAll(ICON_ID)) ids.add(id);
    }
  }
  return ids;
}

const bare = (id) => id.replace(/^icon-/, '');
const spriteIds = Object.values(ICON_KITS).map((kit) => kit.sprite);

test('icons: no legacy ph- ids remain in source', () => {
  const legacy = [];
  for (const dir of SOURCES) {
    for (const file of walk(join(ROOT, dir))) {
      for (const [id] of readFileSync(file, 'utf8').matchAll(/(?:ph|lx|px)-[a-z0-9-]+/g)) legacy.push(`${file}: ${id}`);
    }
  }
  assert.deepEqual(legacy, [], 'source names canonical icon-* ids, not kit symbols');
});

test('icons: the registry holds no dead canonical entry', () => {
  const used = new Set(
    [...referenced()].map(bare).filter((id) => CANONICAL_NAMES.includes(id))
  );
  const unused = CANONICAL_NAMES.filter((id) => !used.has(id));
  assert.deepEqual(unused, [], 'remove these names from every kit and the manifest');
});

test('icons: every kit carries every canonical name', () => {
  for (const kit of spriteIds) {
    for (const name of CANONICAL_NAMES) {
      assert.ok(`${kit}-${name}` in icons, `${kit} is missing ${name}`);
    }
  }
  const expected = CANONICAL_NAMES.length * spriteIds.length;
  const kitEntries = Object.keys(icons).filter((id) => spriteIds.some((kit) => id.startsWith(`${kit}-`)));
  assert.equal(kitEntries.length, expected, 'a kit carries an extra or missing glyph');
});

test('icons: symbols never nest an <svg>', () => {
  for (const [id, icon] of Object.entries(icons)) {
    assert.doesNotMatch(icon.content, /<svg\b/, `${id}: a symbol must contain graphics, not a document`);
  }
});

test('icons: the sprite carries every registry symbol', () => {
  const sprite = renderSprite();
  for (const id of Object.keys(icons)) {
    assert.ok(sprite.includes(`<symbol id="${id}"`), `sprite is missing ${id}`);
  }
});

test('icons: the inlined sprite stays inside one page budget', () => {
  const bytes = Buffer.byteLength(renderSprite());
  assert.ok(bytes < 64 * 1024, `sprite is ${bytes} bytes; every page pays for it`);
});
