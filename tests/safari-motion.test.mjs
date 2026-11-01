/* Safari contract test: the same story, driven by the JavaScript playhead.
   WebKit 26 has scroll-driven animations but no animation triggers, so this
   suite asserts the things the trigger layer does in Chrome: the scene waits on
   its first frame at the page top, plays when the station is reached, settles on
   the worked frame, resets when the reader leaves, and the seam carries each
   work item exactly once.

   Run against the built artifact (dist/client) like the other browser suites:
   `npm run build && npm run test:safari`. Real Safari stays a manual check;
   Playwright WebKit is the engine contract. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { webkit } from 'playwright';
import { startServer } from '../scripts/serve-dist.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist/client');
const VIEWPORT = { width: 1440, height: 900 };

let server, base, browser;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(read, ms, label) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await read();
    if (last === true) return;
    await delay(60);
  }
  throw new Error(`timeout waiting for ${label}; last=${JSON.stringify(last)}`);
}

/* The page's own vocabulary: beats carry their point, the stage carries the
   panes, and the copy box's sticky `top` is the station line. No offset table
   and no state attribute exists to read, which is the point. */
const HELPERS = `(() => {
  const beats = () => [...document.querySelectorAll('.story-beat')];
  const stage = () => document.querySelector('[data-story-stage]');
  const pane = (n) => stage().querySelector('.story-pane[data-pane="' + n + '"]');
  const line = () => parseFloat(getComputedStyle(document.querySelector('.story-copy')).top);
  const at = (n) => beats()[n - 1].getBoundingClientRect().top + scrollY - line();
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height) }; };
  const op = (el) => (el ? Number(getComputedStyle(el).opacity) : 0);
  /* A scene is the finite, document-timeline part of a pane: a scrubbed seam
     has a view timeline and the caret blinks forever, so neither is a clock. */
  const clock = (n) => pane(n).getAnimations({ subtree: true }).filter((a) =>
    a.timeline instanceof DocumentTimeline && Number.isFinite(a.effect.getTiming().iterations));
  window.__w = {
    line, at, box, op, clock,
    go(y) { window.scrollTo(0, Math.round(y)); },
    settle: () => Math.round(scrollY),
    frame(n) {
      const p = pane(n);
      return { human: op(p.querySelector('.chat-turn--human')), agent: op(p.querySelector('.chat-turn--agent')), artifact: op(p.querySelector('.chat-artifact')) };
    },
    playhead(n) {
      const list = clock(n);
      return {
        count: list.length,
        paused: list.every((a) => a.playState === 'paused'),
        running: list.some((a) => a.playState === 'running'),
        settled: list.length > 0 && list.every((a) => a.playState === 'finished'),
        time: list.length ? Math.max(...list.map((a) => Number(a.currentTime) || 0)) : -1
      };
    },
    seam(n) {
      const st = stage();
      const carrier = st.querySelector('.story-carrier[data-seam="' + n + '"]');
      const source = pane(n).querySelector('.chat-artifact');
      const target = pane(n + 1).querySelector('.collab-paper');
      return {
        carrier: { op: op(carrier), ...box(carrier) },
        source: { vis: getComputedStyle(source).visibility, op: op(source), ...box(source) },
        target: { vis: getComputedStyle(target).visibility, box: box(target) },
        paneOut: op(pane(n)),
        paneIn: op(pane(n + 1))
      };
    }
  };
  return true;
})()`;

async function openPage({ reduce = false } = {}) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  /* Third-party analytics is not part of this contract and answers 403 offline.
     Everything the story loads is served by the artifact and must stay clean. */
  await page.route('https://cloud.umami.is/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(document.querySelector('[data-story-stage]')));
  await page.evaluate(HELPERS);
  /* The scroll is the test's instrument here, not the contract: a deterministic
     offset must not be re-snapped by the UA mid-assertion. */
  await page.evaluate(() => { document.documentElement.style.scrollSnapType = 'none'; });
  await delay(200);
  return { page, errors };
}

/* A programmatic scroll is animated in WebKit. Wait for three identical
   samples at the target, so a measurement never lands mid-flight. */
async function scrollTo(page, y) {
  await page.evaluate((target) => window.__w.go(target), y);
  let last = null;
  let stable = 0;
  await waitFor(async () => {
    const now = await page.evaluate('window.__w.settle()');
    stable = now === last ? stable + 1 : 0;
    last = now;
    return stable >= 3 && Math.abs(now - y) < 2;
  }, 6000, `scroll to ${y}`);
  await delay(120);
}

before(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'build the artifact first: npm run build');
  server = await startServer(DIST);
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await webkit.launch();
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('platform: WebKit has the scrub layer, the JS clock is the playhead', async () => {
  const { page, errors } = await openPage();
  const caps = await page.evaluate(`({
    view: CSS.supports('animation-timeline: view()'),
    trigger: CSS.supports('animation-trigger: --t play-forwards')
  })`);
  assert.equal(caps.view, true, 'view timelines drive the chapter');
  assert.equal(caps.trigger, false, 'this engine has no trigger layer: the JS clock is in charge');
  await page.waitForFunction(() => window.__w.playhead(1).count > 0, null, { timeout: 5000 });
  assert.equal((await page.evaluate('window.__w.playhead(1)')).paused, true, 'the JS clock parked the scene');
  assert.deepEqual(errors, [], 'page errors');
  await page.close();
});

test('page top: the chat waits on its first frame', async () => {
  const { page } = await openPage();
  await page.waitForFunction(() => window.__w.playhead(1).paused, null, { timeout: 5000 });
  const frame = await page.evaluate('window.__w.frame(1)');
  assert.deepEqual(frame, { human: 0, agent: 0, artifact: 0 }, 'the composer is empty until its beat plays');
  assert.equal((await page.evaluate('window.__w.op(document.querySelector(\'.story-pane[data-pane="1"]\'))')), 1, 'pane 1 is the surface');
  assert.equal((await page.evaluate('window.__w.playhead(1)')).time, 0, 'first frame, not a mid-scene pose');
  await page.close();
});

test('station: the clock plays once and settles on the worked frame', async () => {
  const { page, errors } = await openPage();
  await scrollTo(page, await page.evaluate('window.__w.at(1)'));
  await waitFor(() => page.evaluate('window.__w.playhead(1).settled'), 12000, 'scene 1 settle');
  const frame = await page.evaluate('window.__w.frame(1)');
  assert.deepEqual(frame, { human: 1, agent: 1, artifact: 1 }, 'the worked frame is the scene end');
  assert.deepEqual(errors, [], 'page errors');
  await page.close();
});

test('leave resets, return replays', async () => {
  const { page } = await openPage();
  const station = await page.evaluate('window.__w.at(1)');
  await scrollTo(page, station);
  await waitFor(() => page.evaluate('window.__w.playhead(1).settled'), 12000, 'scene 1 settle');
  await scrollTo(page, 0);
  await waitFor(() => page.evaluate('window.__w.playhead(1).paused'), 4000, 'scene 1 reset');
  assert.deepEqual(await page.evaluate('window.__w.frame(1)'), { human: 0, agent: 0, artifact: 0 },
    'a re-entered beat starts from its first frame');
  await scrollTo(page, station);
  await waitFor(() => page.evaluate('window.__w.playhead(1).running'), 4000, 'scene 1 replay');
  const replay = await page.evaluate('window.__w.playhead(1)');
  assert.ok(replay.time > 0 && replay.time < 6000, `replay runs from the start: ${replay.time}`);
  await page.close();
});

test('seam 1: one item, carried between the two boxes', async () => {
  const { page, errors } = await openPage();
  const station = await page.evaluate('window.__w.at(1)');
  const height = await page.evaluate('document.querySelectorAll(".story-beat")[0].getBoundingClientRect().height');
  await scrollTo(page, station + height * 0.72);
  const seam = await page.evaluate('window.__w.seam(1)');
  assert.ok(seam.source.op <= 0.05 && seam.source.vis === 'hidden', 'the source copy is cut, not faded');
  assert.ok(seam.carrier.op > 0.5, 'the proxy is the visible copy');
  assert.ok(seam.carrier.top > seam.target.box.top && seam.carrier.top < seam.source.top,
    `the proxy flies between the two boxes: ${JSON.stringify(seam)}`);
  assert.ok(seam.carrier.height > seam.source.height && seam.carrier.height < seam.target.box.height,
    'the proxy grows from the card to the page');
  /* The crossfade is mid-window, so neither surface owns the stage: the proxy
     is the one copy of the item while the item's own copy is cut. */
  assert.ok(seam.paneIn < 0.9 && seam.paneOut > 0.1, `the swap is in flight: ${JSON.stringify(seam)}`);
  assert.ok(seam.carrier.op >= seam.paneIn && seam.carrier.op >= seam.paneOut,
    'the proxy is the strongest surface: the item is what the reader follows');
  assert.deepEqual(errors, [], 'page errors');
  await page.close();
});

test('landed: the swap completes and the duplicate is gone', async () => {
  const { page } = await openPage();
  await scrollTo(page, await page.evaluate('window.__w.at(2)'));
  const seam = await page.evaluate('window.__w.seam(1)');
  assert.ok(seam.paneOut <= 0.05, 'pane 1 is gone');
  assert.ok(seam.paneIn >= 0.95, 'pane 2 owns the stage');
  assert.ok(seam.carrier.op <= 0.05, 'the proxy is gone');
  assert.equal(seam.source.vis, 'hidden', 'the carried copy never returns');
  await page.close();
});

test('reduced motion: the worked frame, no playhead', async () => {
  const { page } = await openPage({ reduce: true });
  await scrollTo(page, await page.evaluate('window.__w.at(1)'));
  const playhead = await page.evaluate('window.__w.playhead(1)');
  assert.equal(playhead.count, 0, 'no scene clock runs without motion');
  assert.deepEqual(await page.evaluate('window.__w.frame(1)'), { human: 1, agent: 1, artifact: 1 },
    'the still page shows the information, not a blank first frame');
  assert.equal((await page.evaluate('window.__w.seam(1)')).carrier.op, 0, 'no proxy without motion');
  await page.close();
});
