/* Regenerates the two vendored kits from pinned upstream releases. Phosphor
   art is not refetched: its registry is hand-maintained and unchanged.
   Run: node scripts/gen-icon-kits.mjs */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { ICON_MAP } from './icon-kits/manifest.mjs';

const LUCIDE = {
  package: 'lucide-static',
  version: '1.66.0',
  license: 'ISC',
  viewBox: '0 0 24 24',
  url: (name) => `https://unpkg.com/lucide-static@1.66.0/icons/${name}.svg`,
};

/* Pixelart art is path-only and already inherits `currentColor`, so it needs
   no wrapper; the root SVG carries the fill. */
const PIXEL = {
  package: 'pixelarticons',
  version: '2.4.2',
  license: 'MIT',
  viewBox: '0 0 24 24',
  url: (name) => `https://unpkg.com/pixelarticons@2.4.2/svg/${name}.svg`,
};

/* Upstream SVGs open with a license comment. Strip comments, then keep only
   the symbol's children; a nested <svg> inside a <symbol> would not paint. */
function inner(text, label) {
  const cleaned = text.replace(/<!--[\s\S]*?-->/g, '').trim();
  const match = cleaned.match(/<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/);
  if (!match || !match[1].trim()) throw new Error(`${label}: no inner SVG markup`);
  return match[1].trim();
}

async function fetchSvg(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label}: ${response.status} ${url}`);
  return response.text();
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

async function buildKit(source, wrap) {
  const icons = {};
  const hashes = {};
  for (const [name, upstream] of Object.entries(ICON_MAP)) {
    const raw = await fetchSvg(source.url(upstream[source.key]), `${source.package}:${name}`);
    const body = inner(raw, `${source.package}:${name}`);
    icons[name] = wrap ? wrap(body) : body;
    hashes[name] = sha256(raw);
  }
  return { icons, hashes };
}

const lucide = await buildKit({ ...LUCIDE, key: 'lucide' }, (body) =>
  `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
);
const pixel = await buildKit({ ...PIXEL, key: 'pixel' });

for (const [kit, data] of [['lucide', lucide], ['pixel', pixel]]) {
  for (const content of Object.values(data.icons)) {
    if (/<svg\b/.test(content)) throw new Error(`${kit}: nested <svg> leaked into a symbol`);
  }
}

const header = (source) =>
  `// Vendored from ${source.package}@${source.version} (${source.license}).\n` +
  '// Regenerate with scripts/gen-icon-kits.mjs; do not edit paths by hand.';

function moduleSource(source, data) {
  return [
    header(source),
    `export const viewBox = '${source.viewBox}';`,
    `export const icons = ${JSON.stringify(data.icons, null, 2)};`,
    '',
  ].join('\n');
}

writeFileSync('scripts/icon-kits/lucide.mjs', moduleSource(LUCIDE, lucide));
writeFileSync('scripts/icon-kits/pixel.mjs', moduleSource(PIXEL, pixel));
writeFileSync(
  'scripts/icon-kits/sources.json',
  JSON.stringify(
    {
      lucide: { ...LUCIDE, url: undefined, urlTemplate: LUCIDE.url('<name>'), hashes: lucide.hashes },
      pixel: { ...PIXEL, url: undefined, urlTemplate: PIXEL.url('<name>'), hashes: pixel.hashes },
    },
    null,
    2
  ) + '\n'
);
console.log(`wrote ${Object.keys(lucide.icons).length} lucide + ${Object.keys(pixel.icons).length} pixel icons`);
