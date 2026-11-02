/* Real-browser contract test for the hero story.
   The contract: scroll snaps to the nearest station; the chapter identity and
   the intro are pure CSS timelines of the page's scroll, so the copy is already
   in place on the frame the station is reached; each surface's scene is a CSS
   trigger clock that starts at its station and resets at the next one; the work
   item morphs on the way; the page is the only scroller, so a wheel, a momentum
   gesture and a key all leave the story the same way; and the story never
   writes the scroll position.

   Only public page state is read: element boxes, computed opacity/visibility,
   scroll positions and the browser's animation objects. No station, clock or
   phase attribute is read because the page no longer writes one. */
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../scripts/serve-dist.mjs';
import { css as siteCss } from './support/css-source.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = path.join(ROOT, 'dist/client');
const CHROME_BIN = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Users/ofri/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find((p) => p && fs.existsSync(p));

const VIEWPORTS = [
  { width: 1440, height: 900, mobile: false },
  { width: 390, height: 844, mobile: true }
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
/* Two boxes are the same frame when position and size agree: a seam's whole
   contract is that the proxy ends on the box it was measured against. */
const gap = (a, b) => Math.abs(a.left - b.left) + Math.abs(a.top - b.top) +
  Math.abs(a.width - b.width) + Math.abs(a.height - b.height);

async function waitFor(fn, ms, label) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last === true) return;
    await delay(30);
  }
  throw new Error(`timeout waiting for ${label}; last=${JSON.stringify(last)}`);
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
      } else (this.handlers.get(m.method) || []).forEach((fn) => fn(m.params));
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
}

/* Page-side helpers. A station's offset is the beat top resolved onto the
   copy's sticky line on the page's scroller, the same edge the CSS snaps and
   insets. The window, not a nested deck, is what moves in the story. */
const HELPERS = `(() => {
  const beats = () => [...document.querySelectorAll('[data-story-beat]')];
  const stage = () => document.querySelector('[data-story-stage]');
  const line = () => parseFloat(getComputedStyle(document.querySelector('.story-copy')).top);
  const travel = (n) => beats()[n - 1].getBoundingClientRect().height;
  const offset = (n) => Math.round(scrollY + beats()[n - 1].getBoundingClientRect().top - line());
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
  const opacity = (el) => el && el.nodeType === 1 ? Number(getComputedStyle(el).opacity) : 0;
  const copyEl = (n) => beats()[n - 1].querySelector('.story-copy');
  const pane = (n) => stage().querySelector('.story-pane[data-pane="' + n + '"]');
  /* The composer's caret blinks on its own clock from first paint; it is not
     a scene slice, so it must not vote on the playhead. */
  const isCaret = (a) => a.effect.target instanceof Element &&
    a.effect.target.classList.contains('chat-caret');
  const sceneAnims = (n) => pane(n).getAnimations({ subtree: true })
    .filter((a) => a.timeline instanceof DocumentTimeline && !isCaret(a));
  window.__h = {
    line, offset, travel, box, opacity,
    state() {
      return {
        y: Math.round(scrollY),
        max: Math.round(document.documentElement.scrollHeight - innerHeight)
      };
    },
    offsets() { return beats().map((_, i) => offset(i + 1)); },
    go(y) { window.scrollTo({ top: Math.round(y), behavior: 'instant' }); },
    snap(v) { document.documentElement.style.scrollSnapType = v; },
    beat(n) { const b = beats()[n - 1]; return { top: Math.round(b.getBoundingClientRect().top), height: Math.round(b.getBoundingClientRect().height) }; },
    copy(n) {
      const box = copyEl(n);
      const track = box.querySelector('.story-copy-track');
      const b = getComputedStyle(box);
      const t = getComputedStyle(track);
      const br = box.getBoundingClientRect();
      return {
        op: Number(b.opacity),
        trackOp: Number(t.opacity),
        vis: t.visibility,
        boxVis: b.visibility,
        boxTop: Number(br.top.toFixed(1))
      };
    },
    intro() {
      const cs = getComputedStyle(document.querySelector('.story-intro'));
      return { op: Number(cs.opacity), vis: cs.visibility };
    },
    /* The station is the chapter the reader can see, not a token. The track's
       visibility is the effective one: it inherits the box gate and adds the
       exit step, so an off-station chapter never owns the face. */
    station() {
      const at = beats().findIndex((b) => {
        const box = b.querySelector('.story-copy');
        const track = b.querySelector('.story-copy-track');
        return getComputedStyle(track).visibility === 'visible' &&
          Number(getComputedStyle(box).opacity) > 0.5;
      });
      return at + 1;
    },
    scene(n) {
      const live = sceneAnims(n);
      return {
        count: live.length,
        running: live.filter((a) => a.playState === 'running').length,
        paused: live.filter((a) => a.playState === 'paused').length,
        /* The scene is still when every time-driven slice has finished: the
           board's windows are each a share of the clock, so no slice runs the
           whole scene. Idle (not yet triggered) is not still. */
        settled: live.length > 0 && live.every((a) => a.playState === 'finished'),
        playhead: live.length ? Math.round(Math.max(...live.map((a) => Number(a.currentTime) || 0))) : -1
      };
    },
    playhead(n) { const s = this.scene(n); return s.playhead; },
    frame(n) {
      const p = pane(n);
      const op = (sel) => { const el = p.querySelector(sel); return el ? opacity(el) : null; };
      const node = p.querySelector('.collab-note[data-item="cutover"]');
      const typed = p.querySelector('.collab-ins');
      return {
        arrive: op('.rota-landed'),
        fill: op('.rota-status--done'),
        /* Every rota line speaks through opacity, so this waits on paint. */
        record: n === 4 ? op('.rota-audit') : null,
        check: op('.todo-check'),
        node: node ? node.getBoundingClientRect().left : null,
        artifact: op('.chat-artifact'),
        human: op('.chat-turn--human'),
        typed: typed ? parseFloat(getComputedStyle(typed).width) : null
      };
    },
    /* A seam is a set of items: what leaves the source surface and where each
       one lands. Both lists are in plan order, so item i of the sources and
       item i of the arrivals describe one flight (the canvas has three). */
    seam(n) {
      const st = stage();
      const list = (sel) => [...st.querySelectorAll(sel)];
      const item = (el) => ({
        item: el.dataset.item || '',
        box: box(el),
        visibility: getComputedStyle(el).visibility
      });
      return {
        carriers: list('.story-carrier[data-seam="' + n + '"]').map((el) => (
          { item: el.dataset.item || '', box: box(el), opacity: opacity(el) }
        )),
        sources: list('[data-anchor="' + n + '"]').map(item),
        arrivals: list('[data-arrive="' + n + '"]').map(item),
        paneOut: opacity(st.querySelector('.story-pane[data-pane="' + n + '"]')),
        paneIn: opacity(st.querySelector('.story-pane[data-pane="' + (n + 1) + '"]'))
      };
    }
  };
  return true;
})()`;

let server, baseUrl, chrome, profileDir, cdp, cdpWs;
let exceptions = [], consoleErrors = [];

async function evaluate(expression) {
  const out = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (out.exceptionDetails) throw new Error(`page eval failed: ${out.exceptionDetails.exception?.description || out.exceptionDetails.text}`);
  return out.result.value;
}
const state = () => evaluate('window.__h.state()');
const copy = (n) => evaluate(`window.__h.copy(${n})`);
const intro = () => evaluate('window.__h.intro()');
const station = () => evaluate('window.__h.station()');
const scene = (n) => evaluate(`window.__h.scene(${n})`);
const playhead = (n) => evaluate(`window.__h.playhead(${n})`);
const frame = (n) => evaluate(`window.__h.frame(${n})`);
const seam = (n) => evaluate(`window.__h.seam(${n})`);
const offset = (n) => evaluate(`window.__h.offset(${n})`);
const travel = (n) => evaluate(`window.__h.travel(${n})`);
const go = (y) => evaluate(`window.__h.go(${y})`);

/* A snap is an animation, not a jump: four stable samples ended before the UA
   finished re-snapping, so a key pressed right after a station landed mid-flight
   and was dropped. Wait for a still page, then give the snap one more frame. */
async function waitSettled() {
  await delay(80);
  let last = null, stable = 0;
  await waitFor(async () => {
    const pos = String(await evaluate('Math.round(scrollY)'));
    stable = pos === last ? stable + 1 : 0;
    last = pos;
    return stable >= 8;
  }, 4000, 'scroll settle');
  await delay(150);
}

async function snapTo(n) {
  await go(await offset(n));
  await waitSettled();
  await waitFor(async () => (await station()) === n, 3000, `station ${n}`);
  /* A snap is an animation. A key pressed while it runs is coalesced into it
     and lost, which is not something a reader can do. */
  await delay(300);
}

async function wheel(dy) {
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel', x: 400, y: 400, deltaX: 0, deltaY: dy, pointerType: 'mouse'
  });
}

async function pressKey(key, code, vk) {
  for (const type of ['rawKeyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
}

async function setViewport({ width, height, mobile }) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await evaluate('window.scrollTo({ top: 0, behavior: "instant" })');
  await delay(200);
  await evaluate('window.__h.snap("")');
  await evaluate('window.__h.go(0)');
  await delay(120);
  assert.equal(await evaluate('[innerWidth, innerHeight].join("x")'), `${width}x${height}`, 'test viewport');
}

async function launchChrome() {
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-story-'));
  chrome = spawn(CHROME_BIN, [
    '--headless', '--no-sandbox', '--hide-scrollbars', '--window-size=1280,800',
    '--remote-debugging-port=0', `--user-data-dir=${profileDir}`,
    '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.on('data', () => {});
  let port, target;
  await waitFor(() => {
    try {
      port = Number(fs.readFileSync(path.join(profileDir, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      return Number.isInteger(port) && port > 0;
    } catch { return false; }
  }, 15000, 'DevToolsActivePort');
  await waitFor(async () => {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
      return Boolean(target?.webSocketDebuggerUrl);
    } catch { return false; }
  }, 15000, 'page target');
  cdpWs = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    cdpWs.addEventListener('open', resolve, { once: true });
    cdpWs.addEventListener('error', reject, { once: true });
  });
  cdp = new CDP(cdpWs);
  cdp.on('Runtime.exceptionThrown', (p) => exceptions.push(p.exceptionDetails.text));
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') consoleErrors.push(p.args.map((a) => a.value ?? a.description).join(' '));
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await load();
}

async function waitMarkup() {
  await waitFor(() => evaluate(`Boolean(document.querySelector('[data-story-stage]')) &&
    Boolean(document.querySelector('.hero')) &&
    document.querySelectorAll('[data-story-beat]').length === 6`), 10000, 'story markup');
  await evaluate('document.fonts.ready.then(() => true)');
  await delay(120);
  await evaluate(HELPERS);
}

async function load() {
  const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
  await cdp.send('Page.navigate', { url: baseUrl });
  await loaded;
  await waitMarkup();
}

async function reload() {
  const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
  await cdp.send('Page.reload');
  await loaded;
  await waitMarkup();
}

if (!CHROME_BIN) {
  test('hero story: Chrome unavailable', { skip: 'No Chrome binary found' }, () => {});
} else {
  before(async () => {
    server = await startServer(DOCS);
    baseUrl = `http://127.0.0.1:${server.address().port}/`;
    await launchChrome();
  });

  after(async () => {
    try { cdpWs?.close(); } catch {}
    if (chrome?.exitCode === null) {
      await new Promise((resolve) => { chrome.once('exit', resolve); chrome.kill('SIGKILL'); });
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    if (profileDir) fs.rmSync(profileDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    exceptions = []; consoleErrors = [];
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await setViewport(VIEWPORTS[0]);
    await go(0);
    await waitSettled();
  });

  afterEach(() => {
    assert.deepEqual(exceptions, [], 'page exceptions');
    assert.deepEqual(consoleErrors, [], 'page console errors');
  });

  test('platform: the story runs on view timelines and a scene playhead', async () => {
    const support = await evaluate(`({
      view: CSS.supports('animation-timeline: view()'),
      trigger: CSS.supports('animation-trigger: --t play-forwards'),
      /* Either playhead is a playhead: Chrome's trigger layer, or the JS clock
         that drives the same keyframes where the layer is missing. */
      clock: Boolean(document.querySelector('[data-story-stage]')
        ?.querySelector('.story-pane[data-pane="1"] .chat-prompt')
        ?.getAnimations().length)
    })`);
    assert.equal(support.view, true, 'view timelines drive the chapter');
    assert.equal(support.clock, true, 'a scene playhead exists: trigger or JS clock');
    /* This suite drives Chrome, so the trigger layer must be the one in charge;
       the JS clock is a no-op there (see tests/safari-motion.test.mjs). */
    assert.equal(support.trigger, true, 'animation triggers drive the scene playhead');
  });

  test('markup: one scroller, one point per panel, no rest areas', async () => {
    const page = await evaluate(`({
      beats: document.querySelectorAll('[data-story-beat]').length,
      anchors: document.querySelectorAll('[data-anchor]').length,
      arrivals: document.querySelectorAll('[data-arrive]').length,
      carriers: document.querySelectorAll('.story-carrier').length,
      tracks: document.querySelectorAll('.story-copy-track').length,
      snap: getComputedStyle(document.documentElement).scrollSnapType,
      hero: getComputedStyle(document.querySelector('.hero')).overflowY,
      /* The page is the only scroller: a descendant with scrollable overflow
         would make the reader chain out of it again. */
      nested: [...document.querySelector('.hero').querySelectorAll('*')]
        .filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
          el.scrollHeight > el.clientHeight + 1)
        .map((el) => el.className),
      points: document.querySelectorAll('.snap-point').length,
      /* The deck rests on panel tops only: every panel carries exactly one
         point, and no panel is a snap area of its own. */
      bare: [...document.querySelectorAll('.hero, .story-beat, .section, .close')]
        .filter((el) => el.querySelectorAll(':scope > .snap-point').length !== 1)
        .map((el) => el.id || el.className),
      stops: [...document.querySelectorAll('.snap-point')]
        .map((el) => getComputedStyle(el).scrollSnapStop),
      rests: [...document.querySelectorAll('.hero, .section, .close, .story-beat')]
        .filter((el) => getComputedStyle(el).scrollSnapAlign !== 'none')
        .map((el) => el.className),
      station: getComputedStyle(document.querySelector('.story-copy')).top,
      written: ['data-station', 'data-phase', 'data-seq', 'data-clock', 'aria-current']
        .filter((name) => document.querySelector('.hero [' + name + ']'))
    })`);
    assert.equal(page.beats, 6);
    /* Ten surfaces offer the work item that leaves them — one per boundary,
       plus the canvas's three tiles and the rota's three notes and its open
       slot — and each of the five seams declares where its items land. The
       plan's own sheet is the fifth, so the app becomes part of the stack. */
    assert.equal(page.anchors, 10);
    assert.equal(page.arrivals, 10);
    assert.equal(page.tracks, 6, 'each chapter carries one masked track');
    assert.equal(page.carriers, 10);
    assert.match(page.snap, /^y mandatory$/, 'the page commits to the nearer panel');
    assert.equal(page.hero, 'clip', 'the hero clips without becoming a scrollport');
    assert.deepEqual(page.nested, [], 'the page is the only scroller');
    assert.equal(page.points, 8, 'one point per panel; the last panel is the document end');
    assert.deepEqual(page.bare, [], 'every panel carries exactly one point');
    assert.deepEqual([...new Set(page.stops)], ['always'], 'one gesture must not fly over a station');
    assert.deepEqual(page.rests, [], 'no block may be a snap area');
    assert.ok(parseFloat(page.station) > 0, 'station is a line');
    assert.deepEqual(page.written, [], 'the story writes no state attribute');
  });

  test('page top: the invitation owns the first frame', async () => {
    const s = await state();
    assert.equal(s.y, 0, 'no self-scroll on load');
    assert.equal(await station(), 0, 'no chapter yet');
    const i = await intro();
    assert.ok(i.op > 0.95 && i.vis === 'visible', 'the invitation is shown');
    const c = await copy(1);
    assert.ok(c.vis === 'hidden', `the first chapter waits for its station (${c.vis})`);
    const sc = await scene(1);
    assert.equal(sc.running, 0, 'the chat does not play at the intro');
    assert.equal(sc.playhead, 0, 'the chat holds its first frame');
    const f = await frame(1);
    assert.ok(f.artifact <= 0.05, `artifact has not landed (${f.artifact})`);
    assert.ok(f.human <= 0.05, `turn has not been sent (${f.human})`);
  });

  test('page top: only the chat surface is painted', async () => {
    /* A later pane must not paint before its arrival. The plan's field is
       opaque, so a `both` fill on its exit would paint the plan over the
       intro; the pane's arrival list is the contract. */
    const painted = await evaluate(`[...document.querySelectorAll('.story-pane')]
      .map((el) => Number(getComputedStyle(el).opacity) > 0.05)`);
    assert.deepEqual(painted, [true, false, false, false, false, false],
      'only pane 1 is painted at the page top');
  });

  test('page top: the empty prompt blinks its caret', async () => {
    const read = () => evaluate(`(() => {
      const hint = document.querySelector('.chat-composer-hint--empty');
      return {
        text: hint.textContent.trim(),
        hint: Number(getComputedStyle(hint).opacity),
        caret: Number(getComputedStyle(hint.querySelector('.chat-caret')).opacity)
      };
    })()`);
    const start = await read();
    assert.match(start.text, /Ask anything/, 'the intro offers the empty prompt');
    assert.ok(start.hint > 0.95, 'the empty prompt is shown');
    await waitFor(async () => (await read()).caret > 0.5, 2000, 'caret on');
    await waitFor(async () => (await read()).caret < 0.5, 2000, 'caret off');
    assert.equal((await state()).y, 0, 'the caret loop does not move the page');
  });

  test('page top: a nudge returns to the invitation', async () => {
    /* The intro is the first panel and carries the page-top point, so a short
       gesture is pulled back to it: no half-scrolled invitation, and no
       chapter starting from a gesture that never reached a station. */
    await wheel(90);
    await waitSettled();
    const s = await state();
    assert.ok(s.y >= 0 && s.y < 2, `the nudge returns to the intro (y=${s.y})`);
    assert.equal(await station(), 0, 'still no chapter');
    assert.equal((await scene(1)).playhead, 0, 'a short gesture cannot start a scene');
    const f = await frame(1);
    assert.ok(f.artifact <= 0.05 && f.human <= 0.05, `no end frame at the intro (${f.artifact}/${f.human})`);
  });

  test('station: the first chapter is already visible on the arrival frame', async () => {
    /* The old defect was a settle wait (up to 0.5 s) before the fade. The copy
       is now a timeline of the approach, so it must be at its final frame as
       soon as the station is reached, with no transition to wait for. */
    await go(await offset(1));
    await delay(50);
    const c = await copy(1);
    assert.ok(c.op > 0.95 && c.vis === 'visible', `chapter shown at once (${c.op}/${c.vis})`);
    assert.equal(await station(), 1);
    const i = await intro();
    assert.ok(i.op <= 0.05 && i.vis === 'hidden', `the invitation left (${i.op}/${i.vis})`);
  });

  test('station: the scene starts at the station, not on the approach', async () => {
    await evaluate('window.__h.snap("none")');
    const at = await offset(1);
    await go(at - 140);
    await delay(200);
    assert.equal((await scene(1)).running, 0, 'the scene has not started before the station');
    assert.equal((await scene(1)).playhead, 0, 'the scene holds its first frame on approach');
    await go(at);
    await delay(120);
    assert.ok((await scene(1)).running > 0, 'the scene plays on arrival');
    await waitFor(async () => (await frame(1)).artifact > 0.9, 6000, 'the scene plays to its artifact');
    await evaluate('window.__h.snap("")');
    await go(0);
    await waitSettled();
  });

  test('autoplay: a settled scene plays with no scroll input', async () => {
    /* A fresh load is the only way to observe the first frame: the scene clock
       starts on arrival and a page that already ran it cannot show it again. */
    await reload();
    await go(await offset(4));
    const y = (await state()).y;
    assert.ok((await frame(4)).arrive < 0.9, 'the scene starts before its worked frame');
    await waitFor(async () => (await frame(4)).arrive > 0.9, 6000, 'the scene plays');
    assert.equal((await state()).y, y, 'the page did not move');
  });

  test('snap: a gesture that ends near a station settles on it', async () => {
    /* Mandatory snapping commits to the nearer panel: a station captures the
       reader once the gesture lands past the midpoint. Once it does, the
       station is exact — the anchor offset of the page is subtracted by the
       point's own margin, so the copy lands on the line. */
    for (const n of [1, 3, 5]) {
      await snapTo(n);
      await go((await offset(n + 1)) - 120);
      await waitSettled();
      assert.equal(await station(), n + 1, `station ${n} advanced one`);
      assert.ok(Math.abs((await state()).y - (await offset(n + 1))) <= 3, 'settled on the station');
    }
  });

  test('snap: a long gesture crosses stations and never stalls', async () => {
    /* The deck absorbed every delta once it reached its last chapter: the page
       could not move until the gesture restarted. The page owns the scroll now,
       so one gesture travels and the next one still travels. */
    await snapTo(1);
    await wheel(3000);
    await waitSettled();
    const first = (await state()).y;
    assert.ok(first > (await offset(1)) + 2000, `the gesture crossed stations (${first})`);
    await wheel(3000);
    await waitSettled();
    assert.ok((await state()).y > first, 'and the next gesture still moves the page');
  });

  test('snap: a short nudge returns to the station it left', async () => {
    for (const n of [1, 3, 5, 6]) {
      await snapTo(n);
      const at = await offset(n);
      await wheel(120);
      await waitSettled();
      const s = await state();
      assert.ok(Math.abs(s.y - at) <= 2, `station ${n} pulled the page back (${s.y} vs ${at})`);
      assert.equal(await station(), n, `station ${n} still owns the face`);
      const c = await copy(n);
      assert.ok(c.vis === 'visible' && c.op > 0.95, `the chapter stays (${c.op}/${c.vis})`);
      assert.ok((await scene(n)).running > 0, 'the scene keeps its clock');
    }
  });

  test('page: the ending is one panel and the page stops on it', async () => {
    /* The deck owns the scroll, so the ending is one frame like any other: a
       notch under half a panel returns. It is also the last frame, so the
       first reader face of the deck is its head — a trailing block would cut
       the headline, and a gesture past the middle has nowhere to go. */
    await evaluate(`document.querySelector('#tailor').scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await waitSettled();
    const at = (await state()).y;
    const pitch = await evaluate('innerHeight');
    for (let i = 0; i < 3; i++) {
      await wheel(120);
      await waitSettled();
    }
    const held = (await state()).y;
    assert.ok(Math.abs(held - at) <= 2, `three notches return to the panel top (${at} -> ${held})`);
    await wheel(Math.round(pitch * 0.6));
    await waitSettled();
    const after = await evaluate(`(() => {
      const box = document.querySelector('#tailor').getBoundingClientRect();
      return { y: Math.round(scrollY), head: Math.round(box.top), foot: Math.round(box.bottom), view: innerHeight };
    })()`);
    assert.ok(Math.abs(after.y - at) <= 2, `the page cannot scroll past the ending (${after.y})`);
    assert.ok(Math.abs(after.head) <= 2, `the ending head stays whole (${after.head})`);
    assert.ok(Math.abs(after.foot - after.view) <= 2, `the ending foot closes the frame (${after.foot} of ${after.view})`);
  });

  test('chapter: a rest between stations is impossible', async () => {
    /* The reported defect: the reader could park mid-chapter on a half-played
       seam. Mandatory snapping splits every gap at its midpoint, so a park on
       the near side returns and a park on the far side commits. */
    const at = await offset(1);
    const pitch = (await offset(2)) - at;
    await go(at + Math.round(pitch * 0.45));
    await waitSettled();
    const back = (await state()).y;
    assert.ok(Math.abs(back - at) <= 2, `a park before the midpoint returns (${at} -> ${back})`);
    assert.equal(await station(), 1, 'the chapter the reader left still owns the face');
    await go(at + Math.round(pitch * 0.55));
    await waitSettled();
    const forward = (await state()).y;
    assert.ok(Math.abs(forward - (at + pitch)) <= 3, `a park past the midpoint commits (${forward})`);
    assert.equal(await station(), 2, 'and the next chapter owns the face');
  });

  test('chapter: leaving a station hides its copy and resets its scene', async () => {
    await snapTo(1);
    await delay(350);
    assert.ok((await playhead(1)) > 0, 'the chat has run');
    await go(await offset(2));
    await waitSettled();
    await waitFor(async () => (await station()) === 2, 3000, 'station 2');
    const c1 = await copy(1);
    assert.equal(c1.vis, 'hidden', 'the old chapter is masked out');
    assert.ok(c1.op <= 0.05, `the old chapter finished its short exit fade (${c1.op})`);
    assert.ok(c1.boxTop < 90, `the old box has passed the station (${c1.boxTop})`);
    const c2 = await copy(2);
    assert.ok(c2.op > 0.95 && c2.vis === 'visible', `the new chapter arrived (${c2.op}/${c2.vis})`);
    assert.equal((await scene(1)).running, 0, 'the old scene stopped');
    assert.equal(await playhead(1), 0, 'the old scene returned to its first frame');
    assert.ok((await scene(2)).running > 0, 'the new scene plays');
  });

  test('copy: the incoming chapter never fades and rides into place', async () => {
    /* The reader asked for a slide, not a fade. The contract is visual: the
       incoming chapter keeps full opacity from its first frame, appears below
       the station and rides up. Only the outgoing chapter may fade, and it
       finishes before the station line. */
    await evaluate('window.__h.snap("none")');
    const at = await offset(2);
    const line = await evaluate('window.__h.line()');
    const samples = await evaluate(`(async () => {
      const frame = () => new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const out = [];
      for (let y = ${at - 150}; y <= ${at + 4}; y += 8) {
        window.__h.go(y);
        await frame();
        out.push({ y: Math.round(scrollY), a: window.__h.copy(1), b: window.__h.copy(2) });
      }
      return out;
    })()`);
    for (const s of samples) {
      assert.equal(s.b.op, 1, `chapter 2 box opacity at y=${s.y}`);
      assert.equal(s.b.trackOp, 1, `chapter 2 text opacity at y=${s.y}`);
    }
    assert.equal(samples[0].a.op, 1, 'the old chapter starts opaque');
    const shown = samples.filter((s) => s.b.vis === 'visible');
    assert.ok(shown.length > 0, 'the incoming chapter is visible on the approach');
    const tops = shown.map((s) => s.b.boxTop);
    assert.ok(Math.max(...tops) > line + 40, `the incoming chapter starts below the station (${Math.max(...tops)})`);
    assert.ok(Math.max(...tops) - Math.min(...tops) >= 60, 'the incoming block rides up');
    const last = samples[samples.length - 1];
    assert.ok(Math.abs(last.b.boxTop - line) <= 1.5, `the incoming chapter lands on the station (${last.b.boxTop})`);
    assert.ok(last.a.op <= 0.05, `the outgoing chapter is gone at the station (${last.a.op})`);
    await evaluate('window.__h.snap("")');
    await go(0);
    await waitSettled();
  });

  test('chapter: a backward arrival replays the scene from its first frame', async () => {
    await snapTo(2);
    await delay(500);
    assert.ok((await playhead(2)) > 200, 'the doc scene ran');
    await go(await offset(1));
    await waitSettled();
    await waitFor(async () => (await station()) === 1, 3000, 'station 1');
    const c1 = await copy(1);
    assert.ok(c1.op > 0.95 && c1.vis === 'visible', 'the chapter comes back');
    const fresh = await playhead(1);
    assert.ok(fresh >= 0 && fresh < 500, `the chat restarts (${fresh})`);
    await delay(300);
    assert.ok((await playhead(1)) > fresh, 'the chat plays from its first frame');
  });

  test('chapter: returning to the intro hides the chapter and resets the scene', async () => {
    await snapTo(1);
    await delay(400);
    await go(0);
    await waitSettled();
    await waitFor(async () => (await station()) === 0, 3000, 'intro');
    assert.ok((await intro()).vis === 'visible', 'the invitation returns');
    assert.ok((await copy(1)).vis === 'hidden', 'the chapter left');
    assert.equal((await scene(1)).running, 0, 'the scene stopped');
    assert.equal(await playhead(1), 0, 'the scene reset');
  });

  test('scene: only the station surface runs', async () => {
    for (const n of [1, 3, 5, 6]) {
      await snapTo(n);
      await delay(150);
      for (let m = 1; m <= 6; m++) {
        const s = await scene(m);
        if (m === n) assert.ok(s.running > 0, `station ${n} runs scene ${m}`);
        else assert.equal(s.running, 0, `station ${n} keeps scene ${m} still`);
      }
    }
  });

  test('geometry: the stage holds one centered line through the sequence', async () => {
    /* The stage used to start 72 px below its sticky line (the grid's 168 px
       flow inset vs the 96 px station), so the intro face sat lower than every
       chapter. One line now owns the flow inset, the pin and the station. */
    const read = () => evaluate(`(() => {
      const r = document.querySelector('[data-story-stage]').getBoundingClientRect();
      return {
        top: Number(r.top.toFixed(1)), bottom: Number(r.bottom.toFixed(1)), vh: innerHeight,
        line: parseFloat(getComputedStyle(document.querySelector('.story-copy')).top)
      };
    })()`);
    const holds = async (where) => {
      const g = await read();
      assert.ok(Math.abs(g.top - g.line) <= 1, `stage on the station line ${where} (${g.top} vs ${g.line})`);
      assert.ok(Math.abs(g.top - (g.vh - g.bottom)) <= 1, `stage centered ${where} (${g.top} / ${g.vh - g.bottom})`);
    };

    await go(0);
    await waitSettled();
    await holds('at the intro');
    for (const n of [1, 2, 3, 4, 5, 6]) {
      await snapTo(n);
      await holds(`at station ${n}`);
    }

    /* The floor of the line keeps the frame centered when the 64 % share no
       longer fits: the guard shrinks both gaps by the same amount. */
    await setViewport({ width: 1440, height: 520, mobile: false });
    await waitSettled();
    await holds('at the intro on a short window');
    await snapTo(1);
    await holds('at station 1 on a short window');
  });

  test('geometry: every chapter sits on the stage center line', async () => {
    /* The copy is the reader's half of the scene. Top aligned, a chapter rides
       the figure's edge and only looks balanced when its prose happens to be
       long; centering the track gives every station one optical line. */
    const align = (n) => evaluate(`(() => {
      const stage = document.querySelector('[data-story-stage]').getBoundingClientRect();
      const track = document.querySelector('[data-story-beat="${n}"] .story-copy-track').getBoundingClientRect();
      return {
        center: Number(((track.top + track.height / 2) - (stage.top + stage.height / 2)).toFixed(1)) || 0,
        top: Number((track.top - stage.top).toFixed(1)) || 0
      };
    })()`);
    const holds = async (n, strict) => {
      const a = await align(n);
      assert.ok(Math.abs(a.center) <= 1.5 || (!strict && Math.abs(a.top) <= 1.5),
        `chapter ${n} centers, or top aligns when taller than the stage (center=${a.center}, top=${a.top})`);
    };

    /* The previous geometry test leaves a short window; start from the default
       deck so the centering contract is read at its normal size. */
    await setViewport(VIEWPORTS[0]);
    await go(0);
    await waitSettled();

    /* The intro is a chapter for the eye: its content must share the same
       center line, even though its box fills the rest of the first page. */
    const intro = await evaluate(`(() => {
      const stage = document.querySelector('[data-story-stage]').getBoundingClientRect();
      const kids = [...document.querySelector('.story-intro-body').children]
        .map((el) => el.getBoundingClientRect());
      const top = Math.min(...kids.map((r) => r.top));
      const bottom = Math.max(...kids.map((r) => r.bottom));
      return Number(((top + bottom) / 2 - (stage.top + stage.height / 2)).toFixed(1)) || 0;
    })()`);
    assert.ok(Math.abs(intro) <= 1.5, `the intro centers on the stage (${intro})`);

    for (const n of [1, 2, 3, 4, 5, 6]) {
      await snapTo(n);
      await holds(n, true);
    }

    /* A short window shrinks the stage below the longest chapter. The copy
       must then hold its top edge instead of crossing the nav. */
    await setViewport({ width: 1440, height: 520, mobile: false });
    await waitSettled();
    for (const n of [1, 6]) {
      await snapTo(n);
      await holds(n, false);
    }

    /* Later tests inherit the viewport; leave the default deck in place. */
    await setViewport(VIEWPORTS[0]);
    await waitSettled();
    await go(0);
    await waitSettled();
  });

  test('geometry: the ending closes on the stage center line', async () => {
    /* The ending used to start on the page top, so the last panel left a void
       below its block while every chapter sat on the reader's center. The block
       is the eyebrow plus the grid: the wrap's only children, and the whole of
       what the composition centers. */
    const align = () => evaluate(`(() => {
      const panel = document.querySelector('#tailor');
      const kids = [...panel.querySelector('.wrap').children].map((el) => el.getBoundingClientRect());
      const top = Math.min(...kids.map((r) => r.top));
      const bottom = Math.max(...kids.map((r) => r.bottom));
      return {
        center: Number(((top + bottom) / 2 - innerHeight / 2).toFixed(1)) || 0,
        top: Number(top.toFixed(1)),
        nav: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')),
        overflow: panel.scrollHeight - panel.clientHeight
      };
    })()`);
    const holds = async (where) => {
      const a = await align();
      assert.ok(Math.abs(a.center) <= 1.5, `the ending centers on the stage ${where} (${a.center})`);
      assert.ok(a.top >= a.nav, `the ending clears the nav ${where} (${a.top} of ${a.nav})`);
      assert.equal(a.overflow, 0, `the ending fits its panel ${where}`);
    };
    const rest = async () => {
      await evaluate(`document.querySelector('#tailor').scrollIntoView({ behavior: 'instant', block: 'start' })`);
      await waitSettled();
    };

    await rest();
    await holds('at the default deck');

    /* The 64 % share and the short-window floor both keep the frame symmetric
       about the viewport, so the block follows either one. */
    for (const viewport of [{ width: 1920, height: 1080, mobile: false }, { width: 1440, height: 520, mobile: false }]) {
      await setViewport(viewport);
      await rest();
      await holds(`at ${viewport.width}x${viewport.height}`);
    }

    /* Later tests inherit the viewport; leave the default deck in place. */
    await setViewport(VIEWPORTS[0]);
    await rest();
    await go(0);
    await waitSettled();
  });

  test('geometry: the figure centers on the stage and its caption cannot move it', async () => {
    /* The caption used to be a flex sibling of a centred column, so its height
       sized the free space and lifted the perimeter by half the caption block
       (27 px at 1440, 41 px at 390). The caption is the mat's footer now: it
       shares the drawing's cell, so the drawing alone owns the center line and
       copy length is never geometry. */
    const read = () => evaluate(`(() => {
      const pane = document.querySelector('.story-pane[data-pane="6"]');
      const per = pane.querySelector('.base-perimeter');
      const cap = pane.querySelector('.topology-caption');
      const p = pane.getBoundingClientRect();
      const b = per.getBoundingClientRect();
      const c = cap.getBoundingClientRect();
      const r = (n) => Math.round(n * 10) / 10;
      const glyphs = document.createRange();
      glyphs.selectNodeContents(cap);
      const g = glyphs.getBoundingClientRect();
      return {
        center: r(((b.top + b.bottom) / 2) - ((p.top + p.bottom) / 2)) || 0,
        gap: r(c.top - b.bottom),
        clip: r(c.bottom - p.bottom),
        text: r(((g.left + g.right) / 2) - ((b.left + b.right) / 2)),
        box: [b.left, b.top, b.width, b.height].map(r)
      };
    })()`);
    const drift = (a, b) => Math.max(...a.box.map((n, i) => Math.abs(n - b.box[i])));
    const holds = async (where) => {
      const g = await read();
      assert.ok(Math.abs(g.center) <= 1.5, `the figure centers on the stage ${where} (${g.center})`);
      assert.ok(g.gap >= 6 && g.gap <= 16, `the caption hugs the figure ${where} (${g.gap})`);
      /* The caption may spend its own half-leading, never a glyph. */
      assert.ok(g.clip <= 1, `the caption stays inside the mat ${where} (${g.clip})`);
      /* The caption is the mat's footer, so its glyphs centre under the figure. */
      assert.ok(Math.abs(g.text) <= 1.5, `the caption centers under the figure ${where} (${g.text})`);
      return g;
    };

    /* The narrow, short window is the tightest deck: the stage holds its phone
       floor while the caption wraps to four lines. */
    const decks = [...VIEWPORTS, { width: 1440, height: 520, mobile: false }, { width: 359, height: 420, mobile: true }];
    for (const vp of decks) {
      await setViewport(vp);
      await waitSettled();
      await snapTo(6);
      const still = await holds(`at ${vp.width}x${vp.height}`);

      /* The contract: the caption's words are copy, not geometry. Copy that
         grows and copy that shrinks must both leave the drawing on the same
         four edges -- a shorter caption is the case an auto track failed. */
      for (const [variant, next] of [
        ['doubled', 'cap.textContent + " " + cap.textContent'],
        ['short', '"Short."']
      ]) {
        await evaluate(`(() => {
          const cap = document.querySelector('.story-pane[data-pane="6"] .topology-caption');
          cap.textContent = ${next};
        })()`);
        const moved = drift(await read(), still);
        assert.ok(moved <= 0.5, `${variant} copy leaves the figure in place at ${vp.width}x${vp.height} (moved ${moved})`);
      }
      await reload();
    }

    await setViewport(VIEWPORTS[0]);
    await waitSettled();
    await go(0);
    await waitSettled();
  });

  test('geometry: every figure box stays inside its frame at each rung', async () => {
    /* The band and the rail are derived from their contents, so a rung can
       shrink the ingredients without letting a container row, the peer, or the
       mode cross its frame. Measure boxes, never source strings: the same
       contract must survive a rewrite. */
    const decks = [
      ...VIEWPORTS,
      { width: 720, height: 900, mobile: true },
      { width: 359, height: 420, mobile: true }
    ];
    const read = () => evaluate(`(() => {
      const stage = document.querySelector('[data-story-stage]');
      const q = (s) => stage.querySelector(s);
      const box = (el) => { const r = el.getBoundingClientRect(); return [r.top, r.bottom]; };
      const pane = q('.story-pane[data-pane="6"]').getBoundingClientRect();
      const cap = q('.topology-caption').getBoundingClientRect();
      const r = (n) => Math.round(n * 10) / 10;
      return {
        band: box(q('.base-backend')).map(r),
        peer: box(q('.base-peer')).map(r),
        badge: box(q('.base-head > .canvas-label')).map(r),
        mode: box(q('.base-mode')).map(r),
        clients: box(q('.base-clients')).map(r),
        chip: box(q('.base-part[data-service="auth"]')).map(r),
        bus: r(q('.base-link--bus').getBoundingClientRect().top),
        clip: r(cap.bottom - pane.bottom)
      };
    })()`);
    const pose = async (value) => {
      await evaluate(`(() => {
        const per = document.querySelector('[data-story-stage] .base-perimeter');
        per.style.setProperty('--pose', '${value}', 'important');
      })()`);
      await delay(60);
    };
    for (const vp of decks) {
      await setViewport(vp);
      await waitSettled();
      await snapTo(6);
      const where = `at ${vp.width}x${vp.height}`;
      await pose(0);
      const cloud = await read();
      assert.ok(cloud.chip[1] <= cloud.band[1] + 0.5,
        `the second container row stays in the band ${where} (${cloud.chip[1]} of ${cloud.band[1]})`);
      assert.ok(cloud.chip[1] <= cloud.clients[0] + 0.5,
        `the second container row clears the clients ${where} (${cloud.chip[1]} of ${cloud.clients[0]})`);
      assert.ok(cloud.mode[1] <= cloud.band[0] + 0.5,
        `the mode clears the band ${where} (${cloud.mode[1]} of ${cloud.band[0]})`);
      await pose(1);
      const local = await read();
      assert.ok(local.peer[0] >= local.band[0] - 0.5 && local.peer[1] <= local.band[1] + 0.5,
        `the peer stays in the band ${where} (${local.peer.join('..')} of ${local.band.join('..')})`);
      assert.ok(local.badge[1] <= local.peer[0] + 0.5,
        `the badge clears the peer ${where} (${local.badge[1]} of ${local.peer[0]})`);
      assert.ok(local.bus >= local.peer[1] - 0.5,
        `the bus clears the peer ${where} (${local.bus} of ${local.peer[1]})`);
      assert.ok(local.mode[1] <= local.band[0] + 0.5,
        `the mode clears the band ${where} (${local.mode[1]} of ${local.band[0]})`);
      assert.ok(local.clip <= 1, `the caption stays inside the mat ${where} (${local.clip})`);
      await evaluate(`document.querySelector('[data-story-stage] .base-perimeter').style.removeProperty('--pose')`);
      await reload();
    }
    await setViewport(VIEWPORTS[0]);
    await waitSettled();
    await go(0);
    await waitSettled();
  });

  test('geometry: every beat is one page and the pitch never drifts', async () => {
    const geo = await evaluate(`(() => {
      const hero = document.querySelector('.hero');
      const beats = [...document.querySelectorAll('[data-story-beat]')];
      const tops = beats.map((b) => Math.round(b.getBoundingClientRect().top + scrollY));
      return {
        panel: innerHeight,
        faces: beats.map((b) => Math.round(b.getBoundingClientRect().height)),
        pitch: tops.slice(1).map((t, i) => t - tops[i]),
        heroH: Math.round(hero.getBoundingClientRect().height),
        nextTop: Math.round(document.querySelector('#tailor').getBoundingClientRect().top + scrollY),
        storyEnd: Math.round(hero.getBoundingClientRect().bottom + scrollY)
      };
    })()`);
    for (const [i, h] of geo.faces.entries()) {
      assert.ok(Math.abs(h - geo.panel) <= 1, `beat ${i + 1} is one page (${h} vs ${geo.panel})`);
    }
    for (const [i, d] of geo.pitch.entries()) {
      assert.ok(Math.abs(d - geo.panel) <= 1, `chapter pitch ${i + 2} is one page (${d})`);
    }
    assert.ok(geo.heroH >= 7 * geo.panel - 1, `the hero is at least seven pages (${geo.heroH})`);
    assert.ok(Math.abs(geo.nextTop - geo.storyEnd) <= 1, 'the first section follows the story');
  });

  test('snap: a reversed gesture returns to the previous station', async () => {
    await snapTo(3);
    await wheel(-900);
    await waitSettled();
    assert.equal(await station(), 2, 'the reader goes back one station');
  });

  test('page: the story exits into the sections on a whole panel', async () => {
    await snapTo(6);
    await wheel(Math.round((await evaluate('innerHeight')) * 0.75));
    await waitSettled();
    /* The first section is the next panel: the exit commits to its top edge
       whole, so a section arrives as a frame, never half-scrolled. */
    const nextTop = await evaluate(`Math.round(document.querySelector('#tailor').getBoundingClientRect().top + scrollY)`);
    const y = (await state()).y;
    assert.ok(Math.abs(y - nextTop) <= 3, `the exit lands on the section top (${y} vs ${nextTop})`);
    /* The trap this suite used to miss: the deck took focus on the first key
       and then could not move, so the page below it was unreachable. A key
       must leave the last station exactly like a wheel does. (Headless Chrome
       does not scroll on Space, so the probe uses the two keys it honours.) */
    for (const [key, code, vk] of [['PageDown', 'PageDown', 34], ['End', 'End', 35]]) {
      await snapTo(6);
      const before = (await state()).y;
      await pressKey(key, code, vk);
      await waitSettled();
      assert.ok((await state()).y > before, `${key} leaves the last station`);
    }
    /* The page has no scroll padding: a section's own panel padding is what
       clears the nav, so an anchor lands on the section's top edge. */
    for (const id of ['#tailor']) {
      await evaluate(`document.querySelector('${id}').scrollIntoView({ behavior: 'instant', block: 'start' })`);
      await waitSettled();
      const top = await evaluate(`Math.round(document.querySelector('${id}').getBoundingClientRect().top)`);
      assert.ok(Math.abs(top) <= 2, `${id} lands on its own top edge (top=${top})`);
    }
    await evaluate('window.scrollTo({ top: 1e6, behavior: "instant" })');
    await waitSettled();
    const end = await evaluate(`(() => {
      const max = Math.round(document.documentElement.scrollHeight - innerHeight);
      const box = document.querySelector('#tailor').getBoundingClientRect();
      return {
        y: Math.round(scrollY), max, view: innerHeight,
        head: Math.round(box.top), foot: Math.round(box.bottom)
      };
    })()`);
    assert.ok(Math.abs(end.y - end.max) <= 2, `the page end is a rest (${end.y} of ${end.max})`);
    /* No footer below the deck: its last rest is the ending panel itself, so
       the head of the panel is never cut by a trailing block. */
    assert.ok(Math.abs(end.head) <= 2, `the ending owns the last frame (${end.head})`);
    assert.ok(Math.abs(end.foot - end.view) <= 2, `the ending closes the page (${end.foot} of ${end.view})`);
    await evaluate('window.scrollTo({ top: 0, behavior: "instant" })');
    await waitSettled();
  });

  test('page: the story never writes the scroll position', async () => {
    await snapTo(1);
    const before = (await state()).y;
    await evaluate(`window.__calls = 0;
      window.__scrollTo = window.scrollTo; window.__scrollBy = window.scrollBy;
      window.scrollTo = function () { window.__calls += 1; };
      window.scrollBy = function () { window.__calls += 1; };`);
    await wheel(300);
    await waitSettled();
    await wheel(900);
    await waitSettled();
    const calls = await evaluate('window.__calls');
    const after = (await state()).y;
    await evaluate('window.scrollTo = window.__scrollTo; window.scrollBy = window.__scrollBy;');
    assert.equal(calls, 0, 'no script call moves the scroll');
    assert.ok(after !== before, `the browser moved it (${before} -> ${after})`);
  });

  test('morph: every tile leaves the board and lands on its own entry', async () => {
    const boardStart = await offset(3);
    const boardSpan = await travel(3);
    const start = boardStart;
    const span = boardSpan;
    /* This probe reads the scroll-driven frame, so it turns the snap off: the
       snap itself is covered by the snap tests above. */
    await evaluate(`window.__h.snap('none')`);
    await delay(50);

    /* A proxy leaves from the worked board, not from where the drag happened to
       be: let the scene reach its still frame, then read the tiles it carries.
       The seam window is chapter 3's own exit, so the worked pose is sampled
       at the chapter's head and the flight over its tail. */
    await go(boardStart + boardSpan * 0.02);
    await waitSettled();
    await waitFor(async () => (await evaluate(`window.__h.scene(3).settled`)), 12000, 'the board scene reaches its still frame');
    const rest = await seam(3);
    assert.equal(rest.carriers.length, 3, 'the canvas seam carries one proxy per tile');
    assert.equal(rest.sources.length, 3, 'the board offers three tiles');
    assert.equal(rest.arrivals.length, 3, 'the week offers three entries');
    for (const [i, carrier] of rest.carriers.entries()) {
      assert.equal(carrier.opacity, 0, 'no proxy is drawn before its seam');
      for (const key of ['left', 'top', 'width', 'height']) {
        assert.ok(Math.abs(carrier.box[key] - rest.sources[i].box[key]) <= 2,
          `tile ${i} waits on its own sheet (${key} ${carrier.box[key]} vs ${rest.sources[i].box[key]})`);
      }
    }

    await go(start + span * 0.45);
    await waitSettled();
    const mid = await seam(3);
    for (const [i, flight] of mid.carriers.entries()) {
      assert.ok(flight.opacity > 0.9, `tile ${i} is in the air (${flight.opacity})`);
      assert.ok(gap(flight.box, mid.arrivals[i].box) > 2, `tile ${i} has not landed yet`);
    }
    /* The proxy is the only copy of a tile while it flies: the board cuts the
       sheet it carried, and no cell shows an entry before its tile arrives. */
    for (const source of mid.sources) {
      assert.equal(source.visibility, 'hidden', 'the board stopped drawing a tile it gave away');
    }
    for (const arrival of mid.arrivals) {
      assert.equal(arrival.visibility, 'hidden', 'no entry appears before its tile lands');
    }

    await go(start + span * 0.62);
    await waitSettled();
    const later = await seam(3);
    for (const [i, flight] of later.carriers.entries()) {
      assert.ok(gap(flight.box, later.arrivals[i].box) < gap(mid.carriers[i].box, mid.arrivals[i].box),
        `tile ${i} is closing on its entry`);
    }

    await go(start + span * 0.45);
    await waitSettled();
    const back = await seam(3);
    for (const [i, flight] of back.carriers.entries()) {
      for (const key of ['left', 'top', 'width', 'height']) {
        assert.ok(Math.abs(flight.box[key] - mid.carriers[i].box[key]) <= 2, `tile ${i} ${key} is the same frame on the way back`);
      }
    }
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  test('calendar: each tile becomes the entry it landed on', async () => {
    const start = await offset(3);
    const span = await travel(3);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    await go(start + span * 0.99);
    await waitSettled();
    const landed = await seam(3);
    assert.ok(landed.paneIn > 0.95, `the week has arrived (${landed.paneIn})`);
    for (const [i, flight] of landed.carriers.entries()) {
      for (const key of ['left', 'top', 'width', 'height']) {
        assert.ok(Math.abs(flight.box[key] - landed.arrivals[i].box[key]) <= 1,
          `tile ${i} landed on its entry (${key} ${flight.box[key]} vs ${landed.arrivals[i].box[key]})`);
      }
      assert.equal(landed.arrivals[i].visibility, 'visible', 'the entry is drawn once the tile lands');
    }
    const labels = await evaluate(`({
      tiles: [...document.querySelectorAll('.story-pane[data-pane="3"] .collab-note-label')].map((el) => el.textContent),
      entries: [...document.querySelectorAll('.entry .collab-note-label')].map((el) => el.textContent)
    })`);
    assert.deepEqual(labels.entries, labels.tiles, 'an entry repeats the tile it came from');
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  /* A tile must land on a week the reader can already see: the slot it fills is
     the thing it is being placed in, so it cannot arrive before the slot does.
     The three landings are the ones the seam's own table declares. */
  test('calendar: the week is whole before the first tile lands', async () => {
    const start = await offset(3);
    const span = await travel(3);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    for (const at of [0.72, 0.78, 0.84]) {
      await go(start + span * at);
      await waitSettled();
      const frame = await seam(3);
      assert.ok(frame.paneIn >= 0.99, `the week is drawn when a tile lands (${at}: ${frame.paneIn})`);
      assert.ok(frame.paneOut <= 0.01, `the canvas is gone when a tile lands (${at}: ${frame.paneOut})`);
    }
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  /* One paper in three places: the flight may not change the plate. Radius and
     edge are static on all three, so any difference is a drift, not motion. The
     tile's depth is excluded because its own scene animates it (the lift). */
  test('seam 3: the proxy wears the same paper as its tile and its entry', async () => {
    const start = await offset(3);
    const span = await travel(3);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    await go(start + span * 0.6);
    await waitSettled();
    const plate = await evaluate(`(() => {
      const s = document.querySelector('[data-story-stage]');
      const look = (el) => {
        const c = getComputedStyle(el);
        return { radius: c.borderTopLeftRadius, edge: c.borderTopColor, depth: c.boxShadow };
      };
      const pick = (sel) => [...s.querySelectorAll(sel)].map(look);
      return {
        tiles: pick('[data-anchor="3"]'),
        proxies: pick('.story-carrier[data-seam="3"]'),
        entries: pick('[data-arrive="3"]')
      };
    })()`);
    assert.equal(plate.proxies.length, 3, 'one proxy per tile');
    for (let i = 0; i !== plate.proxies.length; i++) {
      assert.equal(plate.proxies[i].radius, plate.tiles[i].radius, `proxy ${i} keeps the tile's radius`);
      assert.equal(plate.proxies[i].edge, plate.tiles[i].edge, `proxy ${i} keeps the tile's edge`);
      assert.deepEqual(plate.proxies[i], plate.entries[i], `proxy ${i} is the entry's paper`);
    }
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  /* The board's three tiles are a plan for the whole week: one lands at its
     start, one in its middle, one at its end. Each note names its day by the
     header above it, so the contract holds if the week is rebuilt. */
  test('calendar: the week spreads its three entries across its days', async () => {
    const start = await offset(3);
    const span = await travel(3);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    await go(start + span * 0.99);
    await waitSettled();
    const week = await evaluate(`(() => {
      const pane = document.querySelector('.story-pane[data-pane="4"]');
      const rect = (el) => el.getBoundingClientRect();
      const mid = (r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
      return {
        days: [...pane.querySelectorAll('.rota-day')].map((el) => ({ label: el.textContent.trim(), ...mid(rect(el)) })),
        entries: [...pane.querySelectorAll('.entry')].map((el) => ({
          label: el.querySelector('.collab-note-label').textContent, ...mid(rect(el))
        })),
        people: [...pane.querySelectorAll('.rota-who')].map((el) => ({ name: el.textContent.trim(), ...mid(rect(el)) }))
      };
    })()`);
    assert.equal(week.entries.length, 3, 'the week holds the board\'s three notes');
    const picked = week.entries.map((entry) => {
      const near = week.days.reduce((best, day) => (
        Math.abs(day.x - entry.x) < Math.abs(best.x - entry.x) ? day : best
      ));
      return week.days.indexOf(near);
    });
    assert.deepEqual(picked.map((i) => week.days[i].label), ['Mon', 'Wed', 'Fri'],
      'one note at the start, one in the middle, one at the end (got ' + picked.join(',') + ')');
    for (let i = 1; i !== picked.length; i++) {
      assert.ok(picked[i] - picked[i - 1] >= 2, `note ${i} keeps a whole day between it and the one before`);
    }
    const priya = week.people.find((person) => person.name.includes('Priya'));
    for (const entry of week.entries) {
      assert.ok(Math.abs(entry.y - priya.y) <= 1, `the note on ${entry.label} is Priya's, not another row's`);
    }

    /* The three carry one speed and one destination each: a spread must not put
       one tile through another tile's flight. */
    await go(start + span * 0.45);
    await waitSettled();
    const air = (await seam(3)).carriers.map((carrier) => carrier.box);
    for (let i = 0; i !== air.length; i++) {
      for (let j = i + 1; j !== air.length; j++) {
        const apart = air[j].left >= air[i].left + air[i].width || air[i].left >= air[j].left + air[j].width ||
          air[j].top >= air[i].top + air[i].height || air[i].top >= air[j].top + air[j].height;
        assert.ok(apart, `tile ${i} and tile ${j} fly through separate air`);
      }
    }
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  /* The week now records one collaboration: Maya's Friday gap is closed by
     Jonas after Merlin reads the rules, proposes cover and waits for her
     approval. The gap keeps its dashed edge as the record of the open cell;
     the assignment lands on Jonas with the hand that found it. */
  test('calendar: the week records the approved cover and its provenance', async () => {
    const at = await offset(4);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    await go(at);
    await waitFor(async () => (await frame(4)).record > 0.99, 8000, 'the rota record settles');
    const week = await evaluate(`(() => {
      const pane = document.querySelector('.story-pane[data-pane="4"]');
      const gap = pane.querySelector('[data-anchor="4"]');
      const landed = pane.querySelector('.rota-landed');
      const done = pane.querySelector('.rota-status--done');
      const word = (name) => {
        const el = gap.querySelector(name);
        return { text: el.textContent.trim(), opacity: Number(getComputedStyle(el).opacity) };
      };
      return {
        open: word('.rota-gap-word--open'),
        off: word('.rota-gap-word--off'),
        gapEdge: getComputedStyle(gap).borderTopStyle,
        landed: {
          text: landed.textContent.replace(/\s+/g, ' ').trim(),
          opacity: Number(getComputedStyle(landed).opacity)
        },
        status: done.textContent.replace(/\s+/g, ' ').trim(),
        who: pane.querySelector('.rota-status-who').textContent.trim(),
        audit: pane.querySelector('.rota-audit').textContent.trim(),
      };
    })()`);
    assert.equal(week.open.text, 'open', 'the gap still names the shift it held');
    assert.ok(week.open.opacity <= 0.05, 'the open state retires from the worked frame');
    assert.equal(week.off.text, 'off', 'the gap closes in the worked frame');
    assert.ok(week.off.opacity > 0.95, 'the closed state holds');
    assert.equal(week.gapEdge, 'dashed', 'the gap keeps its dashed edge as the record');
    assert.ok(/08–16/.test(week.landed.text) && /via Merlin/.test(week.landed.text),
      `the assignment names its shift and its hand (${week.landed.text})`);
    assert.ok(week.landed.opacity > 0.95, 'the assignment has landed on Jonas');
    assert.equal(week.who, 'Jonas', 'the record names the assignee, not the agent');
    assert.ok(/Maya approved/.test(week.audit), `the record carries the consent (${week.audit})`);
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  /* A spent surface must stop painting. The stage clears a pane with
     `visibility`, which a descendant can re-enable by saying `visible`, so any
     state dial inside a pane speaks through opacity (see the rota record). The
     substrate panes are transparent, so a leftover line shows through the
     chapter that replaced it. */
  test('stage: a cleared surface paints nothing', async () => {
    const leaks = () => evaluate(`(() => {
      const op = (el) => Number(getComputedStyle(el).opacity);
      const paint = (el) => {
        let seen = 1;
        for (let node = el; node; node = node.parentElement) seen *= op(node);
        return seen;
      };
      return [...document.querySelectorAll('.story-pane')].flatMap((pane) => {
        const cs = getComputedStyle(pane);
        if (cs.visibility !== 'hidden' && op(pane) > 0) return [];
        return [...pane.querySelectorAll('*')]
          .filter((el) => getComputedStyle(el).visibility === 'visible' && paint(el) > 0)
          .map((el) => pane.dataset.pane + ':' + el.className);
      });
    })()`);

    for (const n of [5, 6]) {
      await evaluate(`window.__h.snap('none')`);
      await delay(50);
      await go(await offset(n));
      await waitSettled();
      assert.deepEqual(await leaks(), [], `station ${n}: a spent pane still paints`);
      await evaluate(`window.__h.snap('')`);
      await go(0);
      await waitSettled();
    }
  });

  /* The plan is the rota's record one step later, so it opens with the Access
     bar ending Thursday. One commit moves the bar onto the cover day, lands the
     brief inside it and closes the scope item that the move unblocks. The date
     and the scope agree on one frame. */
  test('plan: the bar ends on the cover day and the scope follows it', async () => {
    const at = await offset(5);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    await go(at);
    const read = () => evaluate(`(() => {
      const pane = document.querySelector('.story-pane[data-pane="5"]');
      const track = pane.querySelector('.plan-track').getBoundingClientRect();
      const bar = pane.querySelector('.plan-bar--grow').getBoundingClientRect();
      const brief = pane.querySelector('.plan-brief').getBoundingClientRect();
      /* Track lines are 1-based: line 1 is Monday 00:00, line 11 is the end. */
      const line = (i) => track.left + track.width * (i - 1) / 10;
      const shown = (el) => getComputedStyle(el).visibility === 'visible' &&
        Number(getComputedStyle(el).opacity) > 0.95;
      const text = (selector) => {
        const el = pane.querySelector(selector);
        return shown(el) ? el.textContent : '';
      };
      return {
        /* A day is two track columns, so every edge is a tenth of the track. */
        start: Math.round(bar.left - line(3)),
        end: Math.round(line(11) - bar.right),
        /* Days are the viewport-independent unit: the gap to Friday is one day
           at the first frame and none at the worked frame. */
        endDays: (line(11) - bar.right) / (track.width / 5),
        briefStart: Math.round(brief.left - line(9)),
        tick: Number(getComputedStyle(pane.querySelector('.plan-tick')).opacity),
        strike: getComputedStyle(pane.querySelector('.plan-strike')).transform,
        done: shown(pane.querySelector('.plan-status--done')),
        audit: shown(pane.querySelector('.plan-audit')),
        ghost: Number(getComputedStyle(pane.querySelector('.plan-ghost')).opacity),
        edge: Number(getComputedStyle(pane.querySelector('.plan-edge')).opacity),
        chip: text('.plan-ends'),
        pending: text('.plan-tag--pending'),
        approved: text('.plan-tag--approved')
      };
    })()`);
    const start = await read();
    assert.ok(start.endDays > 0.8, `the scene opens with the bar ending Thursday (${start.endDays})`);
    assert.ok(start.tick <= 0.5, 'the brief is open on the first frame');
    assert.equal(start.chip, '', 'no date is being changed on the first frame');
    /* The readout is derived from the bar's own span, so it can only name the
       day the end lands on and the duration that day produces. */
    await waitFor(async () => (await playhead(5)) >= 1150, 8000, 'the drag is under way');
    const drag = await read();
    assert.ok(/Fri/.test(drag.chip), `the drag names the day it will land on (${drag.chip})`);
    assert.ok(/4d/.test(drag.chip), `the drag reports the duration the date derives (${drag.chip})`);
    await waitFor(async () => (await playhead(5)) >= 2550, 8000, 'the proposal is on the table');
    const held = await read();
    assert.ok(/proposed/.test(held.pending), `the proposal names its state (${held.pending})`);
    await waitFor(async () => (await playhead(5)) >= 3350, 8000, 'the proposal is approved');
    const consented = await read();
    assert.ok(/approved/.test(consented.approved), `consent is read on the label (${consented.approved})`);
    await waitFor(async () => (await playhead(5)) >= 5900, 12000, 'the plan settles');
    const plan = await read();
    assert.ok(Math.abs(plan.start) <= 1, `the bar still starts on Tuesday (${plan.start})`);
    assert.ok(Math.abs(plan.end) <= 1, `the bar ends on Friday (${plan.end})`);
    assert.ok(Math.abs(plan.briefStart) <= 1, `the brief sits on the cover day (${plan.briefStart})`);
    assert.ok(plan.tick > 0.95, 'the scope item closes with the date');
    assert.notEqual(plan.strike, 'none', 'the closed item is struck through');
    assert.ok(plan.done && plan.audit, 'the record shows its result and its consent');
    for (const [name, value] of [['ghost', plan.ghost], ['edge', plan.edge]]) {
      assert.ok(value <= 0.05, `the ${name} was only a gesture (${value})`);
    }
    assert.equal(plan.chip, '', 'the readout retires with the gesture');
    assert.equal(plan.pending, '', 'the proposal retires with the state it reported');
    assert.equal(plan.approved, '', 'the consent tag retires with the bar');
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  /* The rota hands the plan four items: the week's three notes and the open
     slot that becomes the bar the next scene drags. Each one lands on the bar
     that carries its name, and no bar is drawn before its own note arrives. */
  test('rota: every item lands on the bar that carries its name', async () => {
    const start = await offset(4);
    const span = await travel(4);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    const at = async (fraction) => {
      await go(start + Math.round(span * fraction));
      await waitSettled();
      return seam(4);
    };
    const lit = (f) => f.arrivals.filter((a) => a.visibility === 'visible').map((a) => a.item).sort();

    const early = await at(0.1);
    assert.deepEqual(early.sources.map((s) => s.visibility), ['visible', 'visible', 'visible', 'visible'],
      'the week keeps every item until its own turn');
    assert.deepEqual(lit(early), [], 'no bar precedes its own note');

    /* Cutover lands at 50 % of the beat and Rollback at 58 %, so the plan is
       whole while the dry run and the gap are still in the air. */
    const mid = await at(0.6);
    assert.ok(mid.paneIn >= 0.99, `the plan is drawn before its first bar arrives (${mid.paneIn})`);
    assert.deepEqual(lit(mid), ['cutover', 'rollback'], 'only the bars whose notes have landed are drawn');

    const landed = await at(0.95);
    assert.equal(landed.carriers.length, 4, 'one proxy per item the week hands over');
    for (const arrival of landed.arrivals) {
      const flight = landed.carriers.find((carrier) => carrier.item === arrival.item);
      assert.ok(flight, `${arrival.item} is carried`);
      for (const key of ['left', 'top', 'width', 'height']) {
        assert.ok(Math.abs(flight.box[key] - arrival.box[key]) <= 1,
          `${arrival.item} landed on its bar (${key} ${flight.box[key]} vs ${arrival.box[key]})`);
      }
      assert.equal(arrival.visibility, 'visible', `${arrival.item}'s bar is drawn once it lands`);
      const source = landed.sources.find((item) => item.item === arrival.item);
      assert.equal(source.visibility, 'hidden', `${arrival.item} left the week`);
    }
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  /* A seam is a set of named items: wherever a surface names what leaves it,
     the surface it lands on must name the same item once. This is the guard
     that keeps one vocabulary across the board, the week and the plan. */
  test('seams: every named item has one source and one destination', async () => {
    for (const n of [1, 2, 3, 4]) {
      const f = await seam(n);
      const named = (items) => items.map((item) => item.item).filter(Boolean);
      const sources = named(f.sources), arrivals = named(f.arrivals);
      if (sources.length === 0) {
        assert.equal(f.arrivals.length, f.sources.length, `seam ${n} pairs its items by position`);
        continue;
      }
      assert.equal(sources.length, f.sources.length, `seam ${n} names every source`);
      assert.equal(arrivals.length, f.arrivals.length, `seam ${n} names every destination`);
      assert.deepEqual([...sources].sort(), [...arrivals].sort(),
        `seam ${n} names the same items on both sides`);
      assert.deepEqual(named(f.carriers).sort(), [...sources].sort(),
        `seam ${n} carries every item it lists`);
    }
  });

  test('board marks: the links leave with the paper they join', async () => {
    const start = await offset(3);
    const span = await travel(3);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    await go(start + span * 0.45);
    await waitSettled();
    assert.ok((await evaluate('Number(getComputedStyle(document.querySelector(".collab-wires")).opacity)')) <= 0.05,
      'no link is left hanging on an empty board');
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  test('seam: the destination surface arrives and the source leaves', async () => {
    const start = await offset(2);
    const span = await travel(2);
    await evaluate(`window.__h.snap('none')`);
    await delay(50);
    await go(start + span * 0.82);
    await waitSettled();
    const f = await seam(2);
    assert.ok(f.paneIn > 0.95, `canvas has arrived (${f.paneIn})`);
    assert.ok(f.carriers[0].opacity <= 0.05, `proxy has landed (${f.carriers[0].opacity})`);
    assert.equal(f.sources[0].visibility, 'hidden', 'the page stopped drawing what the proxy carries');
    assert.equal(f.arrivals[0].visibility, 'visible', 'the note the page became is drawn');
    await evaluate(`window.__h.snap('')`);
    await go(0);
    await waitSettled();
  });

  test('reduced motion: still worked frames, no autoplay, no snap, no carrier', async () => {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await reload();
    assert.equal(await evaluate('getComputedStyle(document.documentElement).scrollSnapType'), 'none', 'the page does not jump');
    await go(await offset(4));
    await delay(150);
    const f = await frame(4);
    assert.ok(f.arrive > 0.95 && f.fill > 0.95, `the worked frame is shown (${f.arrive}/${f.fill})`);
    assert.equal((await scene(4)).running, 0, 'the scene does not autoplay');
    assert.ok((await evaluate('Number(getComputedStyle(document.querySelector(".story-carrier")).opacity)')) <= 0.05,
      'the morph is off');
    const rmCopy = await evaluate(`(() => {
      const el = document.querySelector('[data-story-beat="4"] .story-copy-track');
      const cs = getComputedStyle(el);
      return { anim: cs.animationName, translate: cs.translate };
    })()`);
    assert.equal(rmCopy.anim, 'none', 'the copy has no motion');
    assert.equal(rmCopy.translate, 'none', 'the copy is not shifted off the line');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".chat-caret")).animationName'),
      'none', 'the caret holds still');
    const y = (await state()).y;
    await delay(600);
    assert.equal((await state()).y, y, 'reduced motion does not move the page');

    await go(await offset(6));
    await delay(150);
    const rmBase = await evaluate(`(() => {
      const p5 = document.querySelector('.story-pane[data-pane="5"]');
      const p6 = document.querySelector('.story-pane[data-pane="6"]');
      const q = (s) => p6.querySelector(s);
      const op = (s) => Number(getComputedStyle(q(s)).opacity);
      const box = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 10) / 10); };
      const inside = (a, b) => a[0] >= b[0] - 1 && a[1] >= b[1] - 1 &&
        a[0] + a[2] <= b[0] + b[2] + 1 && a[1] + a[3] <= b[1] + b[3] + 1;
      const well = box(q('.base-replica'));
      return {
        plan: Number(getComputedStyle(p5).opacity),
        translate: getComputedStyle(p5).translate,
        base: Number(getComputedStyle(p6).opacity),
        /* The still frame is the conclusion: the five blocks are in the peer's
           replica, the ops container is its role line, the bus and the mesh are
           drawn, and the request tips are retracted. */
        blocks: [...p6.querySelectorAll('.base-part:not([data-service="ops"])')]
          .map((el) => inside(box(el), well)),
        role: op('.base-part[data-service="ops"]'),
        bus: box(q('.base-link--bus'))[2],
        mesh: box(q('.base-link--pair-a'))[2],
        tip: getComputedStyle(q('.base-link-tip')).translate,
        modeLocal: op('.base-mode--local'),
        modeCloud: op('.base-mode--cloud'),
        footerLocal: op('.base-footer--local'),
        footerCloud: op('.base-footer--cloud')
      };
    })()`);
    assert.ok(rmBase.plan <= 0.05, `the plan cover is gone (${rmBase.plan})`);
    assert.equal(rmBase.translate, 'none', 'reduced motion does not lift the cover');
    assert.ok(rmBase.base > 0.95, 'the base is exposed');
    /* Without the scene the base styles are the conclusion: the local-first
       pose with the server peer, its five blocks and the two networks, not a
       deployment frozen mid-fold. The copy carries the contrast. */
    assert.deepEqual(rmBase.blocks, [true, true, true, true, true],
      'the still frame keeps the five blocks in the peer');
    assert.equal(rmBase.role, 1, 'the still frame keeps the peer role line');
    assert.ok(rmBase.bus > 100 && rmBase.mesh > 100, 'the still frame keeps both networks');
    assert.ok(rmBase.tip.includes('-'), 'the still frame has no request arrow');
    assert.ok(rmBase.modeLocal > 0.95 && rmBase.modeCloud <= 0.05, 'the still frame is local-first');
    assert.ok(rmBase.footerLocal > 0.95 && rmBase.footerCloud <= 0.05,
      'the still frame names the four equals');
  });

  test('keyboard: PageDown advances the story', async () => {
    await snapTo(2);
    const before = (await state()).y;
    await pressKey('PageDown', 'PageDown', 34);
    /* A key starts the same smooth scroll a wheel does, so read the rest
       position, not the frame the first delta lands on. */
    await waitSettled();
    assert.ok((await state()).y >= before + 300, 'the key advanced the story');
  });

  test('canvas: a card carries its knobs only while a hand holds it', async () => {
    await snapTo(3);
    /* The two hands take turns, and one card is held by one hand: the knobs and
       the hand are children of one hold, so they share one fade. Sample inside
       Merlin's hold on the dry run (3.25–4.64 s of the 5.8 s clock). */
    await waitFor(async () => (await playhead(3)) >= 3350, 12000, 'the hold begins');
    const holds = await evaluate(`(() => {
      const p = document.querySelector('.story-pane[data-pane="3"]');
      const read = (h) => {
        const select = h.querySelector('.collab-select');
        const knob = h.querySelector('.collab-knob');
        const cs = getComputedStyle(knob);
        return [
          h.dataset.hand,
          Number(getComputedStyle(select).opacity),
          Number(getComputedStyle(h.querySelector('.collab-pointer')).opacity),
          getComputedStyle(select).getPropertyValue('--id').trim(),
          cs.borderTopStyle,
          cs.borderTopColor,
          Number.parseFloat(cs.borderTopWidth)
        ];
      };
      return [...p.querySelectorAll('.collab-hold')].map(read);
    })()`);
    const merlin = holds.find(([hand]) => hand === 'merlin');
    const maya = holds.find(([hand]) => hand === 'maya');
    assert.equal(merlin[1], 1, 'the knobs are up with his hand');
    assert.equal(merlin[2], 1, 'his hand is on the sheet');
    assert.equal(maya[1], 0, 'Maya has let go of the other note');
    assert.equal(maya[2], 0, 'so its knobs are down');
    /* Presence is paint, not only opacity: a knob whose stroke is missing is a
       fill-coloured square on fill-coloured paper. Both hands must be shaded
       and both strokes must be real. */
    for (const [hand, , , id, style, color, width] of [merlin, maya]) {
      assert.ok(id.length > 0, `${hand} owns an identity shade`);
      assert.equal(style, 'solid', `${hand}'s knob is stroked`);
      assert.ok(width > 0, `${hand}'s knob has a width (${width})`);
      assert.equal(color, id, `${hand}'s stroke is its shade`);
    }
  });

  test('links: both hands draw on one clock', async () => {
    /* A link is one gesture in two strokes. A shorter span for Merlin's pen
       would make the agent draw faster than the person for no reason the
       reader can see, so both pens — and every leg under them — share one
       clock and one pen track. */
    const clock = await evaluate(`(() => {
      const p = document.querySelector('.story-pane[data-pane="3"]');
      const s = (sel) => Number.parseFloat(getComputedStyle(p.querySelector(sel)).animationDuration);
      return {
        pens: [s('.collab-pointer--draw'), s('.collab-pointer--arrow')],
        legs: [...p.querySelectorAll('.collab-wire')].map((w) => Number.parseFloat(getComputedStyle(w).animationDuration))
      };
    })()`);
    assert.equal(clock.pens[0], clock.pens[1], 'both pens walk for the same time');
    for (const leg of clock.legs) {
      assert.ok(Math.abs(leg - clock.pens[0] / 2) < 0.002, `a stroke is half a pen walk (${leg} vs ${clock.pens[0]})`);
    }
  });

  test('mobile: the station, the snap and the chapter still agree', async () => {
    await setViewport(VIEWPORTS[1]);
    await go(0);
    await waitSettled();
    await snapTo(3);
    const align = await evaluate(`(() => {
      const copy = document.querySelector('[data-story-beat="3"] .story-copy').getBoundingClientRect();
      return Math.abs(copy.top - parseFloat(getComputedStyle(document.querySelector('.story-copy')).top));
    })()`);
    assert.ok(align <= 1.5, `copy pins on the station (${align})`);
    assert.equal(await station(), 3, 'the third chapter is the face');
    assert.ok((await scene(3)).running > 0, 'the canvas scene plays');
    const leak = await evaluate(`Math.round(document.querySelector('[data-story-beat="4"] .story-copy').getBoundingClientRect().top)`);
    assert.ok(leak >= 844, `the next chapter stays out of the face (top=${leak})`);
  });

  test('mobile: the figure leads and every chapter copy clears the fold', async () => {
    /* One fold, two channels: the agent takes the top and the copy holds under
       it. The stage must leave a channel at least as tall as the longest
       chapter, or the deck parks the reader on a face whose last line is under
       the fold, where the snap can never scroll to it. The reserve (a token)
       and the copy's own height (type and wrapping) are two numbers; this
       contract is what keeps them one. A fold this short is outside it: the
       narrowest phones keep the figure's floor and lose the tail instead. */
    const folds = [
      { width: 360, height: 640, mobile: true },
      { width: 375, height: 667, mobile: true },
      { width: 390, height: 844, mobile: true },
      { width: 412, height: 915, mobile: true },
      { width: 768, height: 1024, mobile: true }
    ];
    for (const vp of folds) {
      const where = `${vp.width}x${vp.height}`;
      await setViewport(vp);
      await go(0);
      await waitSettled();
      const first = await evaluate(`(() => {
        const stage = document.querySelector('.story-stage').getBoundingClientRect();
        const intro = document.querySelector('.story-intro-body').getBoundingClientRect();
        return {
          order: [...document.querySelector('.hero-story').children].map((n) => n.className.split(' ')[0]),
          stageBottom: Number(stage.bottom.toFixed(1)),
          introTop: Number(intro.top.toFixed(1)),
          introBottom: Number(intro.bottom.toFixed(1)),
          fold: innerHeight
        };
      })()`);
      assert.deepEqual(first.order, ['story-frame', 'story-intro', 'story-beats'],
        `${where}: the agent leads the mobile flow`);
      assert.ok(first.introTop >= first.stageBottom - 0.5,
        `${where}: the intro holds under the stage (${first.introTop} vs ${first.stageBottom})`);
      assert.ok(first.introBottom <= first.fold + 0.5,
        `${where}: the first page holds the intro (${first.introBottom} vs ${first.fold})`);
      for (const n of [1, 2, 3, 4, 5, 6]) {
        await snapTo(n);
        const fit = await evaluate(`(() => {
          const stage = document.querySelector('.story-stage').getBoundingClientRect();
          const box = document.querySelector('[data-story-beat="${n}"] .story-copy');
          const track = box.querySelector('.story-copy-track').getBoundingClientRect();
          return {
            stageBottom: Number(stage.bottom.toFixed(1)),
            boxTop: Number(box.getBoundingClientRect().top.toFixed(1)),
            bottom: Number(track.bottom.toFixed(1)),
            fold: innerHeight
          };
        })()`);
        assert.ok(fit.boxTop >= fit.stageBottom - 0.5,
          `${where}: chapter ${n} holds under the stage (${fit.boxTop} vs ${fit.stageBottom})`);
        assert.ok(fit.bottom <= fit.fold + 0.5,
          `${where}: chapter ${n} clears the fold (${fit.bottom} vs ${fit.fold})`);
      }
    }
    await setViewport(VIEWPORTS[0]);
    await waitSettled();
    await go(0);
    await waitSettled();
  });

  test('canvas: no note is clipped by the board, from its first frame to its last', async () => {
    await snapTo(3);
    /* A note's parked pose is a still on the board, not a shape half outside it.
       The dry run waits the longest for its hand (its move starts at 56 % of the
       clock), so a parked frame with no resolved vertical drops the sheet onto
       the frame's top edge and the board's clip eats its name and first line.
       The invariant is the same at both ends of the scene, so it cannot depend
       on when the sample lands. */
    const inside = () => evaluate(`(() => {
      const p = document.querySelector('.story-pane[data-pane="3"]');
      const body = p.querySelector('.collab-body--canvas').getBoundingClientRect();
      return ['cutover', 'rollback', 'dryrun'].map((n) => {
        const note = p.querySelector('.collab-note[data-item="' + n + '"]');
        const r = note.getBoundingClientRect();
        const label = getComputedStyle(note.querySelector('.collab-note-label'));
        return {
          n,
          clipped: r.top < body.top - 0.5 || r.bottom > body.bottom + 0.5 ||
                   r.left < body.left - 0.5 || r.right > body.right + 0.5,
          label: label.visibility === 'visible' && Number.parseFloat(label.fontSize) > 0
        };
      });
    })()`);
    const check = (notes, when) => {
      for (const note of notes) {
        assert.equal(note.clipped, false, `${when}: ${note.n} sits on the board`);
        assert.equal(note.label, true, `${when}: ${note.n} shows its name`);
      }
    };
    check(await inside(), 'the parked frame');
    await waitFor(async () => (await evaluate(`window.__h.scene(3).settled`)), 12000, 'the scene reaches its last frame');
    check(await inside(), 'the worked frame');
  });

  test('canvas: the hand drags from the paper and resizes from the knob', async () => {
    await snapTo(3);
    /* Two grips, one hand. The sheet is taken by its body and dragged in — the
       cursor rides that grip, so it must not slide across the paper and must not
       be pinned on the corner knob — and only then is the paper grown, from the
       knob the hand walked to. A sheet that moves under a grip it is not in
       reads as the paper sliding out from under the cursor. Trace the scene,
       then judge every frame by which grip is in force. */
    await evaluate(`(() => {
      const p = document.querySelector('.story-pane[data-pane="3"]');
      const card = p.querySelector('.collab-note[data-item="dryrun"]');
      const knob = card.querySelector('.collab-knob--se');
      const pen = card.querySelector('.collab-pointer');
      const r = (el) => { const b = el.getBoundingClientRect();
        return [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10); };
      window.__trace = null;
      const trace = [];
      const start = performance.now();
      const tick = () => {
        trace.push({ paper: r(card), knob: r(knob), pen: r(pen),
          grow: Number(getComputedStyle(card).getPropertyValue('--grow')),
          opacity: Number(getComputedStyle(pen).opacity) });
        if (performance.now() - start < 6200) setTimeout(tick, 25); else window.__trace = trace;
      };
      tick();
      return true;
    })()`);
    await waitFor(async () => (await evaluate('window.__trace !== null')), 14000, 'the scene is traced');
    const trace = await evaluate('window.__trace');
    const first = trace[0], last = trace[trace.length - 1];
    assert.ok(first.paper[0] - last.paper[0] > 30,
      `the sheet was dragged in (${first.paper[0]} → ${last.paper[0]})`);
    assert.ok(first.paper[3] - last.paper[3] < -8,
      `the sheet was grown (${first.paper[3]} → ${last.paper[3]})`);
    /* Where the cursor sits on the paper, as a share of the paper: the lift
       scales the sheet, so a pixel offset would drift with the weight. */
    const grip = (s) => [(s.pen[0] - s.paper[0]) / s.paper[2], (s.pen[1] - s.paper[1]) / s.paper[3]];
    /* Read each grip from the frames that are unambiguously inside it, so a
       slow frame cannot hand a boundary sample to the wrong grip. */
    const parked = first.paper[0], mark = last.paper[0];
    const drags = trace.filter((s) => s.paper[0] > mark + 2 && s.paper[0] < parked - 2 && s.grow < 0.05);
    const grows = trace.filter((s) => s.grow > 0.15 && s.grow < 1.85);
    assert.ok(drags.length >= 4, `the paper travels under the grip (${drags.length} frames)`);
    assert.ok(grows.length >= 4, `the paper grows under the pull (${grows.length} frames)`);
    const [gx, gy] = grip(drags[0]);
    assert.ok(gx < 0.85 && gy < 0.85, `the drag is taken by the body, not the corner (${gx.toFixed(2)}, ${gy.toFixed(2)})`);
    const slide = Math.max(...drags.map((s) => Math.max(
      Math.abs(grip(s)[0] - gx), Math.abs(grip(s)[1] - gy))));
    assert.ok(slide <= 0.02, `the grip does not slide across the paper (${slide.toFixed(3)})`);
    const worst = Math.max(...grows.map((s) => Math.hypot(s.pen[0] - s.knob[0], s.pen[1] - s.knob[1])));
    assert.ok(worst <= 6, `the resize is pulled by the knob (${worst.toFixed(1)}px)`);
  });

  test('canvas: the board settles into a still, composed frame', async () => {
    await snapTo(3);
    /* A canvas at rest is still: nothing on the board is being typed, so nothing
       blinks (only a text caret does, and the board has none), and nothing is
       selected, so no handles hang on the paper. The contract is the composed
       frame — the resize kept, both links drawn — and it must not drift while
       the reader stays on the station. */
    const frame = () => evaluate(`(() => {
      const p = document.querySelector('.story-pane[data-pane="3"]');
      const box = (sel) => { const r = p.querySelector(sel).getBoundingClientRect();
        return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
      return {
        notes: ['cutover', 'rollback', 'dryrun'].map((n) => box('.collab-note[data-item="' + n + '"]')),
        legs: ['a1', 'a2', 'b1', 'b2'].map((n) => getComputedStyle(p.querySelector('.collab-wire--' + n)).transform),
        head: Number(getComputedStyle(p.querySelector('.collab-arrow-head')).opacity),
        cursors: p.querySelectorAll('.collab-note-caret').length,
        handles: [...p.querySelectorAll('.collab-select')].map((s) => Number(getComputedStyle(s).opacity))
      };
    })()`);
    await waitFor(async () => (await evaluate(`window.__h.scene(3).settled`)), 12000, 'the scene reaches its last frame');
    const settled = await frame();
    assert.equal(settled.cursors, 0, 'the board carries no text cursor');
    assert.equal(settled.handles.length, 2, 'each held card is one selection');
    for (const opacity of settled.handles) assert.equal(opacity, 0, 'the board puts its knobs away');
    for (const transform of settled.legs) assert.equal(transform, 'matrix(1, 0, 0, 1, 0, 0)', 'every link is drawn');
    assert.equal(settled.head, 1, 'the arrow has its head');
    const [one, two, three] = settled.notes;
    assert.ok(three[3] > one[3] + 6, `the resized note kept its extra rows (${three[3]} vs ${one[3]})`);
    assert.ok(Math.abs(two[3] - one[3]) < 1, 'the notes that were not resized keep one height');
    await delay(1200);
    assert.deepEqual(await frame(), settled, 'the still frame does not move');
  });

  /* A face change reflows text, not the story's clocks. The seam's measurement
     flags may force a pose, but they must never cancel an animation: a new
     animation would start at zero and replay the surface the reader is on. */
  const toggleTypeface = async () => {
    const next = await evaluate(`document.querySelector('#brand-typeface').value === 'geist' ? 'monaspace' : 'geist'`);
    await evaluate(`(() => {
      const select = document.querySelector('#brand-typeface');
      select.value = '${next}';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await evaluate('document.fonts.ready.then(() => true)');
    return next;
  };

  test('typeface: a face change never rewinds a settled canvas', async () => {
    await snapTo(3);
    await waitFor(async () => (await scene(3)).settled, 12000, 'the canvas reaches its last frame');
    const before = await evaluate(`({
      playhead: window.__h.scene(3).playhead,
      node: document.querySelector('.story-pane[data-pane="3"] .collab-note[data-item="cutover"]').getBoundingClientRect().left
    })`);
    await toggleTypeface();
    await delay(150);
    const after = await evaluate(`({
      settled: window.__h.scene(3).settled,
      playhead: window.__h.scene(3).playhead,
      node: document.querySelector('.story-pane[data-pane="3"] .collab-note[data-item="cutover"]').getBoundingClientRect().left
    })`);
    assert.equal(after.settled, true, 'the canvas stays on its last frame');
    assert.equal(after.playhead, before.playhead, 'the scene clock does not restart');
    assert.ok(Math.abs(after.node - before.node) <= 1,
      `the settled note does not jump (${before.node} -> ${after.node})`);
  });

  test('typeface: a mid-scene face change keeps the playhead moving forward', async () => {
    await snapTo(3);
    await delay(500);
    const liftTime = () => evaluate(`(() => {
      const note = document.querySelector('.story-pane[data-pane="3"] .collab-note[data-item="cutover"]');
      const lift = note.getAnimations().find((a) => a.animationName === 'collab-lift');
      return lift ? Number(lift.currentTime) : null;
    })()`);
    const start = await liftTime();
    assert.ok(start !== null && start > 0, `the carry is running (${start})`);
    await toggleTypeface();
    const samples = [];
    for (let i = 0; i < 10; i++) {
      await delay(120);
      samples.push(await liftTime());
    }
    assert.ok(samples.every((value) => value !== null && value >= start - 60),
      `the carry never rewinds (${start} -> ${samples.join(',')})`);
    assert.ok(samples[samples.length - 1] > start, 'the scene keeps playing');
  });

  /* The measurement flags force the two authored poses: the source's worked
     frame and the destination's first frame. The forced boxes must be the same
     at any playhead; otherwise a face change can bake a live frame into a seam. */
  const poseBoxes = () => evaluate(`(() => {
    const stage = document.querySelector('[data-story-stage]');
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { item: el.dataset.item || '', x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const read = (attr, n) => [...stage.querySelectorAll('[' + attr + '="' + n + '"]')].map(box);
    const out = {};
    for (let n = 1; n <= 5; n++) {
      stage.dataset.measureFrom = String(n);
      out['from' + n] = read('data-anchor', n);
      stage.dataset.measure = String(n + 1);
      out['to' + n] = read('data-arrive', n);
      delete stage.dataset.measure;
      delete stage.dataset.measureFrom;
    }
    return out;
  })()`);

  const normalizePose = (pose) => Object.fromEntries(Object.entries(pose).map(([key, boxes]) => [
    key,
    boxes.map((b) => [b.item, b.x.toFixed(1), b.y.toFixed(1), b.w.toFixed(1), b.h.toFixed(1)].join(':')).sort()
  ]));

  test('poses: every seam reads the same boxes at rest and mid-scene', async () => {
    for (const station of [1, 3, 5]) {
      await snapTo(station);
      await delay(500);
      const mid = await poseBoxes();
      await waitFor(async () => (await scene(station)).settled, 15000, `station ${station} settles`);
      const rest = await poseBoxes();
      assert.deepEqual(normalizePose(mid), normalizePose(rest),
        `station ${station}: the seam poses are playhead-independent`);
    }
  });

  test('poses: the plan exit cannot offset a seam box', async () => {
    /* The mid/rest comparison cannot see a constant ancestor transform. Seam
       4's destination and seam 5's source live inside the plan, which folds and
       clears as one field, so their posed boxes must be identical at rest and
       once the field has folded — the measurement pose holds it at rest scale. */
    const boxUnder = (selector, flag, value) => evaluate(`(() => {
      const stage = document.querySelector('[data-story-stage]');
      stage.setAttribute('${flag}', '${value}');
      void stage.getBoundingClientRect();
      const el = stage.querySelector('${selector}');
      const r = el.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      stage.removeAttribute('${flag}');
      return {
        x: Math.round((r.left - s.left) * 10) / 10,
        y: Math.round((r.top - s.top) * 10) / 10,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10
      };
    })()`);
    const read = async () => ({
      record: await boxUnder('[data-anchor="5"]', 'data-measure-from', '5'),
      access: await boxUnder('[data-arrive="4"][data-item="access"]', 'data-measure', '5')
    });
    await snapTo(5);
    await waitFor(async () => (await scene(5)).settled, 15000, 'station 5 settles');
    const before = await read();
    await snapTo(6);
    const after = await read();
    assert.deepEqual(after, before, 'the plan exit does not leak into seam 4 or 5');
  });

  test('crossfade: the plan field clears and the base is already underneath', async () => {
    await snapTo(5);
    const read = () => evaluate(`(() => {
      const stage = document.querySelector('[data-story-stage]');
      const field = stage.querySelector('.story-pane[data-pane="5"] .plan-field');
      const p6 = stage.querySelector('.story-pane[data-pane="6"]');
      const cs = getComputedStyle(field);
      return {
        opacity: Number(cs.opacity),
        visibility: cs.visibility,
        translate: cs.translate,
        scale: cs.scale,
        base: Number(getComputedStyle(p6).opacity)
      };
    })()`);

    const start = await read();
    assert.ok(start.opacity > 0.95, `plan is visible (${start.opacity})`);
    assert.equal(start.visibility, 'visible', 'plan is painted at its station');
    assert.equal(start.translate, 'none', 'the plan never moves');
    assert.equal(start.scale, 'none', 'the plan is unfolded at its station');
    assert.ok(start.base > 0.95, 'the base is already painted under the plan');

    const from = await offset(5);
    const span = await travel(5);
    await evaluate('window.__h.snap("none")');

    /* The collapse must be read before the paint leaves: the fold opens the
       window, the fade closes it. */
    await go(from + span * 0.68);
    await waitSettled();
    const folded = await read();
    assert.equal(folded.visibility, 'visible', 'the folded plan is still drawn');
    assert.ok(folded.opacity > 0.95, `the collapse starts on a drawn plan (${folded.opacity})`);
    const [foldX, foldY] = folded.scale.split(' ').map(Number);
    assert.equal(foldX, 1, 'the fold keeps the width');
    assert.ok(foldY > 0.8 && foldY < 0.98, `the plan is collapsing (${folded.scale})`);
    assert.equal(folded.translate, 'none', 'the fold never moves the plan');

    await go(from + span * 0.76);
    await waitSettled();
    const mid = await read();
    assert.ok(mid.opacity > 0.05 && mid.opacity < 0.9,
      `the field is mid-fade (${mid.opacity})`);
    assert.equal(mid.visibility, 'visible', 'the field still paints mid-fade');
    const [midX, midY] = mid.scale.split(' ').map(Number);
    assert.equal(midX, 1, 'the fade keeps the width');
    assert.ok(midY < foldY, `the collapse keeps falling through the fade (${mid.scale})`);
    assert.ok(midY > 0.75, 'the fold lands exactly on its settled height');
    assert.ok(mid.base > 0.95, 'the base is visible through the fade');

    await evaluate('window.__h.snap("")');
    await snapTo(6);
    const end = await read();
    assert.equal(end.visibility, 'hidden', 'the field is gone');
    assert.ok(end.opacity <= 0.05, 'the field cannot paint');
    assert.ok(Number(end.scale.split(' ')[1]) <= 0.8, 'the fold holds past the range');
    assert.ok(end.base > 0.95, 'the base owns the frame');

    await snapTo(5);
    const back = await read();
    assert.equal(back.visibility, 'visible', 'scroll back restores the plan');
    assert.ok(back.opacity > 0.95, 'the plan is painted again');
    assert.equal(back.scale, 'none', 'scroll back unfolds the plan again');
    assert.equal(back.translate, 'none', 'the plan never moves in either direction');
  });

  test('crossfade: the plan content does not drive the transition', async () => {
    await snapTo(5);
    await evaluate(`(() => {
      const sheet = document.querySelector('.story-pane[data-pane="5"] .plan-sheet');
      sheet.innerHTML = '<div style="height:100%;border:1px dashed var(--border-default)"></div>';
      return true;
    })()`);
    await snapTo(6);
    const end = await evaluate(`(() => {
      const stage = document.querySelector('[data-story-stage]');
      const field = stage.querySelector('.story-pane[data-pane="5"] .plan-field');
      const p6 = stage.querySelector('.story-pane[data-pane="6"]');
      return {
        visibility: getComputedStyle(field).visibility,
        opacity: Number(getComputedStyle(field).opacity),
        base: Number(getComputedStyle(p6).opacity)
      };
    })()`);
    assert.equal(end.visibility, 'hidden', 'the field still clears');
    assert.ok(end.opacity <= 0.05, 'the field still clears');
    assert.ok(end.base > 0.95, 'the base still owns the frame');
    await reload();
    await go(0);
    await waitSettled();
  });

  test('base: the deployment is the pose before the fold', async () => {
    /* Countable before it argues: six containers on three hosts, three thin
       clients asking the server for everything. The clients are icons; only
       the backend changes. */
    await evaluate(`window.__h.snap('none')`);
    await go((await offset(6)) - 40);
    await delay(200);
    const before = await evaluate(`(() => {
      const stage = document.querySelector('[data-story-stage]');
      const q = (s) => stage.querySelector(s);
      const qa = (s) => [...stage.querySelectorAll(s)];
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      const inside = (a, b) => a.x >= b.x - 1 && a.y >= b.y - 1 &&
        a.x + a.w <= b.x + b.w + 1 && a.y + a.h <= b.y + b.h + 1;
      const frames = qa('.base-well, .base-peer').map(box);
      const tips = qa('.base-link-tip').map(box);
      const drops = qa('.base-link--drop').map(box);
      const op = (s) => Number(getComputedStyle(q(s)).opacity);
      return {
        hosts: qa('.base-well-head').map((el) => el.textContent),
        middle: q('.base-peer-head').textContent,
        services: qa('.base-part-name').map((el) => el.textContent),
        volume: !!q('.base-part-fact'),
        clients: qa('.base-client').map((el) => el.dataset.client),
        icons: qa('.base-client-icon svg').length,
        hostsOf: qa('.base-part').map((el) => frames.filter((w) => inside(box(el), w)).length),
        deck: qa('.base-cloud, .base-local').length,
        bus: box(q('.base-link--bus')).w,
        mesh: box(q('.base-link--pair-a')).w,
        stem: box(q('.base-link--stem')).h,
        arrows: tips.every((tip, i) => tip.y >= drops[i].y - 1),
        seat: box(q('.base-seat')),
        scale: qa('.base-part, .base-peer').map((el) => getComputedStyle(el).scale),
        modeCloud: op('.base-mode--cloud'),
        modeLocal: op('.base-mode--local'),
        wells: qa('.base-well').map((el) => Number(getComputedStyle(el).opacity)),
        footerCloud: op('.base-footer--cloud'),
        footerLocal: op('.base-footer--local'),
        log: !!q('.base-log'),
        block: !!q('.base-block'),
        dock: !!q('.base-dock')
      };
    })()`);
    assert.deepEqual(before.hosts, ['VM 1 · app', 'VM 3 · ops'], 'the outer hosts are named');
    assert.match(before.middle, /VM 2 · data/i, 'the middle host is named while it is a host');
    assert.deepEqual(before.services,
      ['App server', 'Auth service', 'Postgres', 'Cache', 'Audit log', 'Ops pipelines']);
    assert.equal(before.volume, true, 'the stateful DB carries its volume');
    assert.deepEqual(before.clients, ['laptop', 'tablet', 'phone'], 'the clients are fixed');
    assert.equal(before.icons, 3, 'each client is an icon');
    /* Every container is drawn inside one host frame: the deployment is a real
       pose, not the local pose with different words. */
    assert.deepEqual(before.hostsOf, [1, 1, 1, 1, 1, 1], 'each container sits in its host');
    assert.equal(before.deck, 0, 'the two poses are not two layers');
    assert.ok(before.bus <= 1, `the auth bus waits (${before.bus})`);
    assert.ok(before.mesh <= 1, `the data mesh waits (${before.mesh})`);
    assert.ok(before.stem <= 1, `the auth stem waits (${before.stem})`);
    assert.equal(before.arrows, true, 'each client asks the server');
    assert.equal(before.seat.w > 0 && before.seat.h > 0, true, 'the record seat is constant');
    assert.deepEqual(before.scale, before.scale.map(() => 'none'), 'nothing is scaled');
    assert.ok(before.modeCloud > 0.95 && before.modeLocal <= 0.05, 'the mode is cloud-first');
    assert.deepEqual(before.wells, [1, 1], 'both outer hosts are drawn around their containers');
    assert.ok(before.footerCloud > 0.95 && before.footerLocal <= 0.05, 'the footer is the deployment');
    assert.equal(before.block, false, 'the six-row ledger is gone');
    assert.equal(before.log, false, 'the log is gone');
    assert.equal(before.dock, false, 'the dock is gone');
  });

  test('base: the deployment is read, then the fold is quick', async () => {
    /* The reader must be able to understand the figure before it changes. The
       clock therefore opens with a still beat on the deployment, and the fold
       that follows is shorter than that beat — a scene that makes the reader
       wait through its own motion is a scene they scroll past. The two outer
       host frames are the one thing that leaves by clearing: they are what the
       peer left behind, not containers. */
    await snapTo(6);
    await delay(120);
    const clock = await evaluate(`(() => {
      const pane = document.querySelector('.story-pane[data-pane="6"]');
      const anims = pane.getAnimations({ subtree: true })
        .filter((a) => a.timeline instanceof DocumentTimeline);
      anims.forEach((a) => a.pause());
      const perimeter = pane.querySelector('.base-perimeter');
      const total = Math.max(...anims.map((a) => Number(a.effect.getTiming().duration) || 0));
      const read = (f) => {
        anims.forEach((a) => { a.currentTime = total * f; });
        return {
          pose: Number(getComputedStyle(perimeter).getPropertyValue('--pose')),
          wells: [...pane.querySelectorAll('.base-well')]
            .map((el) => Number(getComputedStyle(el).opacity))
        };
      };
      /* Walk the clock, then name the two edges: the last frame still on the
         deployment, and the first frame that has landed. */
      const walk = [];
      for (let f = 0; f <= 1.0001; f += 0.01) walk.push({ f, ...read(f) });
      return {
        total,
        held: walk.filter((s) => s.pose <= 0.01),
        land: walk.find((s) => s.pose >= 0.999),
        end: read(1),
        moving: walk.filter((s) => s.pose > 0.01 && s.pose < 0.999).length
      };
    })()`);
    assert.ok(clock.total > 1000, `the scene owns a clock (${clock.total} ms)`);
    const still = clock.held.at(-1).f * clock.total;
    assert.ok(clock.land, 'the fold lands inside the clock');
    const land = clock.land.f * clock.total;
    assert.ok(still >= 1200, `the deployment holds long enough to read (${Math.round(still)} ms)`);
    assert.ok(land <= clock.total / 2, `the fold lands inside the first half (${Math.round(land)} ms)`);
    assert.ok(land - still < still, `the fold is quicker than the still beat (${Math.round(land - still)} ms)`);
    assert.ok(clock.moving >= 5, 'the fold is drawn, not jumped');
    assert.deepEqual(clock.held[0].wells, [1, 1], 'both hosts are drawn around their containers');
    assert.deepEqual(clock.end.wells, [0, 0], 'no empty host frame survives the fold');
    await reload();
  });

  test('base: the containers fold into the peer and the clients stay', async () => {
    /* The backend folds to one server peer. The five data containers become the
       five blocks the peer holds; the ops container becomes its key role; the
       request lines become an auth bus over a peer-to-peer mesh. The clients
       do not move: their boxes are the same before and after. */
    await evaluate(`window.__h.snap('none')`);
    await go((await offset(6)) - 40);
    await delay(150);
    const before = await evaluate(`(() => {
      const box = (el) => { const r = el.getBoundingClientRect();
        return [r.left.toFixed(1), r.top.toFixed(1), r.width.toFixed(1), r.height.toFixed(1)].join(':'); };
      return {
        clients: [...document.querySelectorAll('.base-client')].map((el) => el.dataset.client + ':' + box(el)),
        wells: [...document.querySelectorAll('.base-well')].map(box),
        seat: box(document.querySelector('.base-seat'))
      };
    })()`);
    await evaluate(`window.__h.snap('')`);
    await snapTo(6);
    await waitFor(async () => (await scene(6)).settled, 15000, 'the fold settles');
    const after = await evaluate(`(() => {
      const stage = document.querySelector('[data-story-stage]');
      const q = (s) => stage.querySelector(s);
      const qa = (s) => [...stage.querySelectorAll(s)];
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      const inside = (a, b) => a.x >= b.x - 1 && a.y >= b.y - 1 &&
        a.x + a.w <= b.x + b.w + 1 && a.y + a.h <= b.y + b.h + 1;
      const op = (s) => Number(getComputedStyle(q(s)).opacity);
      const well = box(q('.base-replica'));
      const peer = box(q('.base-peer'));
      const head = box(q('.base-peer-head'));
      const parts = qa('.base-part').map((el) => ({
        key: el.dataset.service, ...box(el),
        op: Number(getComputedStyle(el).opacity),
        scale: getComputedStyle(el).scale,
        inWell: inside(box(el), well),
        inPeer: inside(box(el), peer)
      }));
      return {
        peer,
        backend: box(q('.base-backend')),
        well,
        head,
        parts,
        wellW: box(q('.base-well')).w,
        bars: qa('.base-replica-bars i').length,
        clients: qa('.base-client').map((el) => {
          const r = el.getBoundingClientRect();
          return el.dataset.client + ':' + [r.left.toFixed(1), r.top.toFixed(1),
            r.width.toFixed(1), r.height.toFixed(1)].join(':');
        }),
        seat: (() => { const r = q('.base-seat').getBoundingClientRect();
          return [r.left.toFixed(1), r.top.toFixed(1), r.width.toFixed(1), r.height.toFixed(1)].join(':'); })(),
        wells: qa('.base-well').map((el) => {
          const r = el.getBoundingClientRect();
          return { op: Number(getComputedStyle(el).opacity),
            box: [r.left.toFixed(1), r.top.toFixed(1), r.width.toFixed(1), r.height.toFixed(1)].join(':') };
        }),
        bus: box(q('.base-link--bus')).w,
        mesh: box(q('.base-link--pair-a')).w,
        stem: box(q('.base-link--stem')).h,
        tip: getComputedStyle(q('.base-link-tip')).translate,
        serverText: q('.base-peer').textContent + q('.base-part[data-service="ops"]').textContent,
        modeLocal: op('.base-mode--local'),
        modeCloud: op('.base-mode--cloud'),
        footerLocal: op('.base-footer--local'),
        footerCloud: op('.base-footer--cloud'),
        deck: qa('.base-cloud, .base-local').length,
        log: !!q('.base-log'),
        block: !!q('.base-block'),
        dock: !!q('.base-dock'),
        device: !!q('.base-device'),
        tether: !!q('.base-tether')
      };
    })()`);
    const bars = after.parts.filter((p) => p.key !== 'ops');
    const role = after.parts.find((p) => p.key === 'ops');
    assert.equal(after.deck, 0, 'the fold leaves no second pose');
    assert.equal(after.bars, 5, 'the peer holds five block slots');
    assert.equal(bars.length, 5, 'five containers are the blocks');
    assert.deepEqual(bars.map((p) => p.inWell), [true, true, true, true, true],
      'every data container lands in the replica');
    assert.ok(bars.every((p) => p.w <= 20 && p.h <= 14), 'a block is a block, not a card');
    assert.ok(Math.max(...bars.map((p) => p.y)) - Math.min(...bars.map((p) => p.y)) <= 1,
      'the blocks share one row');
    assert.equal(role.inPeer, true, 'the ops container lands on the peer');
    assert.ok(role.h <= 12, 'the ops container becomes a line');
    assert.ok(after.peer.h < after.backend.h - 20,
      `the host frame closes to a card (${after.peer.h} of ${after.backend.h})`);
    assert.ok(Math.abs(after.peer.w - after.wellW) <= 1, 'the peer keeps a host width');
    assert.ok(after.head.y + after.head.h <= after.peer.y + 1, 'the host name lifts out of the frame');
    assert.deepEqual(after.parts.map((p) => p.op), [1, 1, 1, 1, 1, 1], 'no container is faded');
    assert.deepEqual(after.wells.map((w) => w.op), [0, 0], 'the empty host frames are gone');
    assert.deepEqual(after.wells.map((w) => w.box), before.wells,
      'a cleared frame keeps its box: the deployment pose stays measurable');
    assert.deepEqual(after.parts.map((p) => p.scale), ['none', 'none', 'none', 'none', 'none', 'none'],
      'no container is scaled');
    assert.ok(after.bus > 100, `the auth bus reaches the clients (${after.bus})`);
    assert.ok(after.mesh > 100, `the mesh links the neighbours (${after.mesh})`);
    assert.ok(after.stem > 10, `the stem joins the peer to the bus (${after.stem})`);
    assert.ok(after.tip.includes('-'), 'the request tip is retracted');
    assert.match(after.serverText, /server peer/i);
    assert.match(after.serverText, /5 blocks · signed replica/i);
    assert.match(after.serverText, /root keys · auth/i);
    assert.ok(after.modeLocal > 0.95 && after.modeCloud <= 0.05, 'the mode is local-first');
    assert.ok(after.footerLocal > 0.95 && after.footerCloud <= 0.05,
      'the footer names the four equals');
    assert.deepEqual(after.clients, before.clients, 'the clients do not move or resize');
    assert.equal(after.seat, before.seat, 'the record seat is constant');
    assert.equal(after.log, false, 'the log is gone');
    assert.equal(after.block, false, 'the six-row ledger is gone');
    assert.equal(after.dock, false, 'the dock is gone');
    assert.equal(after.device, false, 'the device screens are gone');
    assert.equal(after.tether, false, 'the tethers are gone');
  });

  test('base: the fold is a morph, not a fade', async () => {
    /* Freeze the scene clock and walk it at 1 %. Every container must exist on
       every frame, keep its opacity, keep its scale at none, and move
       continuously into its block; the frame must close monotonically; and the
       clients must not move at all. A cross-fade of two poses would fail the
       first three. */
    await snapTo(6);
    await delay(120);
    const samples = await evaluate(`(() => {
      const pane = document.querySelector('.story-pane[data-pane="6"]');
      const anims = pane.getAnimations({ subtree: true })
        .filter((a) => a.timeline instanceof DocumentTimeline);
      anims.forEach((a) => a.pause());
      const box = (el) => { const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      const out = [];
      for (let t = 0; t <= 6600; t += 66) {
        anims.forEach((a) => { a.currentTime = t; });
        out.push({
          t,
          clients: [...pane.querySelectorAll('.base-client')].map(box),
          parts: [...pane.querySelectorAll('.base-part')].map((el) => ({
            ...box(el),
            op: Number(getComputedStyle(el).opacity),
            scale: getComputedStyle(el).scale
          })),
          peer: box(pane.querySelector('.base-peer'))
        });
      }
      return out;
    })()`);
    assert.ok(samples.length > 90, 'the scene is sampled end to end');
    const first = samples[0];
    assert.deepEqual(first.clients.length, 3, 'three clients');
    assert.deepEqual(first.parts.length, 6, 'six containers');
    for (const sample of samples) {
      assert.deepEqual(sample.clients, first.clients, `the clients stay fixed at ${sample.t} ms`);
      for (const part of sample.parts) {
        assert.ok(part.w > 0 && part.h > 0, `a container exists at ${sample.t} ms`);
        assert.ok(part.op > 0.99, `a container keeps its paint at ${sample.t} ms`);
        assert.equal(part.scale, 'none', `a container is never scaled at ${sample.t} ms`);
      }
    }
    /* Each container only shrinks: width and height fall every frame until it
       is a block. */
    for (let i = 0; i < 6; i++) {
      for (let s = 1; s < samples.length; s++) {
        assert.ok(samples[s].parts[i].w <= samples[s - 1].parts[i].w + 0.1,
          `container ${i} narrows at ${samples[s].t} ms`);
        assert.ok(samples[s].parts[i].h <= samples[s - 1].parts[i].h + 0.1,
          `container ${i} shortens at ${samples[s].t} ms`);
        assert.ok(samples[s].parts[i].x >= samples[s - 1].parts[i].x - 12,
          `container ${i} travels smoothly at ${samples[s].t} ms`);
      }
    }
    const last = samples[samples.length - 1];
    assert.ok(last.parts[0].w < first.parts[0].w / 4, 'the container became a block');
    assert.ok(last.parts.every((p, i) => p.x !== first.parts[i].x), 'every container moved');
    /* The frame closes: it never grows and its top never retreats. */
    for (let s = 1; s < samples.length; s++) {
      assert.ok(samples[s].peer.h <= samples[s - 1].peer.h + 0.1,
        `the frame closes at ${samples[s].t} ms`);
      assert.ok(samples[s].peer.y >= samples[s - 1].peer.y - 0.1,
        `the frame settles at ${samples[s].t} ms`);
    }
    assert.ok(last.peer.h < first.peer.h - 20, 'the frame ends as a card');
    await reload();
  });

  test('base: every corner-bound inset holds across the corner styles', async () => {
    /* The corner style is a brand choice. The replica, the chip labels, the
       host heads, the mode and the port all start on a rounded corner, so
       their visible gap must survive Sharp, Soft and Round at both widths.
       The browser measures the real inner curve; the CSS uses the conservative
       half-radius rule. */
    const STYLES = {
      sharp: { '--radius-sm': '0px', '--radius-md': '2px', '--radius-lg': '4px', '--radius-xl': '6px' },
      soft: { '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px' },
      round: { '--radius-sm': '8px', '--radius-md': '14px', '--radius-lg': '20px', '--radius-xl': '28px' }
    };
    const TARGET = 3;
    const measure = async () => evaluate(`(async () => {
      const pane = document.querySelector('.story-pane[data-pane="6"]');
      const anims = pane.getAnimations({ subtree: true })
        .filter((a) => a.timeline instanceof DocumentTimeline);
      anims.forEach((a) => a.pause());
      const total = Math.max(...anims.map((a) => Number(a.effect.getTiming().duration) || 0));
      const box = (el) => { const b = el.getBoundingClientRect();
        return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const inset = (el) => { const s = getComputedStyle(el);
        return {
          l: parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft),
          r: parseFloat(s.borderRightWidth) + parseFloat(s.paddingRight),
          t: parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop),
          b: parseFloat(s.borderBottomWidth) + parseFloat(s.paddingBottom)
        }; };
      const gapAt = (outer, side, x, y) => {
        const o = box(outer);
        const s = getComputedStyle(outer);
        const radius = parseFloat(side === 'br' ? s.borderBottomRightRadius : s.borderTopLeftRadius);
        const width = parseFloat(side === 'br' ? s.borderBottomWidth : s.borderTopWidth);
        const used = Math.min(radius, o.w / 2, o.h / 2);
        if (used <= width) return x - width;
        const inner = used - width;
        const edge = Math.min(Math.max(y, width), used);
        const curve = used - Math.sqrt(Math.max(0, inner * inner - (used - edge) ** 2));
        return x - curve;
      };
      const boxGap = (outer, el, side) => {
        const o = box(outer), e = box(el);
        if (side === 'tr') return gapAt(outer, 'tr', o.r - e.r, e.t - o.t);
        if (side === 'br') return gapAt(outer, 'br', o.r - e.r, o.b - e.b);
        return gapAt(outer, 'tl', e.l - o.l, e.t - o.t);
      };
      const contentGap = (outer, el, side) => {
        const o = box(outer), e = box(el), c = inset(el);
        if (side === 'tr') return gapAt(outer, 'tr', o.r - (e.r - c.r), e.t + c.t - o.t);
        if (side === 'br') return gapAt(outer, 'br', o.r - (e.r - c.r), o.b - (e.b - c.b));
        return gapAt(outer, 'tl', e.l + c.l - o.l, e.t + c.t - o.t);
      };
      const q = (s) => pane.querySelector(s);
      const qa = (s) => [...pane.querySelectorAll(s)];
      const inkGap = (s) => {
        const range = document.createRange();
        range.selectNodeContents(q(s));
        return box(q('.base-egress')).l - range.getBoundingClientRect().right;
      };
      const replica = q('.base-replica');
      const snapshot = () => ({
        parts: qa('.base-part-row').map((el) => contentGap(el.closest('.base-part'), el, 'tl')),
        peerHead: contentGap(q('.base-peer'), q('.base-peer-head'), 'tl'),
        wellHeads: qa('.base-well-head').map((el) => contentGap(el.closest('.base-well'), el, 'tl')),
        replicaFirst: boxGap(replica, q('.base-part[data-service="app"]'), 'tl'),
        replicaLast: boxGap(replica, q('.base-part[data-service="audit"]'), 'tr'),
        mode: boxGap(q('.base-perimeter'), q('.base-mode'), 'tr'),
        egress: boxGap(q('.base-perimeter'), q('.base-egress-port'), 'br'),
        /* The band is one rail: the mode starts a gap after the badge, and the
           count ends a gap before the sealed port. Both are measured as ink, so
           a wider typeface cannot pass on a lucky box. */
        head: (() => {
          const badge = q('.base-head > .canvas-label');
          return box(q('.base-mode')).l - box(badge).r;
        })(),
        footCloud: inkGap('.base-footer--cloud'),
        footLocal: inkGap('.base-footer--local'),
        badge: (() => {
          const label = q('.base-head > .canvas-label');
          return [contentGap(label, label, 'tl'), contentGap(label, label, 'tr')];
        })(),
        nameClipped: replica.scrollHeight > replica.clientHeight + 1
      });
      const at = (f) => new Promise((resolve) => {
        anims.forEach((a) => { a.currentTime = total * f; });
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(snapshot())));
      });
      return { zero: await at(0.1), one: await at(0.9) };
    })()`);
    const fmt = (v) => Number(v.toFixed(2));
    for (const [name, vars] of Object.entries(STYLES)) {
      for (const viewport of VIEWPORTS) {
        await setViewport(viewport);
        await snapTo(6);
        await evaluate(`(() => {
          const root = document.documentElement;
          ${Object.entries(vars).map(([key, value]) => `root.style.setProperty('${key}', '${value}');`).join('\n')}
        })()`);
        await delay(80);
        const out = await measure();
        const where = `${name} ${viewport.width}px`;
        assert.ok(out.zero.parts.every((g) => g >= TARGET),
          `${where}: chip labels clear (${out.zero.parts.map(fmt)})`);
        assert.ok(out.zero.peerHead >= TARGET, `${where}: peer head clears (${fmt(out.zero.peerHead)})`);
        assert.ok(out.zero.wellHeads.every((g) => g >= TARGET),
          `${where}: host heads clear (${out.zero.wellHeads.map(fmt)})`);
        assert.ok(out.one.replicaFirst >= TARGET,
          `${where}: first block clears (${fmt(out.one.replicaFirst)})`);
        assert.ok(out.one.replicaLast >= TARGET,
          `${where}: last block clears (${fmt(out.one.replicaLast)})`);
        assert.ok(out.one.mode >= TARGET, `${where}: mode clears (${fmt(out.one.mode)})`);
        assert.ok(out.zero.head >= 8, `${where}: the band keeps its gap (${fmt(out.zero.head)})`);
        assert.ok(out.one.head >= 8, `${where}: the band keeps its gap (${fmt(out.one.head)})`);
        assert.ok(out.zero.footCloud >= TARGET,
          `${where}: the cloud count clears the port (${fmt(out.zero.footCloud)})`);
        assert.ok(out.one.footLocal >= TARGET,
          `${where}: the local count clears the port (${fmt(out.one.footLocal)})`);
        assert.ok(out.one.egress >= TARGET, `${where}: port clears (${fmt(out.one.egress)})`);
        assert.ok(out.one.badge.every((g) => g >= TARGET),
          `${where}: badge clears (${out.one.badge.map(fmt)})`);
        assert.equal(out.one.nameClipped, false, `${where}: replica label is not clipped`);
        await reload();
      }
    }
  });

  test('base: the top band keeps its gap on the tightest phones', async () => {
    /* The band's two ends are flex items on one rail, and the count shares its
       row with the sealed port. 320 is the pane's floor and 360 the common
       Android width, so the contract is checked where the frame is tightest,
       in every corner style: the mode's inset follows the corner radius. The
       count is measured as ink, so a wider typeface cannot pass on a box. */
    const STYLES = {
      sharp: { '--radius-xl': '6px' },
      soft: { '--radius-xl': '16px' },
      round: { '--radius-xl': '28px' }
    };
    const PHONES = [
      { width: 320, height: 568, mobile: true },
      { width: 360, height: 640, mobile: true }
    ];
    const TARGET = 3;
    for (const [name, vars] of Object.entries(STYLES)) {
      for (const viewport of PHONES) {
        await setViewport(viewport);
        await snapTo(6);
        await evaluate(`(() => {
          const root = document.documentElement;
          ${Object.entries(vars).map(([key, value]) => `root.style.setProperty('${key}', '${value}');`).join('\n')}
        })()`);
        await delay(80);
        const out = await evaluate(`(() => {
          const pane = document.querySelector('.story-pane[data-pane="6"]');
          const ink = (s) => {
            const range = document.createRange();
            range.selectNodeContents(pane.querySelector(s));
            return range.getBoundingClientRect();
          };
          const badge = pane.querySelector('.base-head > .canvas-label').getBoundingClientRect();
          const mode = pane.querySelector('.base-mode').getBoundingClientRect();
          const port = pane.querySelector('.base-egress').getBoundingClientRect();
          return {
            head: mode.left - badge.right,
            cloud: port.left - ink('.base-footer--cloud').right,
            local: port.left - ink('.base-footer--local').right
          };
        })()`);
        const where = `${name} ${viewport.width}px`;
        const fmt = (v) => Number(v.toFixed(2));
        assert.ok(out.head >= 8, `${where}: the band keeps its gap (${fmt(out.head)})`);
        assert.ok(out.cloud >= TARGET, `${where}: the cloud count clears the port (${fmt(out.cloud)})`);
        assert.ok(out.local >= TARGET, `${where}: the local count clears the port (${fmt(out.local)})`);
        await reload();
      }
    }
  });

  test('guard: one point per rest, one owner per fact', () => {
    const css = siteCss;
    const js = fs.readFileSync(path.join(ROOT, 'apps/web/src/islands/hero-story/controller.js'), 'utf8');
    const clocks = fs.readFileSync(path.join(ROOT, 'apps/web/src/islands/hero-story/clocks.js'), 'utf8');
    const rules = css.match(/[^{}]*\{[^{}]*animation-timeline[^{}]*\}/g) || [];
    assert.ok(rules.length > 0, 'the story is scroll-driven');
    /* The page lights are the one other scroll-driven layer: they ride the
       story's own timelines (`--opening`, the root scroll) from outside it, so
       they are named here instead of being mistaken for a second story clock. */
    for (const rule of rules) {
      const selector = rule.slice(0, rule.indexOf('{'));
      assert.match(selector, /\.(?:story-(carrier|pane|artifact|anchor|copy|intro|card|frame)|page-bg__)/,
        `scroll timeline outside the story: ${selector.trim()}`);
    }
    /* A rest area taller than the snapport is a range and lets the reader park
       anywhere inside it; the bug cannot come back if only points snap. */
    const snaps = css.match(/[^{}]*\{[^{}]*scroll-snap-align[^{}]*\}/g) || [];
    assert.ok(snaps.length > 0, 'the page still snaps');
    for (const rule of snaps) {
      const selector = rule.slice(0, rule.indexOf('{'));
      assert.match(selector, /snap-point/, `a rest area must be a point: ${selector.trim()}`);
    }
    /* The seam controller measures boxes; it must not own a playhead. The
       clock driver is the one place allowed to touch animation state, and it is
       banned from the scroll the same way. */
    for (const token of ['setInterval', 'currentTime', 'getAnimations', 'rAF', 'requestAnimationFrame']) {
      assert.ok(!js.includes(token), `hero script must not contain ${token}`);
    }
    for (const call of ['scrollTo(', 'scrollBy(', 'scrollIntoView(']) {
      assert.ok(!js.includes(call), `hero script must not call ${call}`);
      assert.ok(!clocks.includes(call), `the scene playhead must not call ${call}`);
    }
    assert.ok(!/scroll(Top|Left)\s*(=|\+=|-=)/.test(js), 'hero script must not write the scroll');
    assert.ok(!/scroll(Top|Left)\s*(=|\+=|-=)/.test(clocks), 'the scene playhead must not write the scroll');
    assert.ok(!fs.existsSync(path.join(ROOT, 'apps/web/src/islands/hero-story/stations.js')),
      'the station has one owner: the snapped beat, not a second offset table');
  });
}
