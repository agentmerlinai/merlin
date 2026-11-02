/* Deck end contract: the last panel is the document's last snap point.

   The page sizes every panel with 100svh, but Safari's scrollport grows to the
   large viewport once the bottom bar collapses. The last panel's ideal snap
   position then lies past the maximum scroll offset, and the snap engine clamps
   the rest position (CSS Scroll Snap 1, "Unreachable Snap Positions"). The
   ending therefore owns the live viewport height: its top must be able to reach
   the scrollport top in both chrome states.

   Headless engines have no retractable chrome, so svh always equals the
   viewport and the defect is invisible. The test forces the two heights apart
   by shrinking the authored panel, then asserts the rendered result: the last
   snap point is reachable, the ending fills the scrollport, its content fits,
   and nothing follows it.

   Run against the built artifact: `npm run build && npm run test:deck`. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { webkit } from 'playwright';
import { startServer } from '../scripts/serve-dist.mjs';

const PHONES = [
  { width: 393, height: 852 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];

/* A representative chrome delta. The value is arbitrary: any positive gap
   exercises the same edge, and the assertion compares the result with the
   live viewport, never with this number. */
const CHROME = 120;

let server, base, browser;

before(async () => {
  server = await startServer();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await webkit.launch();
});

after(async () => {
  await browser?.close();
  server?.closeAllConnections?.();
  if (server) await new Promise((resolve) => server.close(resolve));
});

/* The panel is the authored (small) height; the viewport is the live one. */
const emulate = `html { --panel: calc(100dvh - ${CHROME}px); }`;

const read = (page) => page.evaluate(() => {
  const ending = document.querySelector('.section.close');
  const box = ending.getBoundingClientRect();
  return {
    vh: innerHeight,
    docH: document.documentElement.scrollHeight,
    max: Math.round(document.documentElement.scrollHeight - innerHeight),
    top: Math.round(box.top + scrollY),
    height: Math.round(box.height),
    overflow: ending.scrollHeight - ending.clientHeight,
    /* Rests resolve exactly as the page's points do: a point's top minus its
       snap margin. One source for both the deck and this assertion. */
    rests: [...document.querySelectorAll('.snap-point')].map((point) => Math.round(
      point.getBoundingClientRect().top + scrollY -
      (parseFloat(getComputedStyle(point).scrollMarginTop) || 0)
    )),
  };
});

async function open(viewport, style) {
  const page = await browser.newPage({ viewport });
  await page.goto(base, { waitUntil: 'load' });
  if (style) await page.addStyleTag({ content: style });
  /* The page smooth-scrolls by default; the contract is the rest geometry, so
     the test asks for instant travel and then lets the snap settle. */
  await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const state = await read(page);
  /* Ask for the ending's own rest and read the rendered head, the same check a
     reader makes when the panel arrives. */
  const head = await page.evaluate((top) => {
    window.scrollTo({ top, behavior: 'instant' });
    return new Promise((resolve) => setTimeout(() => {
      resolve(Math.round(document.querySelector('.section.close').getBoundingClientRect().top));
    }, 250));
  }, state.top);
  await page.close();
  return { ...state, head };
}

test('deck: the ending can rest on the top edge while the viewport outgrows the panel', async () => {
  for (const viewport of PHONES) {
    const state = await open(viewport, emulate);
    const at = `${viewport.width}x${viewport.height}`;
    assert.ok(Math.abs(state.top - state.max) <= 1,
      `${at}: the last snap point is reachable (top ${state.top}, max ${state.max})`);
    assert.ok(Math.abs(state.height - state.vh) <= 1,
      `${at}: the ending fills the live viewport (${state.height} of ${state.vh})`);
    assert.ok(Math.abs(state.head) <= 1,
      `${at}: the ending head rests on the top edge (${state.head})`);
    assert.ok(state.overflow <= 1,
      `${at}: the ending content fits its panel (${state.overflow}px over)`);
    assert.ok(Math.abs(state.top + state.height - state.docH) <= 1,
      `${at}: the ending is the document end`);
    assert.equal(state.rests.at(-1), state.top, `${at}: the last point is the ending top`);
    assert.ok(state.rests.every((rest) => rest <= state.max + 1),
      `${at}: no rest lies past the scroll range (${state.rests.join(', ')} of ${state.max})`);
  }
});

test('deck: a viewport that matches the panel is unchanged', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const state = await open(viewport);
    const at = `${viewport.width}x${viewport.height}`;
    assert.ok(Math.abs(state.height - state.vh) <= 1,
      `${at}: the ending is one page (${state.height} of ${state.vh})`);
    assert.ok(Math.abs(state.top - state.max) <= 1,
      `${at}: the ending top is the last rest (${state.top} of ${state.max})`);
    assert.ok(Math.abs(state.head) <= 1,
      `${at}: the ending head lands on the top edge (${state.head})`);
    assert.ok(state.overflow <= 1, `${at}: the ending content fits its panel`);
  }
});
