import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { renderRoute } from '../dist/server/entry-server.js';
import { ICON_KITS } from '../packages/theme/kits.js';

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
  /* The kit is the first standalone section after the story: it carries the
     one hands-on control set and no chapter numeral. */
  assert.ok(html.indexOf('id="kit"') > html.indexOf('id="chapter-6"'),
    'the kit follows the six chapters');
  assert.ok(html.indexOf('id="kit"') < html.indexOf('id="tailor"'),
    'the kit precedes the ending');
  assert.match(html, /class="section kit"/);
  assert.match(html, /data-island="kit"/);
  assert.match(html, /data-label="The kit"/);
  assert.match(html, /The design system is a base too\./);
  assert.match(html, /Adapt it to your brand, not the other way around\./);
  assert.match(html, /data-preset="arcane"/);
  assert.match(html, /data-kit-tab="colour"/);
  assert.match(html, /id="kit-primary-hue"/);
  assert.match(html, /id="kit-accent-hue"/);
  assert.match(html, /data-typeface="monaspace"/);
  assert.match(html, /data-kit-choice="phosphor"/);
  assert.match(html, /data-radius="soft"/);
  assert.match(html, /href="\/design-system\/"/);
  /* No second door: the badge, the leader, and the nav studio are gone. */
  assert.doesNotMatch(html, /brand-thread/);
  assert.doesNotMatch(html, /brand-trigger/);
  assert.doesNotMatch(html, /brand-panel/);
  assert.doesNotMatch(html, /your-brand/);
  assert.match(html, /data-island="theme"/);
  assert.match(html, /id="top"/);
});

/* The kit specimen is the live icon surface: a kit switch must repaint the
   mock, not only the control tiles. Ten distinct glyphs is the floor. */
test('render: the kit specimen repaints the whole mock', () => {
  const html = renderRoute('home');
  const start = html.indexOf('class="kit-specimen"');
  const end = html.indexOf('class="kit-controls"');
  assert.ok(start !== -1 && end > start, 'the specimen sits before the controls');
  const names = new Set(
    [...html.slice(start, end).matchAll(new RegExp(`#${ICON_KITS.phosphor.sprite}-([a-z0-9-]+)`, 'g'))]
      .map(([, name]) => name)
  );
  assert.ok(names.size >= 10,
    `the specimen carries ${names.size} glyphs; the kit must touch every zone`);
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
