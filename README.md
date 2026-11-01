<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/assets/brand/merlin-wordmark-dark.svg">
    <img src="apps/web/public/assets/brand/merlin-wordmark-light.svg" alt="Merlin" width="520">
  </picture>
</p>

![Status: Early research project](https://img.shields.io/badge/status-early%20research%20project-yellow)

## What is Merlin?

Merlin is a base for on-prem and air-gapped collaborative agents. Loop, tools, state, auth, sync, and a React surface ship in one process. Clients compute and hold signed replicas, so one small VM serves hundreds of users. Every change is signed and audited. Humans and agents edit the same record live.

Domain work arrives as extensions: ordinary npm packages, swapped without forking the base.

Merlin is a research project by the GoatDB team. It is early and under active development: interfaces, APIs, and behavior will change.

- [Product thesis](merlin-thesis.md)
- [Site](https://agentmerlin.ai)
- [Design system](https://agentmerlin.ai/design-system/)

## Local development

```sh
npm ci
npm run dev          # http://localhost:5173
npm run build        # prerender both routes into dist/client
npm run preview      # serve the built site
```

The deploy workflow uploads `dist/client` to GitHub Pages. The site is static at request time: React renders in CI, and only the theme and landing-story islands hydrate.
