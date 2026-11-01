/* Dev-server contract: every route is server-rendered through the same blocks
   the build uses. No browser here — this is the fast guard; the page contracts
   in pages.test.mjs run against the same server with MERLIN_PAGES_TARGET=dev. */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { routes } from '../apps/web/routes.mjs';
import { DIST } from '../scripts/serve-dist.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
let vite;
let base;

before(async () => {
  vite = await createServer({
    configFile: path.join(ROOT, 'apps/web/vite.config.ts'),
    server: { port: 5198, strictPort: true },
    logLevel: 'warn',
  });
  await vite.listen();
  base = vite.resolvedUrls.local[0].replace(/\/$/, '');
});

after(async () => {
  await vite?.close();
});

/* Dev must deliver the exact payload of the shared SSR entry; the artifact must
   contain that same payload after prerender. Vite moves the entry script into
   <head> at build time, so compare the render string, not a document slice. */
async function payloadFor(route) {
  const { renderRoute } = await vite.ssrLoadModule('/src/entry-server.tsx');
  return renderRoute(route.id);
}

const MARKERS = {
  home: ['<main id="main">', 'data-island="hero"', 'id="top"'],
  'design-system': ['<main id="main">', 'ds-showcase'],
};

test('dev SSR: every route renders the full document', async () => {
  for (const route of routes) {
    const res = await fetch(base + route.path);
    const html = await res.text();
    assert.equal(res.status, 200, `${route.id}: status`);
    assert.match(res.headers.get('content-type'), /text\/html/, `${route.id}: content type`);
    assert.ok(!html.includes('<!--app-html-->'), `${route.id}: outlet left empty`);
    assert.ok(!html.includes('undefined'), `${route.id}: undefined leaked`);
    assert.ok(!html.includes('NaN'), `${route.id}: NaN leaked`);
    for (const marker of MARKERS[route.id] ?? ['<main id="main">']) {
      assert.ok(html.includes(marker), `${route.id}: missing ${marker}`);
    }
    assert.match(html, /<symbol id="(?:ph|gh)-/, `${route.id}: sprites not inlaid`);
    assert.ok(html.includes('/@vite/client'), `${route.id}: live reload client missing`);
  }
});

/* The first frame must be styled. A sheet imported by the client module arrives
   after first paint, and that frame renders the unstyled DOM. */
test('dev SSR: every route links its styles from the head', async () => {
  for (const route of routes) {
    const html = await (await fetch(base + route.path)).text();
    const head = html.slice(0, html.indexOf('</head>'));
    for (const href of route.styles) {
      assert.ok(head.includes(`<link rel="stylesheet" href="${href}">`), `${route.id}: missing ${href}`);
    }
  }
});

test('dev SSR: the payload matches the prerendered artifact', { skip: !fs.existsSync(path.join(DIST, 'index.html')) && 'no build' }, async () => {
  for (const route of routes) {
    const dev = await (await fetch(base + route.path)).text();
    const artifact = fs.readFileSync(path.join(DIST, route.out), 'utf8');
    const payload = await payloadFor(route);
    assert.ok(dev.includes(payload), `${route.id}: dev document is missing the shared render`);
    assert.ok(artifact.includes(payload), `${route.id}: artifact differs from the shared render`);
  }
});

test('dev SSR: trailing slash and file name resolve to the same route', async () => {
  const payload = await payloadFor(routes.find((route) => route.id === 'design-system'));
  for (const pathname of ['/design-system', '/design-system/', '/design-system/index.html']) {
    const html = await (await fetch(base + pathname)).text();
    assert.ok(html.includes(payload), `${pathname}: wrong route rendered`);
  }
});
