/* Route manifest: one entry per prerendered page. Add a page here and create
   src/pages/<id>/; the entry generator and prerender do the rest. */
export const routes = [
  {
    id: 'home',
    path: '/',
    out: 'index.html',
    entry: '/src/pages/home/client.tsx',
    // One cascade for both routes, then the page's own sheet. Order matters:
    // base defines the roles, the page sheet overrides them.
    styles: ['/src/styles/base.css', '/src/pages/home/styles.css'],
    title: 'Merlin — a minimal base for collaborative agentic experiences',
    description:
      'Merlin is a minimal base for collaborative agentic experiences. One signed, live record that people and agents share. One process, inside your perimeter.',
    canonical: 'https://agentmerlin.ai/',
  },
  {
    id: 'design-system',
    path: '/design-system/',
    out: 'design-system/index.html',
    entry: '/src/pages/design-system/client.tsx',
    styles: ['/src/styles/base.css', '/src/pages/design-system/styles.css'],
    title: 'Merlin design system',
    description:
      'The Merlin design system: semantic colour roles, type, spacing, surfaces, and the React component kit that builds the product surface.',
    canonical: 'https://agentmerlin.ai/design-system/',
  },
];
