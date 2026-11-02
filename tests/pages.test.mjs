/* Page contracts for both routes. Drives Chrome over CDP and reads public DOM
   state only. The hero scroll contract lives in hero-snap.test.mjs. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { startServer, DIST } from '../scripts/serve-dist.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
/* Same contracts, two targets: the CI artifact (default) and the dev server.
   Running both is what keeps `npm run dev` honest. */
const TARGET = process.env.MERLIN_PAGES_TARGET === 'dev' ? 'dev' : 'dist';
const DIST_ONLY = TARGET === 'dev' ? 'artifact-only assertion' : false;

let vite;
const CHROME_BIN = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Users/ofri/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && fs.existsSync(p));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, ms, label) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await delay(25);
  }
  throw new Error(`timeout waiting for ${label}; last=${JSON.stringify(last)}`);
}

const luminance = (value) => {
  const channels = value.match(/\d+/g).slice(0, 3).map(Number)
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      } else {
        (this.handlers.get(message.method) || []).forEach((fn) => fn(message.params));
      }
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

let server;
let baseUrl;
let chrome;
let profileDir;
let cdp;
let errors = [];

async function evaluate(expression) {
  const out = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (out.exceptionDetails) {
    throw new Error(out.exceptionDetails.exception?.description || out.exceptionDetails.text);
  }
  return out.result.value;
}

/* The spine states one thing: which step the deck rests on. Read the mark as a
   step index and as a share of the rule, so the assertions survive any rewrite
   of how the shape is drawn. */
const readSpine = () => evaluate(`(() => {
  const s = document.querySelector('.pager-spine');
  const f = s?.querySelector('.pager-spine-fill');
  if (!s || !f) return null;
  const rule = s.getBoundingClientRect(), mark = f.getBoundingClientRect();
  return {
    marks: s.children.length,
    width: mark.width,
    track: rule.width,
    left: mark.left - rule.left,
    step: (mark.left - rule.left) / mark.width,
    markColour: getComputedStyle(f).backgroundColor,
    trackColour: getComputedStyle(s).backgroundColor
  };
})()`);

async function navigate(pathName, { storedTheme, scripts = true } = {}) {
  errors = [];
  await cdp.send('Storage.clearDataForOrigin', {
    origin: baseUrl,
    storageTypes: 'local_storage',
  });
  await cdp.send('Emulation.setScriptExecutionDisabled', { value: !scripts });
  let scriptId;
  if (storedTheme) {
    scriptId = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { localStorage.setItem('merlin-theme', ${JSON.stringify(storedTheme)}); } catch (e) {}`,
    })).identifier;
  }
  const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
  await cdp.send('Page.navigate', { url: baseUrl + pathName });
  await loaded;
  await waitFor(() => evaluate('document.readyState === "complete"'), 10000, 'document ready');
  if (scriptId) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
  await cdp.send('Emulation.setScriptExecutionDisabled', { value: false });
}

/* Pin the viewport and stop motion, so the measured boxes are the worked
   frame at every size. */
async function setViewport(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
}

async function launch() {
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-pages-'));
  chrome = spawn(
    CHROME_BIN,
    [
      '--headless',
      '--no-sandbox',
      '--hide-scrollbars',
      '--window-size=1280,900',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--remote-allow-origins=*',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  chrome.stderr.on('data', () => {});
  let port;
  await waitFor(() => {
    try {
      port = Number(fs.readFileSync(path.join(profileDir, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      return Number.isInteger(port) && port > 0;
    } catch {
      return false;
    }
  }, 15000, 'DevToolsActivePort');
  let target;
  await waitFor(async () => {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((item) => item.type === 'page');
      return Boolean(target?.webSocketDebuggerUrl);
    } catch {
      return false;
    }
  }, 15000, 'page target');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  cdp = new CDP(ws);
  cdp.on('Runtime.exceptionThrown', (params) => errors.push(params.exceptionDetails.text));
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      errors.push(params.args.map((arg) => arg.value ?? arg.description).join(' '));
    }
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  /* Pin the motion preference: headless Chrome can report "reduce", which
     would silence the transitions the spine contract is about. */
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
}

before(async () => {
  if (!CHROME_BIN) return;
  if (TARGET === 'dev') {
    vite = await createViteServer({
      configFile: path.join(ROOT, 'apps/web/vite.config.ts'),
      server: { port: 5199, strictPort: true },
      logLevel: 'warn',
    });
    await vite.listen();
    baseUrl = vite.resolvedUrls.local[0].replace(/\/$/, '');
  } else {
    server = await startServer(DIST);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  await launch();
});

after(async () => {
  cdp?.ws.close();
  if (chrome) {
    chrome.kill('SIGKILL');
    await new Promise((resolve) => chrome.once('exit', resolve));
  }
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await vite?.close();
  if (profileDir) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      /* Chrome helpers can hold the profile briefly; the temp dir is disposable. */
    }
  }
});

test('page contracts: Chrome unavailable', { skip: CHROME_BIN ? 'Chrome available' : 'No Chrome binary' }, () => {});

/* First paint is a user-facing frame: the mark must already be its intended
   size. An unstyled paint draws the attribute-less SVG at 100% of its box,
   which is the full-screen splash logo this guards. */
test('routes: the brand mark is never painted oversized', async () => {
  for (const pathName of ['/', '/design-system/']) {
    const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__markWidths = [];
        (function sample() {
          const mark = document.querySelector('.brand .brand-mark');
          if (mark) window.__markWidths.push(Math.round(mark.getBoundingClientRect().width));
          if (window.__markWidths.length < 90) requestAnimationFrame(sample);
        })();`,
    });
    const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
    await cdp.send('Page.navigate', { url: baseUrl + pathName });
    await loaded;
    await waitFor(() => evaluate('(window.__markWidths || []).length >= 60'), 5000, 'first-paint samples');
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    const widths = await evaluate('window.__markWidths');
    assert.ok(widths.length >= 60, `${pathName}: sampled ${widths.length} frames`);
    const widest = Math.max(...widths);
    assert.ok(widest <= 40, `${pathName}: brand mark painted ${widest}px wide; styles must precede first paint`);
  }
});

test('home: static sections render and hydrate without errors', async () => {
  await navigate('/');
  await waitFor(() => evaluate('Boolean(document.querySelector("#themeToggle"))'), 5000, 'theme island');
  /* The stateless story writes no phase attribute. The island only measures
     and listens, so there is no readiness flag to poll; give hydration a
     frame pair and keep the error capture as the contract. */
  await delay(400);
  assert.match(await evaluate('getComputedStyle(document.documentElement).scrollSnapType'), /^y mandatory$/,
    'the page keeps its snap after hydration');
  assert.equal(await evaluate('document.querySelectorAll(".story-scroll").length'), 0,
    'the story adds no scrollport of its own');
  const page = await evaluate(`({
    title: document.title,
    h1: document.querySelector('h1')?.textContent,
    sections: [...document.querySelectorAll('main > section')].map((s) => s.id || s.className),
    islands: [...document.querySelectorAll('[data-island]')].map((n) => n.dataset.island),
    nav: document.querySelectorAll('.nav-links a').length
  })`);
  assert.match(page.title, /Merlin/);
  assert.equal(page.h1, 'Build collaborative agent experiences.');
  assert.deepEqual(page.sections, ['top', 'tailor']);
  assert.deepEqual(page.islands, ['pager', 'theme', 'hero']);
  assert.equal(page.nav, 0, 'the nav no longer duplicates the contents');
  assert.deepEqual(errors, []);
  await waitFor(() => evaluate('document.querySelectorAll(".pager-row").length === 8'), 5000, 'contents');
  const pager = await evaluate(`({
    now: document.querySelector('.pager-now')?.textContent,
    num: document.querySelector('.pager-trigger-num')?.textContent,
    numHidden: document.querySelector('.pager-trigger-num')?.hidden,
    open: document.querySelector('.pager-contents')?.matches(':popover-open'),
    firstRowNum: document.querySelector('.pager-row .pager-row-num')?.textContent,
    current: [...document.querySelectorAll('.pager-row')].findIndex((r) => r.getAttribute('aria-current') === 'true'),
    label: document.querySelector('.pager-row[aria-current="true"]')?.textContent
  })`);
  assert.equal(pager.now, 'Intro', 'the running head names the first panel');
  assert.equal(pager.num, '00', 'the intro is numbered 00');
  assert.equal(pager.numHidden, false, 'the numeral shows in the collapsed head');
  assert.equal(pager.open, false, 'the head is collapsed');
  assert.equal(pager.firstRowNum, '00', 'the intro row carries the same number');
  assert.equal(pager.current, 0, 'the contents marks the first panel');
  assert.match(pager.label, /Intro/, 'the panel names itself');
  const spine = await readSpine();
  assert.equal(spine.marks, 1, 'the spine draws one mark, not a segmented strip');
  assert.ok(Math.abs(spine.width - spine.track / 8) <= 1, `the mark is one of eight equal steps (${spine.width} of ${spine.track})`);
  assert.ok(Math.abs(spine.left) <= 1, 'the mark rests on the first step');
  assert.notEqual(spine.markColour, spine.trackColour, 'the current step is the only painted part');
  const edge = await evaluate(`(() => {
    const bar = document.querySelector('.nav'), rule = document.querySelector('.pager-spine');
    return { bar: parseFloat(getComputedStyle(bar).borderBottomWidth), rule: rule.getBoundingClientRect().height };
  })()`);
  assert.equal(edge.bar, 0, 'the spine is the only rule under the bar');
  assert.ok(Math.abs(edge.rule - 2) <= 0.5, `the rule keeps one weight (${edge.rule})`);
  assert.deepEqual(errors, []);
});

test('pager: the running head follows the panel the deck rests on', async () => {
  /* The scroll is discrete, so the page must say where the reader is. The
     spine, the head, and the contents read the same snap position the scroll
     engine uses. */
  await navigate('/');
  await waitFor(() => evaluate('document.querySelectorAll(".pager-row").length === 8'), 5000, 'contents');
  await evaluate(`document.querySelector('#tailor').scrollIntoView({ behavior: 'instant', block: 'start' })`);
  await waitFor(() => evaluate(`document.querySelector('.pager-now').textContent === 'Tailor'`), 4000, 'head follows the panel');
  const at = await evaluate(`({
    now: document.querySelector('.pager-now')?.textContent,
    num: document.querySelector('.pager-trigger-num')?.hidden === false ? document.querySelector('.pager-trigger-num').textContent : null,
    current: [...document.querySelectorAll('.pager-row')].findIndex((r) => r.getAttribute('aria-current') === 'true'),
    live: document.querySelector('.pager-live')?.textContent
  })`);
  assert.equal(at.now, 'Tailor', 'the last panel names the handover, not the argument');
  assert.equal(at.num, '07', 'the closing panel carries the numeral after the story');
  assert.doesNotMatch(at.now, /\d/, 'the head never carries a deck numeral');
  assert.equal(at.current, 7, 'the last panel is current');
  await waitFor(async () => Math.round((await readSpine()).step) === 7, 2000, 'the spine follows the same panel');
  assert.match(at.live, /panel 8 of 8/, 'the announcement names the position');

  /* The head's numeral is the row's numeral, not a deck ordinal: panel 6 is
     chapter 05, and both places must say 05. */
  await evaluate(`document.querySelector('#chapter-5').scrollIntoView({ behavior: 'instant', block: 'start' })`);
  await waitFor(() => evaluate(`document.querySelector('.pager-now').textContent === 'Schema'`), 4000, 'head follows the chapter');
  const chapter = await evaluate(`({
    num: document.querySelector('.pager-trigger-num')?.textContent,
    row: document.querySelector('.pager-row[aria-current="true"] .pager-row-num')?.textContent
  })`);
  assert.equal(chapter.num, '05', 'the head numbers the chapter');
  assert.equal(chapter.num, chapter.row, 'the head and the row share one number');
  assert.deepEqual(errors, []);
});

test('spine: the mark slides from step to step', async () => {
  /* One rule leaves the motion to carry the travel direction: the mark must be
     seen between two steps, never teleported. Sampling runs in the page, so
     every frame counts, and an integer jump cannot pass as travel. */
  await navigate('/');
  await waitFor(() => evaluate('Boolean(document.querySelector(".pager-spine-fill"))'), 5000, 'spine');
  const settle = (step, label) => waitFor(async () => Math.abs((await readSpine()).step - step) < 0.05, 2000, label);
  const walk = (selector) => evaluate(`(async () => {
    const rule = document.querySelector('.pager-spine');
    const mark = document.querySelector('.pager-spine-fill');
    const step = () => {
      const r = rule.getBoundingClientRect(), m = mark.getBoundingClientRect();
      return (m.left - r.left) / m.width;
    };
    document.querySelector('${selector}').scrollIntoView({ behavior: 'instant', block: 'start' });
    const seen = [];
    const end = performance.now() + 800;
    while (performance.now() < end) { seen.push(step()); await new Promise((done) => requestAnimationFrame(done)); }
    return seen;
  })()`);
  const between = (seen, from, to) => seen.some(
    (step) => step > from + 0.05 && step < to - 0.05 && Math.abs(step - Math.round(step)) > 0.05
  );

  const forward = await walk('#chapter-6');
  assert.ok(between(forward, 0, 6), `the mark travels forward instead of jumping (${forward.map((s) => s.toFixed(2))})`);
  await settle(6, 'forward rest');

  const backward = await walk('#chapter-5');
  assert.ok(between(backward, 5, 6), `the mark travels backward instead of jumping (${backward.map((s) => s.toFixed(2))})`);
  await settle(5, 'backward rest');
  assert.deepEqual(errors, []);
});

test('pager: the running head opens the one contents list', async () => {
  await navigate('/');
  await waitFor(() => evaluate('document.querySelectorAll(".pager-row").length === 8'), 5000, 'contents');
  await evaluate('document.querySelector(".pager-trigger").click()');
  await waitFor(() => evaluate('document.querySelector(".pager-contents").matches(":popover-open") && document.querySelector(".pager-trigger").getAttribute("aria-expanded") === "true"'), 3000, 'contents open');
  const open = await evaluate(`({
    rows: document.querySelectorAll('.pager-row').length,
    chapters: [...document.querySelectorAll('.pager-row-num')].map((n) => n.textContent).filter(Boolean),
    captions: document.querySelectorAll('.pager-group').length,
    last: (() => {
      const row = [...document.querySelectorAll('.pager-row')].at(-1);
      return row.querySelector('.pager-row-num').textContent + ' ' + row.lastElementChild.textContent;
    })()
  })`);
  assert.equal(open.rows, 8, 'the list holds every panel');
  assert.deepEqual(open.chapters, ['00', '01', '02', '03', '04', '05', '06', '07'], 'the intro is 00, the story runs 01 to 06, the close is 07');
  assert.equal(open.captions, 0, 'the list repeats the deck without headings');
  assert.equal(open.last, '07 Tailor', 'the closing panel ends the list as a numbered plain row');
  await evaluate('document.querySelector(".pager-row").click()');
  await waitFor(() => evaluate('!document.querySelector(".pager-contents").matches(":popover-open")'), 3000, 'contents closed');
  assert.deepEqual(errors, []);
});

test('design system: gallery renders and hydrates without errors', async () => {
  await navigate('/design-system/');
  await waitFor(() => evaluate('Boolean(document.querySelector("#themeToggle"))'), 5000, 'theme island');
  await waitFor(() => evaluate('document.querySelectorAll(".ds-showcase").length === 5'), 5000, 'showcases');
  const page = await evaluate(`({
    title: document.title,
    h1: document.querySelector('h1')?.textContent,
    showcases: [...document.querySelectorAll('.ds-showcase h3')].map((n) => n.textContent),
    badges: document.querySelectorAll('.ds-hero-meta > span').length,
    lab: Boolean(document.querySelector('[data-island="lab"]'))
  })`);
  assert.match(page.title, /design system/i);
  assert.equal(page.h1, 'One kit. Both themes.');
  assert.deepEqual(page.showcases, ['Button', 'Badge', 'Input', 'CodeBlock', 'AgentCard']);
  assert.equal(page.badges, 3);
  assert.equal(page.lab, true);
  assert.deepEqual(errors, []);
});

test('theme boot: a stored light preference paints light before JS islands', async () => {
  await navigate('/', { storedTheme: 'light' });
  const boot = await evaluate(`({
    theme: document.documentElement.dataset.theme,
    pref: document.documentElement.dataset.themePref
  })`);
  assert.deepEqual(boot, { theme: 'light', pref: 'light' });
});

test('brand mark: the contour is the darkest ink in both themes', async () => {
  for (const theme of ['light', 'dark']) {
    await navigate('/', { storedTheme: theme });
    const inks = await evaluate(`(() => {
      const fill = (role) => {
        const path = document.querySelector('#merlin-mark path[fill="var(--brand-' + role + ')"]');
        return path ? getComputedStyle(path).fill : null;
      };
      return { outline: fill('outline'), shadow: fill('shadow'), body: fill('body') };
    })()`);
    for (const [role, value] of Object.entries(inks)) {
      assert.match(value || '', /^rgb\(/, `${theme}: ${role} resolves`);
    }
    assert.ok(luminance(inks.outline) < luminance(inks.shadow),
      `${theme}: contour must be darker than shadow`);
    assert.ok(luminance(inks.shadow) < luminance(inks.body),
      `${theme}: shadow must be darker than body`);
  }
});

test('theme toggle: keyboard activation advances the preference', async () => {
  await navigate('/');
  await waitFor(() => evaluate('Boolean(document.querySelector("#themeToggle"))'), 5000, 'toggle');
  await evaluate('document.querySelector("#themeToggle").focus()');
  const beforePref = await evaluate('document.documentElement.dataset.themePref');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await waitFor(async () => (await evaluate('document.documentElement.dataset.themePref')) !== beforePref, 3000, 'preference change');
  const afterPref = await evaluate('document.documentElement.dataset.themePref');
  assert.notEqual(afterPref, beforePref);
  assert.deepEqual(errors, []);
});

/* The toggle swaps its canonical glyph after hydration; the kit gate decides
   which kit symbol paints. Every mode and every kit must paint a real symbol. */
test('theme toggle: every mode paints its icon', async () => {
  await navigate('/');
  await waitFor(() => evaluate('Boolean(document.querySelector("#themeToggle"))'), 5000, 'toggle');
  const modes = [
    { pref: 'auto', icon: 'monitor' },
    { pref: 'light', icon: 'sun' },
    { pref: 'dark', icon: 'moon' },
  ];
  for (const mode of modes) {
    await waitFor(async () => (await evaluate('document.documentElement.dataset.themePref')) === mode.pref,
      3000, `${mode.pref} preference`);
    const paint = await evaluate(`(() => {
      const uses = [...document.querySelectorAll('#themeToggle svg use')];
      const use = uses.find((node) => getComputedStyle(node).display !== 'none');
      if (!use) return { href: null, symbol: false, area: 0 };
      const href = use.getAttribute('href');
      const box = use.getBBox();
      return { href, symbol: Boolean(document.querySelector(href)), area: box.width * box.height };
    })()`);
    assert.equal(paint.href, `#ph-${mode.icon}`, `${mode.pref}: the toggle shows ${paint.href}`);
    assert.ok(paint.symbol, `${mode.pref}: the sprite has no ${mode.icon}`);
    assert.ok(paint.area > 0, `${mode.pref}: ${mode.icon} paints nothing`);
    if (mode.pref !== 'dark') await evaluate('document.querySelector("#themeToggle").click()');
  }
  assert.deepEqual(errors, []);
});





test('theme lab: a slider updates its output and the page tokens', async () => {
  await navigate('/design-system/');
  await waitFor(() => evaluate('Boolean(document.querySelector("#primary-hue"))'), 5000, 'lab');
  await evaluate(`(() => {
    const slider = document.querySelector('#primary-hue');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(slider, '200');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await waitFor(async () => (await evaluate('document.querySelector("#primary-hue-value").textContent')) === '200°', 3000, 'output');
  const background = await waitFor(async () => {
    const value = await evaluate('getComputedStyle(document.body).backgroundColor');
    return value !== 'rgb(243, 244, 255)' ? value : null;
  }, 3000, 'token update');
  assert.ok(background);
  assert.deepEqual(errors, []);
});

/* The agent turn is a miniature surface. Its rails are a user-facing frame:
   the trace and the answer must read as one card, not two grids. */
test('home: the agent turn shares one rail and one scale', async () => {
  for (const [width, height] of [[1280, 900], [360, 740]]) {
    await setViewport(width, height);
    await navigate('/', { storedTheme: 'light' });
    await evaluate('document.fonts.ready.then(() => true)');
    await delay(120);
    const m = await evaluate(`(() => {
      const q = (s) => document.querySelector(s);
      const left = (el) => el.getBoundingClientRect().left;
      const textLeft = (el) => {
        const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (!node) return null;
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect().left;
      };
      const box = (el) => el.getBoundingClientRect();
      const steps = q('.chat-turn--agent .chat-steps');
      const artifact = q('.chat-turn--agent .chat-artifact');
      const who = q('.chat-turn--agent .chat-who');
      const icon = q('.chat-turn--agent .chat-step .icon');
      const num = q('.chat-turn--agent .artifact-num');
      const title = q('.chat-turn--agent .artifact-title');
      const head = q('.chat-turn--agent .artifact-head');
      const mark = q('.chat-turn--agent .artifact-mark');
      const actions = q('.chat-turn--agent .artifact-actions');
      const retry = q('.chat-turn--agent .chat-step-retry');
      const line = q('.chat-turn--agent .artifact-line');
      const stepName = q('.chat-turn--agent .chat-step-name');
      const face1 = q('.story-carrier[data-seam="1"] .story-face');
      const face2 = q('.story-carrier[data-seam="2"] .story-face');
      const face3 = q('.story-carrier[data-seam="3"] .story-face');
      const node = q('[data-anchor="3"]');
      const entry = q('.entry');
      const entryLabel = q('.entry .collab-note-label');
      const paper = q('.story-pane[data-pane="2"] .collab-paper');
      const paperHead = q('.story-pane[data-pane="2"] .artifact-head');
      const paperTitle = q('.story-pane[data-pane="2"] .artifact-title');
      const paperActions = q('.story-pane[data-pane="2"] .artifact-actions');
      const docLine = q('.story-pane[data-pane="2"] .collab-line .collab-text');
      const paperStyle = getComputedStyle(paper);
      const paperInset = parseFloat(paperStyle.paddingRight) + parseFloat(paperStyle.borderRightWidth);
      const rootStyle = getComputedStyle(document.documentElement);
      const tokenNames = ['0_5','1','1_5','2','3','4','5','6','8','10','12','16','20','24'];
      const allowed = new Set([0, ...tokenNames.map((n) => parseFloat(rootStyle.getPropertyValue('--space-' + n)))]);
      const props = ['paddingTop','paddingRight','paddingBottom','paddingLeft','rowGap','columnGap','marginTop','marginBottom','top','left'];
      const chat = q('.chat');
      const bad = [];
      for (const el of [chat, ...chat.querySelectorAll('*')]) {
        const style = getComputedStyle(el);
        for (const prop of props) {
          const value = style[prop];
          if (!value.endsWith('px')) continue;
          const n = parseFloat(value);
          if (!allowed.has(n)) bad.push((el.className || el.tagName) + '.' + prop + '=' + value);
        }
      }
      return {
        hasTurn: Boolean(q('.chat-turn--agent')),
        icon: left(icon), num: left(num), title: textLeft(title), head: left(head), mark: left(mark),
        stepText: left(stepName), lineText: textLeft(line),
        labelGap: box(steps).top - box(who).bottom,
        answerGap: box(artifact).top - box(steps).bottom,
        rightTrace: box(steps).right - box(retry).right,
        rightPlate: box(artifact).right - box(head).right,
        rightActions: box(artifact).right - box(actions).right,
        face1Pad: getComputedStyle(face1).padding,
        face1Art: getComputedStyle(artifact).padding,
        face2Pad: getComputedStyle(face2).padding,
        paperPad: getComputedStyle(paper).padding,
        paperInset,
        paperHeadLeft: left(paperHead) - left(paper),
        paperHeadRight: box(paper).right - box(paperHead).right,
        paperTitle: textLeft(paperTitle),
        paperActionsRight: box(paper).right - box(paperActions).right,
        paperText: textLeft(docLine),
        face3Pad: getComputedStyle(face3).padding,
        nodePad: getComputedStyle(node).padding,
        entryPad: getComputedStyle(entry).padding,
        nodeLabel: q('.story-pane[data-pane="3"] .collab-note-label').textContent,
        entryLabel: entryLabel.textContent,
        carrierBorders: [...document.querySelectorAll('.story-carrier')].map((el) => getComputedStyle(el).borderTopWidth),
        anchors: [1, 2, 3, 4, 5].reduce((n, seam) =>
          n + document.querySelectorAll('[data-anchor="' + seam + '"]').length, 0),
        bad
      };
    })()`);
    const at = `${width}px`;
    assert.ok(m.hasTurn, `${at}: agent turn exists`);
    assert.ok(Math.abs(m.icon - m.num) <= 0.5, `${at}: icons and numbers share the leading rail (${m.icon} vs ${m.num})`);
    assert.ok(Math.abs(m.head - m.icon) <= 0.5, `${at}: the card's head starts on the leading rail (${m.head} vs ${m.icon})`);
    assert.ok(Math.abs(m.mark - m.head) <= 0.5, `${at}: the document mark starts the head (${m.mark} vs ${m.head})`);
    assert.ok(Math.abs(m.title - m.lineText) <= 0.5, `${at}: the head's title joins the card's text rail (${m.title} vs ${m.lineText})`);
    assert.ok(Math.abs(m.rightActions - m.rightPlate) <= 0.5, `${at}: the actions close on the right inset (${m.rightActions} vs ${m.rightPlate})`);
    assert.ok(Math.abs(m.stepText - m.lineText) <= 0.5, `${at}: trace and card share the text rail (${m.stepText} vs ${m.lineText})`);
    assert.ok(Math.abs(m.rightTrace - m.rightPlate) <= 0.5, `${at}: trace and card share the right inset (${m.rightTrace} vs ${m.rightPlate})`);
    assert.ok(m.answerGap >= 2 * m.labelGap - 0.5, `${at}: the answer separates from the trace (${m.labelGap} then ${m.answerGap})`);
    assert.deepEqual(m.bad, [], `${at}: spacing is on the token scale`);
    assert.equal(m.face1Pad, m.face1Art, `${at}: the answer face keeps the card inset`);
    assert.equal(m.face2Pad, m.paperPad, `${at}: the doc face keeps the paper inset`);
    assert.ok(Math.abs(m.paperHeadLeft - m.paperInset) <= 0.5, `${at}: the doc head starts at the paper's inset (${m.paperHeadLeft} vs ${m.paperInset})`);
    assert.ok(Math.abs(m.paperHeadRight - m.paperInset) <= 0.5, `${at}: the doc head ends at the paper's inset (${m.paperHeadRight} vs ${m.paperInset})`);
    assert.ok(Math.abs(m.paperActionsRight - m.paperInset) <= 0.5, `${at}: the doc actions stay on the paper's inset (${m.paperActionsRight} vs ${m.paperInset})`);
    assert.ok(Math.abs(m.paperTitle - m.paperText) <= 0.5, `${at}: the doc title joins the body's text rail (${m.paperTitle} vs ${m.paperText})`);
    assert.equal(m.face3Pad, m.nodePad, `${at}: the canvas face keeps the node inset`);
    assert.equal(m.entryPad, m.nodePad, `${at}: an entry keeps the sheet inset`);
    assert.equal(m.entryLabel, m.nodeLabel, `${at}: an entry repeats its tile`);
    assert.equal(m.carrierBorders.length, m.anchors, `${at}: one carrier per item that crosses`);
    assert.deepEqual([...new Set(m.carrierBorders)], ['1px'], `${at}: every carrier carries the source border`);
    assert.deepEqual(errors, [], `${at}: no runtime errors`);
  }
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
});

/* Maya's turn is a plate on the chat well. A fill that lands on the well fill
   renders the message as bare text, so the two surfaces must stay apart. */
test('home: the human bubble separates from the chat well', async () => {
  await setViewport(1280, 900);
  for (const storedTheme of ['light', 'dark']) {
    await navigate('/', { storedTheme });
    const fills = await evaluate(`(() => {
      const ctx = document.createElement('canvas').getContext('2d');
      const rgb = (selector) => {
        ctx.fillStyle = getComputedStyle(document.querySelector(selector)).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).join(',');
      };
      return { bubble: rgb('.chat-turn--human .chat-text'), well: rgb('.chat') };
    })()`);
    const [bubble, well] = [fills.bubble, fills.well].map((fill) => luminance(`rgb(${fill})`));
    const separation = (Math.max(bubble, well) + 0.05) / (Math.min(bubble, well) + 0.05);
    assert.ok(separation >= 1.05, `${storedTheme}: bubble/well contrast ${separation}`);
    assert.deepEqual(errors, [], `${storedTheme}: no runtime errors`);
  }
});


test('story: each station paints its own surface', async () => {
  await setViewport(1440, 900);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await navigate('/');
  await waitFor(() => evaluate('Boolean(document.documentElement.dataset.panel)'), 5000, 'pager');
  /* The pane a chapter rests on is opaque; the pane it replaced is gone. A
     later `animation` shorthand once replaced these seams, so chapter 2 rested
     on the chat surface and chapter 4 on the canvas. */
  const opacity = (n) => evaluate(`Number(getComputedStyle(document.querySelector('.story-pane[data-pane="${n}"]')).opacity)`);
  for (const [chapter, pane, before] of [[1, 1, null], [2, 2, 1], [4, 4, 3]]) {
    await evaluate(`document.querySelector('#chapter-${chapter}').scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await waitFor(() => evaluate(`document.documentElement.dataset.panel === 'chapter-${chapter}'`), 5000, `panel ${chapter}`);
    await delay(250);
    assert.ok((await opacity(pane)) > 0.95, `chapter ${chapter} shows pane ${pane}`);
    if (before) assert.ok((await opacity(before)) < 0.05, `chapter ${chapter} hides pane ${before}`);
  }
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
});

test('no JS: both routes keep their content', async () => {
  await navigate('/', { scripts: false });
  assert.equal(await evaluate('document.querySelector("h1").textContent'), 'Build collaborative agent experiences.');
  assert.equal(await evaluate('document.querySelectorAll("main > section").length'), 2);
  await navigate('/design-system/', { scripts: false });
  assert.equal(await evaluate('document.querySelector("h1").textContent'), 'One kit. Both themes.');
  assert.equal(await evaluate('document.querySelectorAll(".ds-showcase").length'), 5);
});

test('built HTML: local assets exist and no undefined/NaN leaked', { skip: DIST_ONLY }, () => {
  for (const file of ['index.html', 'design-system/index.html']) {
    const html = fs.readFileSync(path.join(DIST, file), 'utf8');
    assert.ok(!html.includes('undefined'), `${file}: undefined in HTML`);
    assert.ok(!html.includes('NaN'), `${file}: NaN in HTML`);
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"/, `${file}: no stylesheet in head`);
    for (const [, url] of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) {
      assert.ok(fs.existsSync(path.join(DIST, url)), `${file}: missing ${url}`);
    }
  }
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /https:\/\/agentmerlin\.ai\//);
  assert.match(sitemap, /https:\/\/agentmerlin\.ai\/design-system\//);
});

test('component CSS: every scoped class in the gallery has a rule', { skip: DIST_ONLY }, () => {
  const html = fs.readFileSync(path.join(DIST, 'design-system/index.html'), 'utf8');
  const css = fs
    .readdirSync(path.join(DIST, 'assets'))
    .filter((name) => name.endsWith('.css'))
    .map((name) => fs.readFileSync(path.join(DIST, 'assets', name), 'utf8'))
    .join('\n');
  const classes = new Set([...html.matchAll(/(_[a-z]+_[a-z0-9]+_\d+)/g)].map(([, name]) => name));
  assert.ok(classes.size > 20, `expected component classes, got ${classes.size}`);
  for (const name of classes) assert.ok(css.includes(name), `missing CSS for .${name}`);
});

/* The ending is one panel by contract: the deck snaps on panel tops, so a
   taller ending would hide its own caveat. The working copy, the claim, the
   three doors and the stage note are the last things the reader sees, so they
   are the last things to fit — at every guarded size. */
test('ending: one panel holds the shape, the claim and the doors', async () => {
  await navigate('/');
  await waitFor(() => evaluate('document.querySelectorAll(".pager-row").length === 8'), 5000, 'contents');
  await evaluate(`document.querySelector('#tailor').scrollIntoView({ behavior: 'instant', block: 'start' })`);
  await waitFor(() => evaluate(`document.querySelector('.pager-now').textContent === 'Tailor'`), 4000,
    'the deck ends on Tailor');

  const readEnding = () => evaluate(`(() => {
    const panel = document.querySelector('#tailor');
    const body = panel.querySelector('.wrap');
    const note = panel.querySelector('.end-note');
    const bounds = panel.getBoundingClientRect();
    const noteBox = note.getBoundingClientRect();
    const block = panel.querySelector('.eyebrow').getBoundingClientRect().top;
    const foot = panel.querySelector('.end-grid').getBoundingClientRect().bottom;
    const style = getComputedStyle(panel);
    return {
      overflow: panel.scrollHeight - panel.clientHeight,
      bodyOverflow: body.scrollHeight - body.clientHeight,
      startsInside: body.getBoundingClientRect().top >= bounds.top - 0.5,
      noteInside: noteBox.bottom <= bounds.bottom + 0.5 && noteBox.right <= bounds.right + 0.5 && noteBox.left >= bounds.left - 0.5,
      /* The ending centres as one block: the free space is what keeps the
         headline and the doors on the same screen without touching an edge. */
      slack: Math.round(bounds.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - (foot - block)),
      rows: panel.querySelectorAll('.repo-row').length,
      labels: [...panel.querySelectorAll('a.btn')].map((a) => a.textContent.trim()),
      hrefs: [...panel.querySelectorAll('a.btn')].map((a) => a.getAttribute('href')),
      icons: [...panel.querySelectorAll('a.btn')].map((a) => {
        const use = [...a.querySelectorAll('use')].find((node) => getComputedStyle(node).display !== 'none');
        const box = use?.getBBox();
        return box ? Math.round(box.width * box.height) : 0;
      }),
      opens: [...panel.querySelectorAll('a[target="_blank"]')].every((a) => a.rel.includes('noopener')),
      text: panel.textContent
    };
  })()`);

  const ending = await readEnding();
  assert.equal(ending.rows, 7, 'the working copy keeps its seven files');
  assert.match(ending.text, /Yours to break\./, 'the ending names the handover');
  assert.match(ending.text, /pre-alpha and under active development/, 'the stage sets the expectation');
  assert.match(ending.text, /come over to GitHub and lend a hand/, 'the ending asks for help');
  assert.deepEqual(ending.labels, ['Star on GitHub', 'Fork it'], 'two doors, one per action');
  assert.equal(new Set(ending.hrefs).size, 2, 'each door leads somewhere different');
  assert.match(ending.hrefs[0], /agentmerlinai\/merlin$/, 'star opens the project');
  assert.match(ending.hrefs[1], /agentmerlinai\/merlin\/fork$/, 'fork opens the fork flow');
  assert.ok(ending.icons.every((area) => area > 0), 'both doors paint their mark');
  assert.ok(ending.opens, 'every door opens safely');
  assert.match(ending.text, /Merlin is a research project by the GoatDB team/, 'the association is prose');
  /* The one outbound link outside the doors: the team's own site. */
  const team = await evaluate(`(() => {
    const a = document.querySelector('#tailor .end-link');
    return a && { href: a.getAttribute('href'), rel: a.getAttribute('rel'), text: a.textContent };
  })()`);
  assert.equal(team?.href, 'https://goatdb.dev', 'the team link opens the GoatDB site');
  assert.ok(team?.rel.includes('noopener'), 'the team link opens safely');
  assert.match(team?.text ?? '', /GoatDB/, 'the link names the team');

  /* A fit with no room left is not a fit: a font or a copy tweak would push
     the caveat off the panel. Every guarded size keeps a visible margin. */
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 680], [768, 1024], [390, 844]]) {
    await setViewport(width, height);
    await evaluate(`document.querySelector('#tailor').scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await delay(300);
    const at = await readEnding();
    assert.equal(at.overflow, 0, `${width}x${height}: the ending never grows its panel`);
    assert.equal(at.bodyOverflow, 0, `${width}x${height}: the ending never scrolls`);
    assert.ok(at.startsInside, `${width}x${height}: the ending starts inside its panel`);
    assert.ok(at.noteInside, `${width}x${height}: the note stays inside the panel`);
    assert.ok(at.slack >= 16, `${width}x${height}: the ending keeps room to breathe (${at.slack}px)`);
  }
  await setViewport(1280, 900);
});

/* The gutter is a working copy, so it must read as one: empty while the deck
   is elsewhere, then one row at a time — the line draws, the letter is stamped
   after it, the line clears — and the letters stay. Sampled during the fill,
   because the order is the contract and a screenshot cannot state it. */
const readGutter = () => evaluate(`(() => {
  const scale = (value) => {
    const m = /matrix\\(([-0-9.]+)/.exec(value);
    return m ? Number(m[1]) : 1;
  };
  const rows = [...document.querySelectorAll('#tailor .repo-row')];
  return {
    panel: document.documentElement.dataset.panel ?? null,
    marks: rows.map((row) => Number(getComputedStyle(row.querySelector('.repo-mark')).opacity)),
    rules: rows.map((row) => {
      const line = getComputedStyle(row.querySelector('.note'), '::after');
      return { opacity: Number(line.opacity), drawn: scale(line.transform) };
    })
  };
})()`);

const lineComplete = (rule) => rule.opacity > 0.99 && rule.drawn > 0.99;
const settled = (at) => at.marks.every((mark) => mark > 0.99) && at.rules.every((rule) => rule.opacity === 0);

test('ending: the gutter fills only while the reader rests on the ending', async () => {
  await setViewport(1280, 900);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await navigate('/');
  await waitFor(() => evaluate('document.querySelectorAll(".repo-row").length === 7'), 5000, 'the working copy');

  /* The deck opens on the intro: the gutter must not have begun. */
  const away = await readGutter();
  assert.notEqual(away.panel, 'tailor', 'the deck does not rest on the ending yet');
  assert.deepEqual(away.marks, [0, 0, 0, 0, 0, 0, 0], 'no status marks before the reader arrives');
  assert.ok(away.rules.every((rule) => rule.opacity === 0), 'no changed lines before the reader arrives');

  await evaluate(`document.querySelector('#tailor').scrollIntoView({ behavior: 'instant', block: 'start' })`);
  await waitFor(() => evaluate(`document.documentElement.dataset.panel === 'tailor'`), 5000,
    'the deck rests on the ending');

  const samples = [];
  const deadline = Date.now() + 12000;
  let at = await readGutter();
  while (Date.now() < deadline && !settled(at)) {
    samples.push(at);
    await delay(120);
    at = await readGutter();
  }
  assert.ok(settled(at), 'the tree fills without the reader scrolling');
  samples.push(at);

  /* The order is the contract, and a sample cannot be re-taken: the index of
     the first sample where a row's line reaches full width must not come after
     the index where its letter appears. */
  const firstStamp = [];
  const firstComplete = [];
  samples.forEach((sample, index) => sample.marks.forEach((mark, row) => {
    if (mark > 0 && firstStamp[row] === undefined) firstStamp[row] = index;
    if (lineComplete(sample.rules[row]) && firstComplete[row] === undefined) firstComplete[row] = index;
  }));
  firstStamp.forEach((stamp, row) => {
    assert.ok(stamp !== undefined, `row ${row}: the cascade reaches every row`);
    assert.ok(firstComplete[row] !== undefined, `row ${row}: the line is drawn, not skipped`);
    assert.ok(stamp >= firstComplete[row], `row ${row}: the letter waits for the full line`);
  });
  /* One row at a time, in list order: the first is stamped while the last waits. */
  assert.ok(samples.some((sample) => sample.marks[0] > 0.99 && sample.marks[6] === 0),
    'the cascade fills the tree one row at a time');

  /* The conclusion holds: the letters stay, the edits are gone. */
  await delay(1400);
  const held = await readGutter();
  assert.deepEqual(held.marks, [1, 1, 1, 1, 1, 1, 1], 'the working copy stays marked');
  assert.ok(held.rules.every((rule) => rule.opacity === 0), 'the changed lines clear');
});

/* A still page reads the conclusion: the working copy with its status marks,
   and no edit left in flight. One pose, whether motion is off or the deck is
   not there to start the cascade. */
test('ending: a still page shows the finished working copy', async () => {
  await setViewport(1280, 900);
  await navigate('/');
  await waitFor(() => evaluate('document.querySelectorAll(".repo-row").length === 7'), 5000, 'the working copy');
  const at = await readGutter();
  assert.ok(at.panel !== 'tailor', 'the deck still rests on the intro');
  assert.deepEqual(at.marks, [1, 1, 1, 1, 1, 1, 1], 'every status mark is in place');
  assert.ok(at.rules.every((rule) => rule.opacity === 0), 'no edit is left in flight');
});
