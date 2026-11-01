import fs from 'node:fs';

/* The stylesheet under static test. One loader for every suite: a moved or
   renamed sheet breaks in one place, and no test depends on its cwd. */
export const css = fs.readFileSync(new URL('../../apps/web/src/styles/site.css', import.meta.url), 'utf8');

/* A brace-aware reader, so a gate can ask "is this declaration inside the scrub
   layer?" instead of matching a line number. Each rule keeps the at-rule blocks
   that contain it; comments are dropped before parsing. */
export function parseRules(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const at = [];
  let prelude = '';
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === '{') {
      const head = prelude.trim();
      prelude = '';
      if (head.startsWith('@')) {
        at.push(head.replace(/\s+/g, ' '));
        continue;
      }
      const end = clean.indexOf('}', i);
      rules.push({ at: [...at], selector: head.replace(/\s+/g, ' '), body: clean.slice(i + 1, end) });
      i = end;
      continue;
    }
    if (ch === '}') {
      at.pop();
      prelude = '';
      continue;
    }
    prelude += ch;
  }
  return rules;
}
