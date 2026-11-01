import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { routes } from './routes.mjs';
import { generateRouteEntries } from '../../scripts/route-entries.mjs';
import { devSsr } from '../../scripts/dev-ssr.mjs';

// The route HTML must exist before Vite resolves its MPA inputs. Regenerate it
// on every build and on dev-server start so routes.ts/shell.html cannot drift.
generateRouteEntries();

export default defineConfig({
  // Explicit root: every entry point (dev, build, tests, other cwds) must resolve
  // the same files, so the dev server never depends on where it was started.
  root: import.meta.dirname,
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    devSsr(),
    {
      name: 'merlin-route-entries',
      buildStart() {
        generateRouteEntries();
      },
      configureServer() {
        generateRouteEntries();
      },
    },
  ],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: Object.fromEntries(
        routes.map((route) => [route.id, join(import.meta.dirname, route.out)])
      ),
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
