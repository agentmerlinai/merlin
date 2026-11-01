import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '../apps/web/routes.mjs';
import { fillRouteDocument } from './route-entries.mjs';
import { assertDrawSync, CSS_FILE, inlineSprites } from './sprites.mjs';

const ROOT = join(import.meta.dirname, '..');
const WEB = join(ROOT, 'apps/web');
const SSR_ENTRY = '/src/entry-server.tsx';

/* Dev renders documents through the same blocks as the build: the generated
   route HTML, `renderRoute` from the shared SSR entry, and the sprite inlay.
   Only the delivery differs — Vite transforms the document and serves it. */
const trim = (path) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

function routeFor(url) {
  const path = trim(url.split('?')[0]);
  return routes.find((route) => path === trim(route.path) || path === `/${route.out}`);
}

// Route match is unambiguous, so only the method needs guarding; asset requests
// never reach `routeFor`.
const wantsDocument = (req) => req.method === 'GET' || req.method === 'HEAD';

async function renderDocument(server, route, url) {
  const template = readFileSync(join(WEB, route.out), 'utf8');
  const document = await server.transformIndexHtml(url, template);
  const { renderRoute } = await server.ssrLoadModule(SSR_ENTRY);
  const html = fillRouteDocument(document, renderRoute(route.id), route.out);
  return inlineSprites(html, route.out);
}

function respond(res, status, type, body) {
  res.statusCode = status;
  res.setHeader('content-type', `${type}; charset=utf-8`);
  // Dev documents are rendered per request; a cached copy would hide edits.
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function handle(server) {
  return async (req, res, next) => {
    if (!wantsDocument(req)) return next();
    const route = routeFor(req.url);
    if (!route) return next();
    try {
      const html = await renderDocument(server, route, req.url);
      respond(res, 200, 'text/html', req.method === 'HEAD' ? undefined : html);
    } catch (error) {
      server.ssrFixStacktrace(error);
      server.config.logger.error(error.stack ?? String(error));
      respond(res, 500, 'text/plain', String(error.stack ?? error));
    }
  };
}

export function devSsr() {
  return {
    name: 'merlin-dev-ssr',
    apply: 'serve',
    configureServer(server) {
      // Fail at startup on the same invariant CI checks after the build.
      assertDrawSync(readFileSync(CSS_FILE, 'utf8'));
      server.middlewares.use(handle(server));
    },
    handleHotUpdate({ modules, server }) {
      // SSR-only modules (page sections) have no client module to patch, so
      // nothing would refresh the document; reload it to show the new render.
      // Linked stylesheets are hot-updated by Vite through their link tag.
      if (modules.length === 0) {
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
