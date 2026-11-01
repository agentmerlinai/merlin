import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertDrawSync, CSS_FILE, inlineSprites } from './sprites.mjs';

const CLIENT = 'dist/client';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}

/* The build runs the same guards the dev server runs, so a broken sprite id or
   a drifting draw timeline fails locally before CI sees it. */
const pages = walk(CLIENT).filter((file) => file.endsWith('.html'));
assertDrawSync(readFileSync(CSS_FILE, 'utf8'));
for (const file of pages) {
  writeFileSync(file, inlineSprites(readFileSync(file, 'utf8'), file));
}
console.log(`sprites inlined in ${pages.length} pages`);
