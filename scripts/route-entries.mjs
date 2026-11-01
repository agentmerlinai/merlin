import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes } from '../apps/web/routes.mjs';
import { BOOT_SCRIPT } from '../apps/web/src/theme-boot.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps/web');
const SHELL = join(WEB, 'shell.html');

const escapeHtml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/* Styles must be linked from the head. A sheet imported by the client module
   arrives after first paint, and that frame renders the unstyled DOM. */
function stylesheets(route) {
  if (!route.styles?.length) throw new Error(`${route.id}: no styles declared`);
  return route.styles
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
    .join('\n  ');
}

/* One shell, one source of truth. Each route gets an HTML entry at its public
   path so Vite dev and the MPA build resolve the same URL the reader sees. */
export function generateRouteEntries() {
  const shell = readFileSync(SHELL, 'utf8');
  if (!shell.includes('{{STYLESHEETS}}')) throw new Error(`${SHELL}: missing {{STYLESHEETS}}`);
  for (const route of routes) {
    const html = shell
      .replaceAll('{{PAGE_ID}}', route.id)
      .replaceAll('{{TITLE}}', escapeHtml(route.title))
      .replaceAll('{{DESCRIPTION}}', escapeHtml(route.description))
      .replaceAll('{{CANONICAL}}', escapeHtml(route.canonical))
      .replaceAll('{{ENTRY}}', route.entry)
      .replaceAll('{{STYLESHEETS}}', stylesheets(route))
      .replaceAll('{{THEME_BOOT}}', BOOT_SCRIPT);
    const out = join(WEB, route.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
  }
}

/* Build prerender, dev SSR, and any future consumer fill the outlet through
   this one rule, so a missing placeholder fails the same way everywhere. */
export function fillRouteDocument(template, appHtml, label) {
  if (!template.includes('<!--app-html-->')) {
    throw new Error(`${label}: missing <!--app-html--> outlet`);
  }
  return template.replace('<!--app-html-->', appHtml);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateRouteEntries();
  console.log(`route entries generated: ${routes.map((r) => r.out).join(', ')}`);
}
