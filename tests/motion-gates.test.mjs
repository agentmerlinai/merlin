/* Static gates for the motion layers. Each gate names the bug it prevents:
   one capability's fallback disables another capability's animations, a scene
   clock that no browser can start, a scrub rule that drifts out of its gate,
   or a copy-pasted rule with two owners. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { css, parseRules } from './support/css-source.mjs';

const rules = parseRules(css);
const at = (rule, prefix) => rule.at.some((block) => block.startsWith(prefix));
const SCRUB_GATE = '@supports (animation-timeline: view())';
const TIER_C_GATE = '@supports not (animation-timeline: view())';
const REDUCED = '@media (prefers-reduced-motion: reduce)';

/* A scene clock needs a playhead. The trigger layer is Chrome-only, so the
   absent trigger must never be answered by cancelling animations: Safari gets a
   JavaScript playhead on the same keyframes instead (`clocks.js`). */
test('motion: no fallback cancels another layer', () => {
  assert.doesNotMatch(css, /@supports\s+not\s*\(\s*animation-trigger/,
    'the missing trigger layer is the JS clock, not a second design');
  const cancels = rules.filter((rule) => /(?:^|;)\s*animation\s*:\s*none\b/.test(rule.body));
  const allowed = (rule) => at(rule, TIER_C_GATE) || at(rule, REDUCED);
  assert.deepEqual(cancels.filter((rule) => !allowed(rule)).map((rule) => rule.selector), [],
    'animation:none is the Tier C and reduced-motion answer only');
  assert.ok(cancels.length > 0, 'the static tiers still exist');
});

/* A scrub rule outside its gate is a rule one browser reads and another drops:
   the page then rests on a frame nobody authored. A rule that also owns a clock
   entry may not be gated (the JS playhead would lose its keyframes), so the
   exception is explicit: a mixed list is legal, a pure scrub rule is not. */
test('motion: scrubbed declarations live in the scrub gate', () => {
  const scrub = rules.filter((rule) => /animation-timeline:[^;]*(--beat|--arrive|view\(|scroll\()/.test(rule.body));
  assert.ok(scrub.length > 0, 'the story is scroll-driven');
  const mixed = (rule) => /animation-timeline:[^;]*auto/.test(rule.body);
  const outside = scrub.filter((rule) => !at(rule, SCRUB_GATE) && !at(rule, REDUCED) && !mixed(rule));
  assert.deepEqual(outside.map((rule) => rule.selector), [],
    'these scrub outside the gate; reduced motion may re-point a pane in its own block');
  assert.ok(scrub.some(mixed), 'the mixed clock+gate rules still exist');
});

/* The clock rules are the exception the other way: they must not be gated, or
   the browser that needs the JS playhead would have no animations to drive. A
   rule that also scrubs is the one legal mix (it needs the gate for its scrub
   entry, and its clock entry stays time-driven). */
test('motion: the clock is ungated so the JS playhead has keyframes', () => {
  const clocks = rules.filter((rule) => /animation-duration:\s*calc\(var\(--story-scene-/.test(rule.body));
  assert.ok(clocks.length > 0, 'scenes keep their time-driven slices');
  const scrubs = (rule) => /animation-timeline:[^;]*(--beat|--arrive|view\(|scroll\()/.test(rule.body);
  const gated = clocks.filter((rule) => (at(rule, SCRUB_GATE) || at(rule, TIER_C_GATE)) && !scrubs(rule));
  assert.deepEqual(gated.map((rule) => rule.selector), [],
    'a scene slice inside a gate would vanish for the browser the JS clock serves');
  assert.ok(clocks.some((rule) => !at(rule, SCRUB_GATE)), 'the clock layer is not gated');
});

/* Two blocks with one selector and one body are two owners of one fact: the
   second can only drift. */
test('motion: one owner per rule block', () => {
  const seen = new Set();
  const duplicates = [];
  for (const rule of rules) {
    const key = [rule.at.join('|'), rule.selector, rule.body.replace(/\s+/g, '')].join('\u0000');
    if (seen.has(key)) duplicates.push(rule.selector);
    seen.add(key);
  }
  assert.deepEqual(duplicates, [], 'duplicate rule blocks');
});

test('motion: the JS playhead exists and owns no scroll', () => {
  const clocks = fs.readFileSync(new URL('../apps/web/src/islands/hero-story/clocks.js', import.meta.url), 'utf8');
  const hydrate = fs.readFileSync(new URL('../apps/web/src/islands/hydrate.ts', import.meta.url), 'utf8');
  for (const api of ['IntersectionObserver', 'getAnimations(', 'playState', '.play()']) {
    assert.ok(clocks.includes(api), `clocks.js must drive the clock with ${api}`);
  }
  assert.match(hydrate, /initClocks\(root\)/, 'the hero island wires the playhead');
  assert.ok(hydrate.indexOf('initClocks(root)') < hydrate.indexOf('initHeroStory(root)'),
    'the clock parks the scenes before the seam measures them');
  for (const write of ['scrollTo(', 'scrollBy(', 'scrollIntoView(', 'scrollTop', 'requestAnimationFrame']) {
    assert.ok(!clocks.includes(write), `the playhead must not own the scroll: ${write}`);
  }
});

/* The ending's gutter is the artifact's whole argument: a changed line is drawn,
   then the status letter is stamped after it, and both stay. The order is a
   CSS contract, so it is read from the keyframe stops, not from a screenshot:
   a stop order that flips makes the tree read backwards — letters that are
   already there, edits that arrive later — which is the bug this gate keeps
   out. */
function keyframeStops(name) {
  return rules
    .filter((rule) => rule.at.includes(`@keyframes ${name}`))
    .map((rule) => ({
      at: rule.selector.split(',').map((part) => parseFloat(part)),
      body: rule.body.replace(/\s+/g, ' ').trim(),
    }));
}

/* The first stop that states `value`, which is where a track reaches it. */
function firstStop(stops, value) {
  const hit = stops.find((stop) => stop.body.includes(value));
  return hit ? Math.min(...hit.at) : null;
}

test('ending: the status letter arrives after its line', () => {
  const line = keyframeStops('tailor-rule');
  const mark = keyframeStops('tailor-mark');
  const drawn = firstStop(line, 'scaleX(1)');
  const stamped = firstStop(mark, 'opacity: 1');
  assert.ok(drawn !== null && stamped !== null, 'both tracks exist');
  assert.ok(stamped > drawn, `the letter waits for the full line (${stamped}% vs ${drawn}%)`);

  /* The status is what stays; the edited line is the gesture and clears. A loop
     that kept either one would leave the reader with a stale tree. */
  const final = (track) => track.filter((stop) => stop.at.includes(100)).at(-1);
  assert.equal(final(mark)?.body, 'opacity: 1;', 'the letter stays');
  assert.equal(final(line)?.body, 'opacity: 0; transform: scaleX(1);', 'the line clears');
});

/* One row is one step: the stagger and the row's own window must read the same
   number, or rows drift apart and a letter names an edit that has already
   cleared. */
test('ending: one step is one row', () => {
  for (const name of ['tailor-mark', 'tailor-rule']) {
    const track = rules.find((rule) => new RegExp(`animation:\\s*${name}\\b`).test(rule.body));
    assert.ok(track, `${name} has an owner`);
    assert.match(track.body, new RegExp(`animation: ${name} var\\(--gutter-step\\)`),
      `${name} runs for one step`);
    assert.match(track.body, /animation-delay: calc\(var\(--i, 0\) \* var\(--gutter-step\)\)/,
      `${name} starts one step per index`);
    assert.doesNotMatch(track.body, /infinite/, `${name} is a cascade, not a loop`);
  }
});

/* Without view timelines the swap has nothing to run on, so the stage must show
   one surface: a later pane would be a surface the reader can never reach. */
test('motion: the static tier keeps one surface', () => {
  const tierC = rules.filter((rule) => at(rule, TIER_C_GATE));
  assert.ok(tierC.some((rule) => /\.story-pane:not\(\[data-pane="1"\]\)/.test(rule.selector) &&
    /display:\s*none/.test(rule.body)), 'later panes are not rendered without a timeline');
});
