import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes } from '../apps/web/routes.mjs';
import { fillRouteDocument } from './route-entries.mjs';
import { renderRoute } from '../dist/server/entry-server.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = join(ROOT, 'dist/client');

for (const route of routes) {
  const file = join(CLIENT, route.out);
  const template = readFileSync(file, 'utf8');
  writeFileSync(file, fillRouteDocument(template, renderRoute(route.id), route.out));
}

mkdirSync(CLIENT, { recursive: true });
const urls = routes
  .map((route) => `  <url><loc>${route.canonical}</loc></url>`)
  .join('\n');
writeFileSync(
  join(CLIENT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
);
console.log(`prerendered ${routes.length} routes + sitemap`);
