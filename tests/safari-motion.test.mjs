/* Safari contract test: the story as the reader sees it.

   WebKit scrubs the chapter with view timelines but has no animation triggers,
   so the chat scene is driven by the island's JS clock; Chrome drives the same
   keyframes from the trigger layer. Two playheads, one story — so every
   assertion below is a rendered fact (visibility, opacity, box), never a play
   state or a currentTime. Any engine, and any rewrite, that shows these frames
   passes.

   The contract: the chat waits on its first frame at the page top, reaches its
   worked frame at the station, holds it, resets when the reader leaves,
   replays on return, and the seam carries each work item exactly once.
   Reduced motion shows the worked frame and holds it still.

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

/* The bookends of the chat scene, as a reader sees them: the composer is empty
   until the beat plays, and the worked frame is the scene's information. */
const FIRST = { human: 0, agent: 0, artifact: 0 };
const WORKED = { human: 1, agent: 1, artifact: 1 };

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

/* A painted frame matches a bookend when every face is at its opacity. */
const near = (frame, want) =>
  Object.keys(want).every((key) => Math.abs(frame[key] - want[key]) <= 0.01);

/* The page's own vocabulary: beats carry their point, the stage carries the
   panes, and the copy box's sticky `top` is the station line. No offset table
   and no state attribute exists to read, which is the point. */
const HELPERS = `(() => {
  const beats = () => [...document.querySelectorAll('.story-beat')];
  const stage = () => document.querySelector('[data-story-stage]');
  const pane = (n) => stage().querySelector('.story-pane[data-pane="' + n + '"]');
  /* The station has one owner (site.css). A still page lays the copy out in the
     flow, so there \`top\` may be auto; the token is the same fact. */
  const line = () => {
    const copy = document.querySelector('.story-copy');
    const top = copy ? parseFloat(getComputedStyle(copy).top) : NaN;
    if (Number.isFinite(top)) return top;
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--story-station')) || 0;
  };
  const at = (n) => beats()[n - 1].getBoundingClientRect().top + scrollY - line();
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height) }; };
  const op = (el) => (el ? Number(getComputedStyle(el).opacity) : 0);
  window.__w = {
    at, op,
    go(y) { window.scrollTo(0, Math.round(y)); },
    settle: () => Math.round(scrollY),
    frame(n) {
      const p = pane(n);
      return { human: op(p.querySelector('.chat-turn--human')), agent: op(p.querySelector('.chat-turn--agent')), artifact: op(p.querySelector('.chat-artifact')) };
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
  /* The test's instruments, not the contract: a deterministic offset must not
     be re-snapped or smoothed by the UA mid-assertion. */
  await page.evaluate(() => {
    document.documentElement.style.scrollSnapType = 'none';
    document.documentElement.style.scrollBehavior = 'auto';
  });
  /* Fonts move the measured boxes the seam flies to. */
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true));
  await delay(200);
  return { page, errors };
}

/* One frame for the scroll to apply, one for the scroll-linked timelines to
   paint the offset it set. */
async function jump(page, y) {
  const landed = await page.evaluate(async (target) => {
    window.__w.go(target);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return window.__w.settle();
  }, y);
  assert.ok(Math.abs(landed - y) < 2, `the scroll landed at ${landed}, not ${y}`);
}

function waitForFrame(page, want, ms, label) {
  return waitFor(async () => near(await page.evaluate('window.__w.frame(1)'), want), ms, label);
}

/* The swap window is authored in CSS, so the test keeps no second copy of it:
   it walks the beat's travel and judges each sample by the rendered facts that
   say the swap is in flight. */
function sweepSeam(page, from, to) {
  const steps = 60;
  return page.evaluate(async ({ from, to, steps }) => {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(from + (to - from) * (i / steps));
      window.__w.go(y);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      out.push({ y, ...window.__w.seam(1) });
    }
    return out;
  }, { from, to, steps });
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

test('platform: the artifact can scrub the chapter', async () => {
  const { page, errors } = await openPage();
  /* A precondition, not a contract: without view timelines site.css ships its
     one-surface fallback, and every crossfade read below has nothing to show.
     The playhead is deliberately not asserted — the trigger layer and the
     island's JS clock must both satisfy the tests that follow. */
  assert.equal(await page.evaluate("CSS.supports('animation-timeline: view()')"), true,
    'this suite needs the scroll-linked layer');
  assert.deepEqual(errors, [], 'page errors');
  await page.close();
});

test('page top: the chat waits on its first frame', async () => {
  const { page } = await openPage();
  const first = await page.evaluate('window.__w.frame(1)');
  assert.ok(near(first, FIRST), `the composer is empty until its beat plays: ${JSON.stringify(first)}`);
  assert.equal(await page.evaluate('window.__w.op(document.querySelector(\'.story-pane[data-pane="1"]\'))'), 1,
    'pane 1 is the surface');
  const before = await page.evaluate('window.__w.frame(1)');
  await delay(250);
  assert.deepEqual(await page.evaluate('window.__w.frame(1)'), before,
    'the first frame holds while the reader sits at the top');
  await page.close();
});

test('station: the scene arrives on the worked frame and holds', async () => {
  const { page, errors } = await openPage();
  await jump(page, await page.evaluate('window.__w.at(1)'));
  await waitForFrame(page, WORKED, 12000, 'scene 1 worked frame');
  const worked = await page.evaluate('window.__w.frame(1)');
  assert.ok(near(worked, WORKED), `the scene ends on its worked frame: ${JSON.stringify(worked)}`);
  await delay(300);
  assert.deepEqual(await page.evaluate('window.__w.frame(1)'), worked, 'the worked frame holds');
  assert.deepEqual(errors, [], 'page errors');
  await page.close();
});

test('leave resets, return replays', async () => {
  const { page } = await openPage();
  const station = await page.evaluate('window.__w.at(1)');
  await jump(page, station);
  await waitForFrame(page, WORKED, 12000, 'scene 1 worked frame');
  await jump(page, 0);
  await waitForFrame(page, FIRST, 4000, 'scene 1 reset');
  /* Sampled inside the jump: a replay starts from the first frame, so the
     reader must not see the worked frame yet. One round trip keeps the sample
     inside the scene's opening delay, however slow the runner is. */
  const reentered = await page.evaluate(async (target) => {
    window.__w.go(target);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { y: window.__w.settle(), frame: window.__w.frame(1) };
  }, station);
  assert.ok(Math.abs(reentered.y - station) < 2, `the scroll landed at ${reentered.y}, not ${station}`);
  assert.ok(near(reentered.frame, FIRST),
    `a re-entered beat starts from its first frame: ${JSON.stringify(reentered.frame)}`);
  await waitForFrame(page, WORKED, 12000, 'scene 1 replay');
  await page.close();
});

test('seam 1: one item, carried between the two boxes', async () => {
  const { page, errors } = await openPage();
  const samples = await sweepSeam(page,
    await page.evaluate('window.__w.at(1)'),
    await page.evaluate('window.__w.at(2)'));
  /* Both surfaces partly transparent is the rendered fact that says the swap
     is in flight; it owns the window, so no offset table does. */
  const inFlight = samples.filter((s) => s.paneIn > 0.1 && s.paneIn < 0.9);
  const mid = samples.filter((s) => s.paneIn > 0.25 && s.paneIn < 0.75);
  assert.ok(mid.length > 0, `the swap never reaches its middle: ${JSON.stringify(samples.map((s) => s.paneIn))}`);
  for (const s of inFlight) {
    assert.ok(s.source.op <= 0.05 && s.source.vis === 'hidden',
      `the source copy is cut, not faded: ${JSON.stringify(s)}`);
    assert.ok(s.carrier.op > 0.5, `the proxy is the visible copy: ${JSON.stringify(s)}`);
    assert.ok(s.carrier.op >= s.paneIn && s.carrier.op >= s.paneOut,
      `the proxy is the strongest surface: the item is what the reader follows: ${JSON.stringify(s)}`);
  }
  for (const s of mid) {
    assert.ok(s.carrier.top > s.target.box.top && s.carrier.top < s.source.top,
      `the proxy flies between the two boxes: ${JSON.stringify(s)}`);
    assert.ok(s.carrier.height > s.source.height && s.carrier.height < s.target.box.height,
      `the proxy grows from the card to the page: ${JSON.stringify(s)}`);
  }
  assert.deepEqual(errors, [], 'page errors');
  await page.close();
});

test('landed: the swap completes and the duplicate is gone', async () => {
  const { page } = await openPage();
  await jump(page, await page.evaluate('window.__w.at(2)'));
  const seam = await page.evaluate('window.__w.seam(1)');
  assert.ok(seam.paneOut <= 0.05, 'pane 1 is gone');
  assert.ok(seam.paneIn >= 0.95, 'pane 2 owns the stage');
  assert.ok(seam.carrier.op <= 0.05, 'the proxy is gone');
  assert.equal(seam.source.vis, 'hidden', 'the carried copy never returns');
  await page.close();
});

test('reduced motion: the worked frame, still', async () => {
  const { page } = await openPage({ reduce: true });
  await jump(page, await page.evaluate('window.__w.at(1)'));
  /* No polling: motion is off, so the station shows the information on its
     first painted frame. A scene that waits for a playhead is blank here. */
  const frame = await page.evaluate('window.__w.frame(1)');
  assert.ok(near(frame, WORKED), `the still page shows the information, not a blank first frame: ${JSON.stringify(frame)}`);
  await delay(400);
  assert.deepEqual(await page.evaluate('window.__w.frame(1)'), frame, 'nothing moves without motion');
  assert.equal((await page.evaluate('window.__w.seam(1)')).carrier.op, 0, 'no proxy without motion');
  await page.close();
});
