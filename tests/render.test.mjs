import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { renderRoute } from '../dist/server/entry-server.js';

const ROUTES = ['home', 'design-system'];

test('render: every route is deterministic and complete', () => {
  for (const route of ROUTES) {
    const first = renderRoute(route);
    const second = renderRoute(route);
    assert.equal(first, second, `${route}: render changed between calls`);
    assert.ok(!first.includes('undefined'), `${route}: undefined leaked`);
    assert.ok(!first.includes('NaN'), `${route}: NaN leaked`);
    assert.ok(first.includes('<main id="main">'), `${route}: main landmark`);
  }
});

test('render: home keeps the story contract', () => {
  const html = renderRoute('home');
  assert.equal((html.match(/data-story-beat=/g) || []).length, 6);
  assert.match(html, /data-story-stage=/);
  assert.match(html, /data-island="hero"/);
  assert.match(html, /data-island="brand-thread"/);
  assert.match(html, /class="brand-thread-ticket surface-plate"/);
  assert.match(html, /class="brand-thread-lead">The design system is a base too\./);
  /* The note shows the current pair, but never the nav chip's caption: the
     tiles tie it to the studio, the prose keeps it a note. */
  const note = /<p class="brand-thread-ticket[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(html);
  assert.ok(note, 'the slip is one paragraph');
  assert.match(note[1], /class="swatch-pair"/);
  assert.doesNotMatch(note[1], /brand-trigger-label/);
  assert.doesNotMatch(html, /<button[^>]*brand-thread-ticket/);
  assert.match(html, /popovertarget="brand-panel"/i);
  assert.match(html, /data-island="theme"/);
  assert.match(html, /data-island="brand"/);
  assert.match(html, /id="top"/);
  assert.match(html, /id="your-brand"/);
  assert.match(html, /id="brand-panel"/);
  assert.match(html, /data-preset="arcane"/);
  assert.match(html, /id="brand-typeface"/);
  assert.match(html, /<option value="monaspace"[^>]*>Monaspace<\/option>/);
  assert.match(html, /class="lab-ds" href="\/design-system\/"/);
});

test('render: design system exposes every kit showcase', () => {
  const html = renderRoute('design-system');
  assert.match(html, /data-island="lab"/);
  for (const name of ['Button', 'Badge', 'Input', 'CodeBlock', 'AgentCard']) {
    assert.match(html, new RegExp(`<h3>${name}</h3>`), `missing ${name} showcase`);
  }
  assert.equal((html.match(/class="ds-showcase /g) || []).length, 5);
});

test('render: unknown routes fail loudly', () => {
  assert.throws(() => renderRoute('missing'), /Unknown route/);
});

/* The ending is the handoff: three doors to the same repo, then the stage.
   Both are promises to the reader, so they are asserted from the prerendered
   document rather than from the component that happens to render them. */
test('render: the ending hands the repo over and names the stage', () => {
  const html = renderRoute('home');
  const close = /<section class="section close"[\s\S]*?<\/section>/.exec(html);
  assert.ok(close, 'the ending is one panel');
  assert.match(close[0], /Yours to break\./, 'the ending names the handover ');
  assert.match(close[0], /href="https:\/\/goatdb\.dev"/, 'the team link opens the site');
  assert.equal((close[0].match(/class="repo-row"/g) || []).length, 7, 'the working copy lists seven files');
  const links = [...close[0].matchAll(/<a class="btn[^"]*" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(([, href, label]) => ({ href, label: label.replace(/<[^>]+>/g, '').trim() }));
  const base = 'https://github.com/agentmerlinai/merlin';
  assert.deepEqual(links.map((link) => link.href), [base, `${base}/fork`],
    'star and fork both resolve to the project');
  assert.deepEqual(links.map((link) => link.label), ['Star on GitHub', 'Fork it']);
  assert.equal((close[0].match(/rel="noopener"/g) || []).length, 3, 'every door opens safely');
  assert.match(close[0], /pre-alpha and under active development/, 'the stage sets the expectation');
  assert.match(close[0], /GoatDB/, 'the team is named');
  /* The claim states the guarantee, and the invitation answers it: one
     sentence each, so neither buries the doors. */
  assert.match(close[0], /come over to GitHub and lend a hand/, 'the ending asks for help');
  assert.doesNotMatch(close[0], /Deploy today/, 'a second closing row stays gone');
  assert.doesNotMatch(html, /One process\. One box\./, 'the duplicated line stays gone');
});

/* One source for the address: a second copy in a component would drift the day
   the repo moves, and only the reader would notice. */
test('render: the repo address has one source', () => {
  const root = 'apps/web/src';
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(?:tsx?|jsx?|mjs)$/.test(file))
    .filter((file) => !file.endsWith('data/project.ts'));
  for (const file of files) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /github\.com/, `${file} hardcodes the repo address`);
  }
});
