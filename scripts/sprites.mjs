import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brandCssVar, brandInnerArt, tintBrandArt } from './brand-ink.mjs';
import { icons } from './icons.mjs';

/* Sources resolve from the repo root, never from the process cwd: the dev
   server starts inside apps/web, the build scripts start at the root. */
const ROOT = join(import.meta.dirname, '..');

/* Sprite inlay is one block shared by the build (postbuild) and the dev server,
   so the DOM a reader sees in dev equals the DOM CI ships. */
export const CSS_SOURCE = 'apps/web/src/styles/site.css';
export const CSS_FILE = join(ROOT, CSS_SOURCE);
const BRAND_LABEL = 'packages/theme/assets/logo.svg';
const BRAND_FILE = join(ROOT, BRAND_LABEL);

/* The sprite is the whole registry, never a page's rendered subset: a switch
   inside a client island (the theme toggle) references an id that no server
   render ever wrote. A page-derived sprite silently drops it. */
export function renderSprite() {
  return [
    '<!-- Generated from scripts/icons.mjs by scripts/postbuild.mjs. Do not edit. -->',
    '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">',
    ...Object.entries(icons).map(
      ([id, icon]) => `  <symbol id="${id}" viewBox="${icon.viewBox}">${icon.content}</symbol>`
    ),
    '</svg>',
  ].join('\n');
}

export function renderBrand() {
  const art = tintBrandArt(
    brandInnerArt(readFileSync(BRAND_FILE, 'utf8')),
    brandCssVar,
    BRAND_LABEL
  );
  return [
    '<!-- Generated from packages/theme/assets/logo.svg by scripts/postbuild.mjs. Do not edit. -->',
    '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">',
    `  <symbol id="merlin-mark" viewBox="0 0 828 740">${art}</symbol>`,
    '</svg>',
  ].join('\n');
}

function stops(body, prop) {
  const out = [];
  for (const chunk of body.split('}')) {
    const [selector, decl] = chunk.split('{');
    if (decl?.includes(`${prop}:`)) {
      for (const [, pct] of selector.matchAll(/([\d.]+)%/g)) out.push(Number(pct));
    }
  }
  return out;
}

/* A link is one gesture: one card-to-card path, two legs, one pen, and one
   clock (`.collab-link > *`). The pen and its legs must share that clock, and
   the two hands must draw with the same stops and the same length — so the
   guard rejects any per-link clock, pen or leg track. The CSS is external, so
   validate the source the browser receives. */
export function assertDrawSync(css) {
  const links = new Set(
    [...css.matchAll(/\.collab-wire--([a-z])\d/g)].map(([, key]) => key)
  );
  if (links.size === 0) throw new Error(`${CSS_SOURCE}: no collab-wire--<link><leg> rules`);
  const pen = css.match(/@keyframes collab-link-pen\s*\{([\s\S]*?)\n\}/);
  if (!pen) throw new Error(`${CSS_SOURCE}: collab-link-pen keyframes missing`);
  if (!stops(pen[1], 'left').includes(50)) {
    throw new Error(`${CSS_SOURCE}: collab-link-pen must draw two equal strokes (no 50% stop)`);
  }
  if (!/\.collab-link\s*>\s*\*\s*\{[^}]*animation-duration/.test(css)) {
    throw new Error(`${CSS_SOURCE}: links have no shared clock (.collab-link > *)`);
  }
  for (const key of links) {
    if (!css.includes(`.collab-link--${key}`)) {
      throw new Error(`${CSS_SOURCE}: link ${key} has no wrapper, so it cannot own its vertices`);
    }
  }
  for (const [, name] of css.matchAll(/@keyframes (collab-leg-[a-z]\d|collab-pointer-[a-z])\s*\{/g)) {
    throw new Error(`${CSS_SOURCE}: ${name} is a per-link clock; both hands share one pen and one leg track`);
  }
}

/* One pattern for sprite references and one for source names, shared with
   tests/icons.test.mjs. Documents reference a kit-prefixed symbol; source code
   names the canonical `icon-*` id that never changes with the kit. */
export const ICON_REF = /#((?:ph|lx|px)-[a-z0-9-]+|gh-logo)/g;
export const ICON_ID = /icon-[a-z0-9-]+/g;

/* Inlay the whole sprite and the brand art. `label` names the document in
   errors (a built file path, or a route's out path in dev). The document's ids
   are still checked: a reference with no registry symbol must fail loudly, not
   paint an empty box. */
export function inlineSprites(html, label) {
  const ids = new Set([...html.matchAll(ICON_REF)].map(([, id]) => id));
  const missing = [...ids].filter((id) => !(id in icons));
  if (missing.length > 0) {
    throw new Error(`${label}: missing sprite symbols: ${missing.join(', ')}`);
  }
  let next = html.replace('<div data-build="icon-sprite"></div>', renderSprite());
  if (next.includes('href="#merlin-mark"')) {
    next = next.replace('<div data-build="brand-sprite"></div>', renderBrand());
  }
  return next;
}
