import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { css } from './support/css-source.mjs';

test('css: no raw hex colours in the landing stylesheet', () => {
  const hex = [...css.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([value]) => value);
  assert.deepEqual(hex, [], `raw hex colours: ${hex.join(', ')}`);
});

test('story: the chapter entrance never fades', () => {
  /* A slide, not a fade: the incoming text must keep full contrast from its
     first frame. Only the outgoing chapter may fade, and only over the short
     exit window that ends before the station line. */
  const start = css.indexOf('/* One chapter per face.');
  const end = css.indexOf('/* The stage:');
  assert.ok(start !== -1 && end > start, 'the copy block is locatable');
  const block = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
  const seen = block.match(/@keyframes story-copy-seen\s*\{([^}]*)\}/);
  assert.ok(seen && !/opacity/.test(seen[1]), 'the entrance animates visibility only');
  const out = block.match(/@keyframes story-copy-out\s*\{([^}]*)\}/);
  assert.ok(out && /opacity/.test(out[1]), 'the exit owns the only opacity frame');
  assert.ok(!block.includes('story-copy-gone'), 'the old long fade is gone');
  for (const name of ['story-copy-seen', 'story-copy-out', 'story-copy-hide']) {
    assert.ok(block.includes(`@keyframes ${name}`), `missing ${name}`);
  }
});

test('story: the plan clears as one field, not as a cover', () => {
  /* The base is already painted under the plan, so the exit is a crossfade of a
     single field. Nothing in the plan translates, so every seam box stays put. */
  assert.doesNotMatch(css, /story-shutter/, 'the shutter is gone');
  assert.doesNotMatch(css, /\.plan-shutter/, 'the shutter overlay is gone');

  const pane = css.match(/\.story-pane\[data-pane="5"\]\s*\{([^}]*)\}/);
  assert.ok(pane, 'pane 5 is locatable');
  assert.match(pane[1], /story-seam-in/, 'the pane still arrives');
  assert.doesNotMatch(pane[1], /translate|scale/, 'the pane does not move');
  assert.match(css, /\.story-pane\[data-pane="5"\] \{ background: none/,
    'the pane hands its paint to the field');

  const field = css.match(/\n\.plan-field\s*\{([^}]*)\}/);
  assert.ok(field, 'the field is locatable');
  assert.match(field[1], /position:\s*absolute/, 'the field is frame-level');
  assert.match(field[1], /inset:\s*0/, 'the field covers the frame');
  assert.match(field[1], /--panel-fill/, 'the field carries the panel paint');

  const out = css.match(/@keyframes story-plan-out\s*\{([\s\S]*?)\n\}/);
  assert.ok(out, 'the crossfade keyframe is locatable');
  assert.match(out[1], /opacity:\s*0/, 'the field clears');
  assert.match(out[1], /visibility:\s*hidden/, 'the field is removed, not left invisible');
  assert.doesNotMatch(out[1], /translate/, 'the exit never moves the plan, only folds it');
  assert.doesNotMatch(out[1], /scale/, 'the fade owns paint, not shape');

  const fold = css.match(/@keyframes story-plan-fold\s*\{([\s\S]*?)\n\}/);
  assert.ok(fold, 'the fold keyframe is locatable');
  assert.match(fold[1], /scale:\s*1 var\(--plan-collapse\)/,
    'the plan collapses on its y axis only');
  assert.doesNotMatch(fold[1], /opacity|visibility|translate/,
    'the fold owns shape, not paint');
  assert.match(field[1], /transform-origin:\s*50% 0/,
    'the fold hangs from the header');
  assert.match(css, /--plan-collapse: 0\.75;/,
    'the panel loses a quarter of its height: a collapse, not a nudge');
  assert.match(css, /--plan-ease: cubic-bezier\(0\.4, 0, 1, 1\)/,
    'an ease-in curve: a scrub reads ease-in down, ease-out up');
  /* The seam proxies leave before the fold, so the measurement poses must
     read the plan at its rest scale or the recorded boxes shrink. */
  assert.match(css,
    /:is\(\[data-measure="5"\], \[data-measure-from="5"\]\) \.plan-field \{\s*scale: 1 1 !important/,
    'the fold is neutralised for seam measurement');

  assert.match(css, /--seam5-start: 50%; --seam5-end: 78%;/,
    'the seam-5 window has one owner');
  assert.match(css, /--plan-fold-start: 58%; --plan-fold-end: 78%;/,
    'the fold owns the whole second half of the seam');
  assert.match(css, /--plan-fade-start: 70%; --plan-fade-end: 78%;/,
    'the fade starts late: the first half of the collapse is read on a drawn surface');
  const exit = css.match(/\.story-pane\[data-pane="5"\] \.plan-field\s*\{([^}]*)\}/);
  assert.ok(exit, 'the exit rule is locatable');
  assert.match(exit[1], /story-plan-fold/, 'the field folds first');
  assert.match(exit[1], /story-plan-out/, 'then it clears');
  assert.match(exit[1], /--beat-5/, 'both windows follow the seam beat');
  assert.match(exit[1], /forwards/, 'the settled frames hold');
  assert.match(exit[1], /--plan-fold-start/, 'the fold reads its own window');
  assert.match(exit[1], /--plan-fade-start/, 'the fade reads its own window');
  /* The pane gives every child a scene trigger. On the field that would take
     the timeline's place, so the fill would stop holding past the range and
     the plan would paint over the base again. Every such exception lives in the
     one documented list, never inline. */
  assert.match(css, /\.story-pane\[data-pane\] :is\([\s\S]*?\.plan-field[\s\S]*?\) \{ animation-trigger: none; \}/,
    'the exit stays timeline-driven');

  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /story-pane\[data-pane="5"\][\s\S]*?story-seam-out/,
    'reduced motion fades the pane, since the field cannot animate');
});

test('story: the deployment is the before, the equal peers are the after', () => {
  /* The chapter is a contrast the reader can count: six containers on three
     VMs with thin clients, then four equal peers. Every peer holds the same
     signed five blocks; the server peer also holds the root keys, while every
     peer verifies signed writes and authorization. The clients are icons and
     never move; only the backend changes, and it changes by moving its own
     objects — no pose is scaled or faded. */
  const tsx = fs.readFileSync('apps/web/src/pages/home/sections/StoryPane6.tsx', 'utf8');
  const beats = fs.readFileSync('apps/web/src/pages/home/sections/StoryBeats.tsx', 'utf8');
  const count = (re) => (tsx.match(re) || []).length;

  /* The cloud-first backend is the deployment the reader would otherwise run. */
  for (const part of ['App server', 'Auth service', 'Postgres', 'Cache', 'Audit log', 'Ops pipelines']) {
    assert.ok(tsx.includes(part), `the deployment names ${part}`);
  }
  for (const host of ['VM 1 · app', 'VM 2 · data', 'VM 3 · ops']) {
    assert.ok(tsx.includes(host), `the deployment names ${host}`);
  }
  assert.match(tsx, /1 volume/, 'the stateful DB carries its volume');
  assert.match(tsx, /base-seat[^>]*data-arrive="5"/,
    'the record lands on the constant server seat');
  assert.doesNotMatch(tsx, /no store|no repository state/, 'the server is not an empty relay');

  /* The clients are icons and labels in a fixed band. They are not cards: a
     full client tile would be a second peer drawing, and the figure has one
     server frame. */
  for (const client of ['Laptop', 'Tablet', 'Phone']) {
    assert.ok(tsx.includes(client), `the fixed client band carries ${client}`);
  }
  assert.match(tsx, /CLIENTS\.map\(\(client\) => <Client/, 'the three clients come from one fixed list');
  assert.match(tsx, /base-client-icon/, 'a client is an icon');
  assert.match(tsx, /base-client-name/, 'a client is an icon and a label');
  assert.doesNotMatch(tsx, /className="base-client[^"]*surface-(plate|well|panel)/,
    'a client is not a card');

  /* The local-first backend is one equal peer with the same signed replica. */
  assert.match(tsx, /server peer/, 'the server is a peer');
  assert.match(tsx, /5 blocks/, 'the replica names the five blocks');
  assert.match(tsx, /signed replica/, 'every peer carries a signed replica');
  assert.match(tsx, /root keys · auth/, 'the server peer holds the keys and auth');
  assert.equal(count(/<Peer/g), 1, 'one server peer');
  assert.equal(count(/base-part surface-plate/g), 1, 'the six containers share one object');
  assert.match(tsx, /PARTS\.map\(\(part\) => <Part/, 'the six containers come from one list');
  assert.match(tsx, /base-peer[^"]*surface-plate/, 'the server peer is a plate');
  assert.match(tsx, /base-replica surface-well/, 'the replica is a well inside the peer');
  assert.match(tsx, /base-replica-bars/, 'the replica has five block slots');
  assert.equal((tsx.match(/\[0, 1, 2, 3, 4\]/g) || []).length, 1, 'the five slots are one row');
  assert.match(tsx, /base-link--stem/, 'the server auth link is drawn');
  assert.match(tsx, /base-link--bus/, 'the auth bus reaches every client');
  assert.match(tsx, /base-link--drop/, 'each client has an auth drop');
  assert.match(tsx, /base-link-tip/, 'the request arrow has its tip');
  assert.match(tsx, /base-link--mesh/, 'the client data mesh is drawn');

  /* The old log, ledger, dock and device screens are gone. */
  assert.doesNotMatch(tsx, /base-(log|block|frame|stack|spine|dock|plate|tether|sled|device|node)/,
    'the log, ledger, dock and device screens are gone');
  assert.doesNotMatch(tsx, /BLOCK_OFFSET/, 'the row offset table is gone');

  /* GoatDB is a credit and the correction, not the stage. */
  assert.equal(count(/goatdb-mark/g), 0, 'the stage carries no engine mark');
  assert.equal((beats.match(/goatdb-mark/g) || []).length, 1, 'the story credits the engine once');
  assert.equal((beats.match(/Powered by GoatDB/g) || []).length, 1, 'the block names the engine');
  assert.match(beats, /Your app is the database/, 'the copy names the embedded model');
  assert.match(beats, /One binary serves the UI/, 'the copy names the deployable');
  assert.match(beats, /holds the keys, and relays signed commits/, 'the copy names the server role');
  assert.match(beats, /Every device holds a full replica/, 'the copy names the replica');
  assert.match(beats, /a dead server refills from an authorized copy/, 'the copy names recovery');
  assert.match(beats, /Concurrent edits merge field by field/, 'the copy names merge');
  assert.match(beats, /No database server, cache, or API tier to run/, 'the copy names the removed stack');
  assert.doesNotMatch(beats, /enforces authentication and authorization across the network/,
    'the server is not the only auth enforcer');
  assert.doesNotMatch(beats, /Nothing crosses the perimeter/, 'the perimeter claim is scoped');
  assert.doesNotMatch(beats, /relay that keeps no repository state|no store/, 'the no-store claim is gone');
  assert.doesNotMatch(beats, /Merlin does not pack the six|GoatDB replaces them/, 'the defensive correction is gone');
  assert.doesNotMatch(beats, /packs all six/, 'the pack claim is gone');

  /* The base paints no app card: the card left with the plan. */
  const stage = fs.readFileSync('apps/web/src/pages/home/sections/StoryStage.tsx', 'utf8');
  assert.doesNotMatch(stage, /surface-panel/, 'the viewport does not wear the card recipe');
  assert.match(stage, /className="story-card"/, 'the card is its own object');
  const basePane = [...css.matchAll(/\.story-pane\[data-pane="6"\] \{([^}]*)\}/g)]
    .map((m) => m[1]).find((body) => body.includes('background'));
  assert.ok(basePane, 'the base pane is locatable');
  /* The base lays the page itself. A coat in the page colour is not the page:
     it would hide the page's grid behind a gridless rectangle. */
  assert.match(basePane, /background:\s*(?:none|transparent)/,
    'the base lays the page, not a coat in its colour');
  assert.match(basePane, /padding:\s*0/, 'the base owns its own mat');

  /* The perimeter is the only enclosure and it wears the panel role. */
  assert.match(tsx, /base-perimeter surface-panel/, 'the perimeter names the panel role');
  const zone = css.match(/\.base-perimeter \{([^}]*)\}/);
  assert.ok(zone, 'the zone is locatable');
  assert.doesNotMatch(zone[1], /\n\s*border:/, 'the border is the recipe\'s');
  assert.doesNotMatch(zone[1], /border-radius/, 'the radius is the recipe\'s');
  assert.doesNotMatch(zone[1], /box-shadow/, 'the shadow is the recipe\'s');
  assert.doesNotMatch(zone[1], /background/, 'the fill is the recipe\'s');
  assert.match(zone[1], /--panel-border/, 'the boundary is a deliberate role override');
  assert.match(zone[1], /padding:\s*var\(--base-zone-y\) var\(--base-zone-x\) 1px;/, 'the footer text has equal vertical margins');
  assert.match(tsx, /base-well base-well--\w+ surface-well/, 'a host is a well inside the panel');
  assert.match(tsx, /base-part surface-plate/, 'a container is a plate inside the well');
  assert.match(tsx, /base-egress/, 'the perimeter has a sealed port');
  assert.match(tsx, /Air gap/, 'the break is named');
  assert.match(tsx, /no egress/, 'the break states the fact');
  /* The mark is drawn inside the fence: a mark that hangs below it lands on
     the caption's first line. */
  const egress = css.match(/\n\.base-egress \{([^}]*)\}/);
  assert.ok(egress, 'the sealed port is locatable');
  assert.match(egress[1], /bottom:/, 'the mark is docked to the footer rule');
  assert.match(egress[1], /bottom:\s*0/, 'the mark follows the panel padding');
  assert.match(egress[1], /right:\s*var\(--base-egress-inset\)/, 'the port clears the fence corner');
  assert.match(egress[1], /height:\s*var\(--base-footer\)/, 'the mark shares the footer row');
  assert.match(css, /\.base-egress-label \{[^}]*line-height:\s*var\(--base-footer\)/, 'the mark shares the footer baseline');
  assert.match(css, /\.base-egress > \.icon \{[^}]*width:\s*14px[^}]*rotate:\s*45deg/, 'the plug faces the port');
  assert.doesNotMatch(egress[1], /top:\s*100%/, 'the mark stays inside the frame');
  assert.match(tsx, /Enterprise perimeter/i, 'the perimeter names its zone');
  assert.match(tsx, /on-prem/i, 'the constant lives on the boundary');

  /* The scene is time-driven and the client band is the fixed reference. */
  assert.match(css, /--story-scene-6:/, 'the surface owns one scene clock');
  assert.match(css, /story-beat\[data-story-beat="6"\] \{ timeline-trigger: --scene-6a/,
    'the beat declares the scene timeline');

  /* One number owns the change of pose. Every object reads it for its box,
     its paint and its line, so the figure morphs instead of swapping poses. */
  const property = css.match(/@property --pose \{([^}]*)\}/);
  assert.ok(property, 'the pose is a registered number');
  assert.match(property[1], /syntax: "<number>"/, 'the pose interpolates');
  assert.match(property[1], /inherits: true/, 'the pose reaches every object');
  const perimeter = css.match(/\.story-pane\[data-pane="6"\] \.base-perimeter \{([\s\S]*?)\n  \}/);
  assert.ok(perimeter, 'the scene is locatable');
  assert.match(perimeter[1], /story-base-pose/, 'the scene drives the pose');
  assert.match(perimeter[1], /--scene-6a/, 'the pose runs on the scene clock');
  assert.match(zone[1], /--pose: 1/, 'the fallback is the local-first pose');
  const part = css.match(/\.base-part \{([\s\S]*?)\n\}/);
  assert.ok(part, 'a container is locatable');
  assert.match(part[1], /--part-shape:/, 'the container shape has its own window');
  assert.match(part[1], /--part-move:/, 'the container travel has its own window');
  assert.match(part[1], /width: calc\([^;]*var\(--part-shape\)/, 'the container width is posed');
  assert.match(part[1], /height: calc\([^;]*var\(--part-shape\)/, 'the container height is posed');
  assert.match(part[1], /translate: calc\([^;]*var\(--part-move\)/, 'the container travels');
  assert.match(css, /\.base-part\[data-service="app"\] \{[^}]*--part-x1: var\(--base-bar-x\)/,
    'a data container lands on a block slot');
  const ops = css.match(/\.base-part\[data-service="ops"\] \{([\s\S]*?)\n\}/);
  assert.ok(ops, 'the ops container is locatable');
  assert.match(ops[1], /--part-y1: var\(--base-role-y\)/, 'ops becomes the peer\'s role line');
  const peer = css.match(/\.base-peer \{([\s\S]*?)\n\}/);
  assert.ok(peer, 'the peer frame is locatable');
  assert.match(peer[1], /top: calc\([^;]*var\(--pose\)/, 'the frame closes from the host');
  assert.match(peer[1], /height: calc\([^;]*var\(--pose\)/, 'the frame closes to the card');
  assert.match(peer[1], /--peer-reveal:/, 'the replica has its own reveal window');
  assert.match(peer[1], /--plate-fill: color-mix/, 'the frame keys its depth to the pose');
  const clients = css.match(/\.base-clients \{([\s\S]*?)\n\}/);
  assert.ok(clients, 'the client band is locatable');
  assert.match(clients[1], /height: var\(--base-client\)/, 'the client band is fixed');
  assert.doesNotMatch(clients[1], /--pose/, 'the client band never takes the pose');

  /* The outer hosts are the footprint, not containers: their frames clear with
     the pose so the settled figure has no empty VM to read as idle boxes. The
     containers themselves keep their paint (the browser test proves it). */
  const well = css.match(/\.base-well \{([\s\S]*?)\n\}/);
  assert.ok(well, 'a host frame is locatable');
  assert.match(well[1], /opacity: clamp\([^;]*var\(--pose\)/, 'the host frame clears with the pose');

  /* The fold is front-loaded like the chapters before it: the ramp lands by the
     middle of the clock and the rest of the clock holds the landed pose. */
  const ramp = css.match(/@keyframes story-base-pose \{([\s\S]*?)\n\}/);
  assert.ok(ramp, 'the pose ramp is locatable');
  const stops = [...ramp[1].matchAll(/(\d+)%\s*\{[^}]*--pose:\s*([\d.]+)/g)]
    .map((m) => ({ at: Number(m[1]) / 100, pose: Number(m[2]) }));
  const landed = stops.find((s) => s.pose === 1);
  assert.ok(landed, 'the ramp reaches the peer pose');
  assert.ok(landed.at <= 0.5, `the fold lands inside the first half of the clock (${landed.at})`);
  assert.deepEqual(stops[0], { at: 0, pose: 0 }, 'the deployment is the first frame');
  assert.ok(stops.every((s) => s.pose <= landed.pose), 'the pose never goes back');
  /* The deployment is read before it moves: the still beat is longer than the
     fold, so the figure never makes the reader wait through its own motion. */
  const still = stops.filter((s) => s.pose === 0).at(-1);
  assert.ok(still.at > 0, 'the deployment holds before the fold');
  assert.ok(landed.at - still.at < still.at, 'the fold is shorter than the still beat');

  /* No pose is scaled or faded: the pose keyframes animate one number. */
  assert.doesNotMatch(css, /story-base-(cloud|local|ghost|badge|arrow|links|mode-cloud|mode-local|footer-cloud|footer-local)\b/,
    'the scale-and-fade scene is gone');
  assert.doesNotMatch(css, /\.base-(cloud|local|ghost)\b/, 'no pose layer is drawn');
  for (const name of ['story-base-pose', 'story-base-hold']) {
    const found = css.match(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\}\\s*\\}`));
    assert.ok(found, `${name} is locatable`);
    assert.doesNotMatch(found[0], /scale|opacity|visibility/, `${name} animates the pose only`);
    assert.match(found[0], /--pose:/, `${name} writes the pose`);
  }

  /* The authority and the mesh are two networks, and both grow from the pose
     after the blocks have landed. */
  const bus = css.match(/\.base-link--bus \{([\s\S]*?)\n\}/);
  assert.ok(bus, 'the bus is locatable');
  assert.match(bus[1], /width: calc\(var\(--base-bus-w\) \* var\(--link-grow\)\)/, 'the bus reaches the clients');
  const tip = css.match(/\.base-link-tip \{([\s\S]*?)\n\}/);
  assert.ok(tip, 'the request tip is locatable');
  assert.match(tip[1], /translate: 0 calc\(-9px \* var\(--link-grow\)\)/, 'the request tip retracts');
  const mesh = css.match(/\.base-link--mesh \{([\s\S]*?)\n\}/);
  assert.ok(mesh, 'the mesh is locatable');
  assert.match(mesh[1], /width: calc\([^;]*var\(--link-grow\)\)/, 'the mesh appears with the peers');

  /* The offline denouement belonged to the removed 07 chapter: a client state
     without a chapter would animate while the reader leaves the story. */
  assert.doesNotMatch(css, /story-base-(fault|dash|offline|unlink|footer)/,
    'the offline scene is gone');
  assert.doesNotMatch(tsx, /base-client-offline|base-footer--net/, 'no offline state is drawn');
  assert.match(tsx, /<strong>3 peers<\/strong> · 1 key holder/, 'the local footer names the key holder');
  assert.doesNotMatch(beats, /07 · /, 'the story ends at chapter 06');

  assert.match(beats, /06 · Binary/);
  assert.match(beats, /One record\. One binary\./);
  assert.match(tsx, /Cloud-first/, 'the figure names the architecture');
  assert.match(tsx, /Local-first/);
});

test('story: every corner-bound inset follows the corner radius', () => {
  /* A fixed pad only fits one corner style: the border curve eats more of it as
     the radius grows. Every content box that starts on a rounded surface's
     corner must read a radius-derived inset, and the block landing must read
     the same value instead of repeating the pad as a literal. */
  const stage = css.match(/\.story-stage \{([\s\S]*?--base-replica-h: 35px[\s\S]*?)\n\}/);
  assert.ok(stage, 'the stage geometry is locatable');
  assert.match(stage[1], /--base-corner-scale:\s*0\.5/, 'the inset follows half the radius');
  assert.match(stage[1], /--base-corner-safety:\s*1px/, 'the inset keeps one pixel of air');
  assert.match(stage[1], /--base-replica-radius:\s*min\(var\(--radius-lg\), calc\(var\(--base-replica-h\) \/ 2\)\)/,
    'the replica radius is the effective, clamped radius');
  assert.match(stage[1], /--base-replica-pad-left:\s*max\(var\(--base-replica-nominal\),[\s\S]*?var\(--base-replica-radius\)/,
    'the replica pad is radius-derived');
  assert.match(stage[1], /--base-bar-x:[^;]*var\(--base-replica-pad-left\)/,
    'the block landing reads the same pad');
  assert.doesNotMatch(stage[1], /--base-bar-x:[^;]*14px/, 'the landing carries no copied pad');
  assert.match(stage[1], /--base-bar-x:[^;]*var\(--base-peer-body-inset\)/,
    'the landing reads the body inset');
  assert.match(stage[1], /--base-role-x:[^;]*var\(--base-peer-body-inset\)/,
    'the role line reads the body inset');
  for (const inset of ['--base-egress-inset', '--base-well-inset', '--base-mode-inset']) {
    assert.match(stage[1], new RegExp(`${inset}:\\s*max\\(`), `${inset} is radius-derived`);
  }

  const replica = css.match(/\.base-replica \{([^}]*)\}/);
  assert.ok(replica, 'the replica is locatable');
  assert.match(replica[1], /padding:\s*5px 5px 5px var\(--base-replica-pad-left\)/, 'the pad is the shared inset');
  assert.match(replica[1], /border-radius:\s*var\(--base-replica-radius\)/, 'the radius is explicit');

  const peer = css.match(/\.base-peer \{([\s\S]*?)\n\}/);
  assert.ok(peer, 'the peer is locatable');
  assert.match(peer[1], /--base-peer-radius:/, 'the peer exposes its posed radius');
  assert.match(peer[1], /--base-peer-head-inset:\s*max\(/, 'the head inset is radius-derived');
  assert.match(peer[1], /border-radius:\s*var\(--base-peer-radius\)/, 'the peer uses that radius');
  assert.match(css, /\.base-peer-head \{[^}]*left:\s*var\(--base-peer-head-inset\)/, 'the head reads its inset');

  const part = css.match(/\.base-part \{([\s\S]*?)\n\}/);
  assert.ok(part, 'a container is locatable');
  assert.match(part[1], /--base-part-radius:/, 'the chip exposes its posed radius');
  assert.match(part[1], /--base-part-inset:\s*max\(/, 'the chip inset is radius-derived');
  assert.match(part[1], /border-radius:\s*var\(--base-part-radius\)/, 'the chip uses that radius');
  assert.match(css, /\.base-part-row \{[^}]*padding:\s*5px 6px 5px var\(--base-part-inset\)/, 'the row reads its inset');
  assert.match(css, /\.base-well-head \{[^}]*left:\s*var\(--base-well-inset\)/, 'the host head reads its inset');
  assert.match(css, /\.base-egress \{[^}]*right:\s*var\(--base-egress-inset\)/, 'the port reads its inset');
  assert.match(css, /\.base-head \{[^}]*right:\s*var\(--base-mode-inset\)/, 'the rail reads the mode inset');
  /* The band is one rail: both annotations are flex items, so no frame width
     can make them overlap. Placement belongs to the rail, never to a label. */
  const head = css.match(/\.base-head \{([^}]*)\}/);
  assert.ok(head, 'the annotation rail is locatable');
  assert.match(head[1], /display:\s*flex/, 'the rail lays the band out');
  assert.match(head[1], /gap:\s*var\(--space-2\)/, 'the rail keeps a token gap');
  assert.match(head[1], /left:\s*var\(--base-label-inset\)/, 'the rail reads the badge inset');
  assert.match(css, /\.base-head > \.canvas-label \{[^}]*flex:\s*none/, 'the badge never shrinks');
  assert.match(css, /\.base-mode \{[^}]*flex:\s*none/, 'the mode never shrinks');
  assert.doesNotMatch(css, /\.base-perimeter > \.canvas-label/, 'the badge is not anchored to the panel');
  assert.doesNotMatch(css, /\.base-mode \{[^}]*position:\s*absolute/, 'the mode is not a second anchor');

  const narrow = css.match(/\.story-stage \{([^}]*--base-replica-h: 41px[^}]*)\}/);
  assert.ok(narrow, 'the narrow stage is locatable');
  assert.match(narrow[1], /--base-bar-w:\s*8px/, 'the narrow blocks are 8 px');
  assert.match(narrow[1], /--base-bar-gap:\s*2px/, 'the narrow gaps are 2 px');
  assert.match(narrow[1], /--base-replica-nominal:\s*4px/, 'the narrow pad starts at 4 px');
  assert.match(narrow[1], /--base-part-nominal:\s*5px/, 'the narrow chip pad starts at 5 px');
  assert.match(css, /\.base-replica \{ padding:\s*4px 4px 4px var\(--base-replica-pad-left\); \}/,
    'the narrow replica keeps the shared pad');
  assert.match(css, /\.base-part-row \{ padding:\s*4px 5px 4px var\(--base-part-inset\); \}/,
    'the narrow row keeps the shared inset');
  assert.doesNotMatch(css, /\.base-egress \{ right:\s*6px/, 'the narrow port does not override its inset');
  assert.match(css, /\.base-head > \.canvas-label \{ padding:\s*1px 8px; \}/,
    'the narrow badge clears its own pill corners');
  assert.match(css, /\.base-const \{ display:\s*none; \}/,
    'the narrow band drops the gloss, not the name');
  assert.match(css, /\.base-footer-fact \{ display:\s*none; \}/,
    'the narrow footer drops the repeated volume');
  assert.match(narrow[1], /--base-annotation-size:\s*9px/, 'the narrow band takes one grade step');
  assert.match(css, /\.story-pane\[data-pane="6"\] \.topology-caption \{ font-size:\s*9px/,
    'the band and the caption share the phone grade');
  assert.match(stage[1], /--base-label-inset:\s*18px/, 'the desktop rail keeps its own inset');
  assert.match(stage[1], /--base-mode-top:\s*8px/, 'the mode sits on the 2 px step');
  assert.match(stage[1], /--base-annotation-size:\s*var\(--text-xs\)/, 'the band grade has one owner');
});

test('story: the app card leaves with the plan; the panel is the enclosure', () => {
  /* The old invariant — the frame never changes — held for 1-5 and was wrong
     for 5-6: the base then arrived inside the app's own container. The card is
     now an object with a lifetime; the perimeter panel is the only enclosure. */
  const stage = fs.readFileSync('apps/web/src/pages/home/sections/StoryStage.tsx', 'utf8');
  assert.doesNotMatch(stage, /surface-panel/, 'the viewport does not paint the card');
  assert.match(stage, /className="story-card"/, 'the card is a sibling of the viewport');

  const card = css.match(/\.story-card \{([^}]*)\}/);
  assert.ok(card, 'the card is locatable');
  assert.match(card[1], /--radius-xl/, 'the app card keeps its shape while it is the app');
  assert.match(card[1], /--shadow-lg/, 'the card is the thing that lifts off the page');

  const exit = css.match(/\.story-card \{\s*animation: story-card-out([\s\S]*?)\n  \}/);
  assert.ok(exit && /--beat-5/.test(exit[1]), 'the card leaves on the plan clock');
  assert.match(exit[1], /76% exit-crossing 82%/, 'the card leaves after the sheet');
  const out = css.match(/@keyframes story-card-out \{([^}]*)\}/);
  assert.ok(out && /opacity/.test(out[1]) && /translate/.test(out[1]), 'the card lifts and clears');
  assert.doesNotMatch(out[1], /radius|shadow/, 'the exit never repaints the card\'s paint');

  /* The perimeter changes role, not language: it is the panel now, so the
     recipe supplies radius and shadow and the rule keeps layout only. */
  const surfaces = fs.readFileSync('packages/theme/surfaces.css', 'utf8');
  const panel = surfaces.match(/\.surface-panel \{([^}]*)\}/);
  assert.ok(panel, 'the panel recipe is the single source');
  assert.match(panel[1], /--radius-xl/, 'the panel owns the radius');
  assert.match(panel[1], /--shadow-lg/, 'the panel owns the shadow');
  const zone = css.match(/\.base-perimeter \{([^}]*)\}/);
  assert.ok(zone, 'the zone is locatable');
  assert.match(zone[1], /--panel-border/, 'only the role variables are overridden');
  assert.match(zone[1], /--base-zone-x/, 'the perimeter sits on the mat, so an outside exists');
});

test('story: the plan record lands on the server peer', () => {
  /* The seam that was missing: the line the reader just approved crosses into
     the base and lands on the server seat. The seat is the peer's frame, so
     the record lands on the peer in either pose. */
  const plan = fs.readFileSync('apps/web/src/pages/home/sections/StoryPane5.tsx', 'utf8');
  const base = fs.readFileSync('apps/web/src/pages/home/sections/StoryPane6.tsx', 'utf8');
  const carrier = fs.readFileSync('apps/web/src/pages/home/sections/StoryCarrier.tsx', 'utf8');
  const morph = fs.readFileSync('apps/web/src/islands/hero-story/morph.js', 'utf8');
  assert.match(plan, /className="plan-record" data-anchor="5"/, 'the plan record is the seam source');
  assert.match(carrier, /data-seam="5"|SEAMS = \[1, 2, 5\]/, 'the seam has a proxy');
  assert.match(carrier, /story-face--record/, 'the proxy wears the record, not a blank plate');
  assert.match(morph, /const SEAMS = 5/, 'the morph measures the seam');
  assert.match(css, /\.story-carrier\[data-seam="5"\] \{[^}]*--beat-5/,
    'the plan hands over on the plan chapter clock');
  assert.match(base, /base-seat[^>]*data-arrive="5"/, 'the record lands on the server seat');
});

test('css: !important is reserved for stopping motion and measuring a pose', () => {
  /* Two places may outrank a normal declaration: a reader who asked for less
     motion, and a page that snapshots transitions. The third is the hero's
     measurement pose: it must outrank the live keyframe without removing
     `animation-name`, because removing the name would restart the scene. */
  const allowed = new Set([
    'transition-duration: 0.01ms !important',
    'transition-delay: 0s !important',
    'animation: none !important',
    /* Hero measurement poses: see the seam block in site.css. */
    'left: var(--px) !important',
    'top: var(--py) !important',
    '--grow: 0 !important',
    '--grow: var(--grow-to) !important',
    'left: var(--x) !important',
    'top: var(--y) !important',
    'scale: 1 !important',
    'rotate: var(--tilt, 0deg) !important',
    'translate: 0 0 !important',
    /* The plan's fold, measured at rest. */
    'scale: 1 1 !important',
    'width: var(--bar-start) !important'
  ]);
  /* Comments mention the keyword; only real declarations count. */
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const important = [...plain.matchAll(/[^;{}]*!important/g)].map(([line]) => line.trim());
  const unexpected = important.filter((decl) => !allowed.has(decl));
  assert.deepEqual(unexpected, [], `unexpected !important rules: ${unexpected.join(' | ')}`);
  /* The original bug was an `animation: none` pose. A pose may not touch the
     animation list at all; the `!important` guard above would allow it because
     reduced motion legitimately owns that declaration elsewhere. */
  const poseBlock = css.match(/\/\* The morph must land[\s\S]*?\/\* The proxy takes/);
  assert.ok(poseBlock, 'the seam pose block is locatable');
  assert.doesNotMatch(poseBlock[0], /animation\s*:/, 'a pose must not cancel an animation');
});

test('story: one line owns the stage flow, pin and station', () => {
  /* The frame is sticky: its rest position is the grid's flow inset, not its
     `top`. Two insets drift and the intro face sits lower than every chapter,
     so both must read the station token. */
  const grid = css.match(/\.hero-story\s*\{([^}]*)\}/);
  const frame = css.match(/\.story-frame\s*\{([^}]*)\}/);
  assert.ok(grid && frame, 'the hero grid and frame are locatable');
  assert.match(grid[1], /padding-block-start:\s*var\(--story-top\)/);
  assert.match(frame[1], /top:\s*var\(--story-top\)/);
  assert.match(frame[1], /height:\s*var\(--story-stage-h\)/);
  assert.match(css, /--story-station:\s*var\(--story-top\)/);
  assert.doesNotMatch(css, /padding-block-start:\s*168px/);
  assert.doesNotMatch(css, /--story-gap/);
});

test('story: the page is the only scrollport', () => {
  /* A nested scrollport owns the wheel and the keys, and the exit then depends
     on chaining, which keyboard input never does and a wheel gesture only does
     once it restarts. The hero may clip its paint, never its scroll. */
  assert.doesNotMatch(css, /\.story-scroll/);
  const hero = css.match(/\.hero\s*\{([^}]*)\}/);
  assert.ok(hero, 'the hero is locatable');
  assert.match(hero[1], /overflow:\s*clip/, 'clip does not create a scroll container');
  assert.doesNotMatch(hero[1], /overflow(-y)?:\s*(hidden|auto|scroll)/,
    'hidden is a scroll container too, and would own the view timelines');
  /* One page is one frame. The padding token, the nav height and the panels
     must stay one source: the 96/73 mismatch is what let the previous panel
     show under the nav at every section. */
  assert.match(css, /--nav-h:\s*72px/);
  assert.match(css, /--panel:\s*100svh/);
  assert.match(css, /--panel-pad-top:\s*calc\(var\(--nav-h\) \+ var\(--panel-gap\)\)/);
  assert.match(css, /scroll-padding-top:\s*0/);
  assert.match(css, /scroll-margin-top:\s*var\(--story-station\)/);
  assert.match(css, /scroll-snap-stop:\s*always/);
  /* The deck commits to the nearer panel; every panel is exactly one page, so
     a taller section (unreadable under mandatory snap) cannot come back. */
  assert.match(css, /scroll-snap-type:\s*y mandatory/);
  const section = css.match(/\n\.section\s*\{([^}]*)\}/);
  assert.ok(section, 'the section shell is locatable');
  assert.match(section[1], /height:\s*var\(--panel\)/, 'a section is exactly one panel');
  assert.doesNotMatch(section[1], /min-height/, 'a grown section would trap its own tail');
  /* The ending borrows the shell: one panel, one owner for height and padding.
     A second declaration here is how a panel grew past a page unnoticed. */
  const close = css.match(/\n\.close\s*\{([^}]*)\}/);
  assert.ok(close, 'the ending modifier is locatable');
  assert.doesNotMatch(close[1], /height|padding/, 'the ending owns composition, not the panel box');
});

test('story: the phone fold reserves the copy before it sizes the figure', () => {
  /* The mobile composition is the agent on top and the copy under it. The
     copy channel is the intent and the figure takes the remainder: a figure
     authored as a viewport share clips the longest chapter under the fold,
     where the deck's snap can never scroll to it. The reserve must therefore
     be the one token the stage height reads, and the copy and the intro must
     take the one gap. */
  const stageHeights = [...css.matchAll(/--story-stage-h:\s*([^;]+);/g)].map(([, value]) => value.trim());
  assert.equal(stageHeights.length, 2, `two bands only: ${stageHeights.join(' | ')}`);
  assert.match(stageHeights[1], /^clamp\(\s*var\(--story-stage-floor\),\s*calc\(var\(--panel\) - var\(--story-top\) - var\(--story-copy-channel\)\),\s*var\(--story-stage-max\)\s*\)$/,
    `the phone share is the fold minus the copy reserve (${stageHeights[1]})`);
  assert.match(css, /--story-copy-channel:\s*\d+px/, 'the reserve is a token');
  assert.match(css, /--story-copy-gap:\s*\d+px/, 'the copy gap is a token');
  /* One visible gap, measured from the figure's ink: the copy subtracts the
     stage's own inset, and the intro (which has no figure inside the panel)
     takes the gap whole. The pane reads the inset too, so the three cannot
     drift apart. */
  assert.match(css, /\.story-copy \{[^}]*padding-top:\s*calc\(var\(--story-copy-gap\) - var\(--story-pane-inset\)\)/,
    'the chapter gap subtracts the stage inset');
  assert.match(css, /\.story-intro \{[^}]*padding-top:\s*var\(--story-copy-gap\)/,
    'the intro takes the whole gap');
  assert.match(css, /\.story-pane \{[^}]*padding:\s*var\(--story-pane-inset\)/,
    'the pane reads the one inset');
  /* Every derived line follows the stage share, so the pin, the snap inset and
     the intro face cannot disagree with the figure. */
  assert.match(css, /--story-station:\s*calc\(var\(--story-top\) \+ var\(--story-stage-h\)\)/);
  assert.match(css, /--story-face:\s*calc\(100svh - var\(--story-station\)\)/);
});

test('story: state comes from scroll, never from written attributes', () => {
  /* The chapter, the scene playhead and the intro are CSS timelines. A second
     owner (a script writing a station or a clock) is the bug this guard
     prevents: the two would drift and the copy would wait for a settle. The
     pager owns `aria-current` for the contents; the story owns none of it. */
  const storySources = [
    ['site.css', css, /\b(data-clock|data-seq|data-phase|data-station|data-motion)\b/],
    ...fs.readdirSync('apps/web/src/pages/home/sections')
      .filter((file) => file.startsWith('Story') && file.endsWith('.tsx'))
      .map((file) => [file, fs.readFileSync(`apps/web/src/pages/home/sections/${file}`, 'utf8'),
        /\b(data-clock|data-seq|data-phase|data-station|data-motion|aria-current)\b/])
  ];
  for (const [file, source, banned] of storySources) {
    assert.doesNotMatch(source, banned, `${file} writes a second state`);
  }
  assert.ok(!fs.existsSync('apps/web/src/islands/hero-story/sequence.js'),
    'the sequence clock table is gone');
  const controller = fs.readFileSync('apps/web/src/islands/hero-story/controller.js', 'utf8');
  for (const token of ['setInterval', 'currentTime', 'getAnimations', 'requestAnimationFrame']) {
    assert.ok(!controller.includes(token), `hero controller must not own ${token}`);
  }
});

/* ── Presence and motion vocabulary ────────────────────────────
   The board renders its hands from one table, and every instance of an actor
   names that actor. A token the table can emit must be shaded by the
   stylesheet, and a window it sets must be a window CSS reads. Without these
   guards a name can exist in markup that no rule owns, and the element paints
   nothing: a knob loses its stroke and the card looks held with bare paper. */
const SECTIONS = 'apps/web/src/pages/home/sections';
const CARD = fs.readFileSync(`${SECTIONS}/StoryCard.tsx`, 'utf8');

test('presence: every identity the board renders is shaded', () => {
  const identities = [...CARD.matchAll(/identity: '([a-z]+)'/g)].map(([, id]) => id);
  assert.ok(identities.length >= 2, 'the hands table declares one identity per hand');
  for (const id of new Set(identities)) {
    for (const owner of ['presence', 'collab-line', 'collab-select', 'collab-pointer', 'doc-presence']) {
      assert.match(css, new RegExp(`\\.${owner}--${id}\\b`), `site.css shades .${owner}--${id}`);
    }
  }
  /* A knob is a fill plus a stroke, and both read one shade. The fill matches
     the paper it sits on, so the stroke is what makes it a handle. */
  const knob = css.match(/\n\.collab-knob \{([^}]*)\}/);
  assert.ok(knob, 'the knob recipe is locatable');
  assert.match(knob[1], /border:\s*1px solid var\(--id\)/, 'a knob is stroked in its identity shade');
});

test('presence: one name per actor, on every instance', () => {
  /* Two spellings for one actor is how the dry run's knobs lost their shade:
     the hold wrote `--agent` while the stylesheet shaded `--atlas`. */
  const sources = [['site.css', css],
    ...fs.readdirSync(SECTIONS).map((file) => [file, fs.readFileSync(`${SECTIONS}/${file}`, 'utf8')])];
  for (const [file, source] of sources) {
    assert.doesNotMatch(source, /--atlas\b/, `${file} keeps the retired actor token`);
    assert.doesNotMatch(source, /presence--agent\b/, `${file} spells the agent's presence twice`);
    assert.doesNotMatch(source, /rota-pointer--agent\b/, `${file} spells the agent's pointer twice`);
  }
});

test('motion: one track per gesture, and the params that drive it', () => {
  /* The hands differ by numbers, never by a second implementation. A per-hand
     keyframe or a per-hand rule would let the two drift apart. */
  for (const track of ['collab-presence', 'collab-lift', 'collab-move', 'collab-grow',
    'collab-pointer-hand']) {
    assert.match(css, new RegExp(`@keyframes ${track}\\b`), `the shared track ${track} exists`);
  }
  assert.doesNotMatch(css, /@keyframes collab-[a-z-]+-(maya|merlin)\b/, 'no hand owns a keyframe');
  assert.doesNotMatch(css, /\.collab-hold\[data-hand=/, 'a hold rule does not fork per hand');
  assert.doesNotMatch(css, /collab-pointer--(carry|resize)/, 'a gesture owns no pointer rule');

  /* Every param the component writes is read by CSS, and every param CSS reads
     is written by the component: one vocabulary, no silent default. */
  const emitted = new Set([...CARD.matchAll(/'(--(?:act-[a-z-]+|ptr-[0-9][xy]))'/g)].map(([, v]) => v));
  const consumed = new Set([...css.matchAll(/var\((--(?:act-[a-z-]+|ptr-[0-9][xy]))/g)].map(([, v]) => v));
  assert.deepEqual([...emitted].filter((v) => !consumed.has(v)), [], 'CSS reads every act param');
  assert.deepEqual([...consumed].filter((v) => !emitted.has(v)), [], 'the board sets every param CSS reads');
  for (const part of ['', '-span']) {
    assert.ok(emitted.has(`--act-hand${part}`), `the act declares --act-hand${part}`);
  }
  /* The sheet has no clock of its own: its tracks are read off the hand's own
     route, or a retime can drag the paper with a grip it is not in. */
  const held = css.match(/\.story-pane\[data-pane="3"\] \.collab-note\[data-act\] \{([^}]*)\}/);
  assert.ok(held, 'the held-card rule is locatable');
  assert.match(held[1], /--grip: calc\(var\(--act-hand\) \+ var\(--act-hand-span\) \* var\(--hand-grip\)\)/,
    'the grip is where the hand lands on the paper');
  assert.match(held[1], /--pull: calc\(var\(--act-hand\) \+ var\(--act-hand-span\) \* var\(--hand-knob\)\)/,
    'the pull is where the hand lands on the point it resizes from');
  assert.doesNotMatch(held[1], /--act-(lift|move|grow|in|ptr|reach|drag|knob|leave)\b/,
    'no sheet track keeps a window of its own');
  /* One route, two readers: the hand's keyframe turns exactly where the sheet
     reads the grip, the drag, the pull and the release. A stop that moves alone
     would put the paper under a hand that is not on it. */
  const route = css.match(/@keyframes collab-pointer-hand \{([\s\S]*?)\n\}/);
  assert.ok(route, 'the hand route is locatable');
  const stops = route[1].split('\n')
    .flatMap((line) => [...line.matchAll(/([\d.]+)%/g)].map(([, n]) => Number(n) / 100));
  const beats = ['--hand-grip', '--hand-drag', '--hand-knob', '--hand-off']
    .map((name) => Number(css.match(new RegExp(`${name}:\\s*([\\d.]+)`))[1]));
  assert.deepEqual(stops, [0, ...beats, 1], 'the hand route turns where the sheet reads it');
});

test('motion: a park axis is a length-percentage, and the offset is written once', () => {
  /* `calc(38% + 0)` is invalid at computed-value time: the keyframe's `top`
     then falls back to `auto` (the static position), so the parked sheet sits
     on the frame's top edge and the board clips it. So every axis must carry a
     unit, and both axes live on the note itself: a card that omits one can
     never leave it unresolved. */
  const note = css.match(/\.collab-note \{([^}]*)\}/);
  assert.ok(note, 'the note is locatable');
  for (const axis of ['--dx', '--dy']) {
    assert.match(note[1], new RegExp(`${axis}: 0%;`), `the note states its own ${axis}`);
  }
  for (const [, value] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--d[xy]:\s*([^;]+);/g)) {
    assert.match(value.trim(), /^(?:0|(?:\.\d+|\d+(?:\.\d+)?)(?:%|px|rem|em|vw|vh))$/,
      `a park axis is a length-percentage (${value.trim()})`);
    assert.doesNotMatch(value.trim(), /^0$/, 'a park axis is never a bare zero');
  }
  const offset = [...css.matchAll(/var\((--px|--py)\)/g)].map(([, name]) => name);
  assert.deepEqual(offset.sort(), ['--px', '--px', '--py', '--py'],
    'the park offset is read by the move and by the seam measurement');
  for (const name of ['--px', '--py']) {
    const declared = [...css.matchAll(new RegExp(`${name}:`, 'g'))].length;
    assert.equal(declared, 1, `${name} is written once`);
  }
  const move = css.match(/@keyframes collab-move \{([\s\S]*?)\n\}/);
  assert.ok(move, 'the move track is locatable');
  assert.match(move[1], /0%\s*\{ left: var\(--px\); top: var\(--py\); \}/,
    'the move starts from the one park offset');
});

/* A control that draws its own enclosure carries a bare tick: the ring belongs
   to the box, chip or tag. A ringed glyph inside one paints the outline twice,
   which is how the scope list grew a square inside a circle. */
const RINGED_CONTROLS = ['todo-box', 'plan-approve', 'rota-approve', 'plan-tag'];

function ringedBodies(source, className) {
  const bodies = [];
  for (const open of source.matchAll(/<(\w+)\s[^>]*className="([^"]*)"[^>]*>/g)) {
    if (!open[2].trim().split(/\s+/).includes(className)) continue;
    if (open[0].trimEnd().endsWith('/>')) continue;
    const from = open.index + open[0].length;
    const close = new RegExp(`<${open[1]}\\b|</${open[1]}>`, 'g');
    close.lastIndex = from;
    let depth = 1;
    let end = -1;
    for (let match = close.exec(source); match && depth > 0; match = close.exec(source)) {
      depth += match[0].startsWith('</') ? -1 : 1;
      if (depth === 0) end = match.index;
    }
    assert.ok(end > from, `${className}: the control is closed`);
    bodies.push(source.slice(from, end));
  }
  return bodies;
}

test('checkboxes: the control owns the ring, the glyph is bare', () => {
  const seen = new Set();
  for (const file of fs.readdirSync(SECTIONS)) {
    const source = fs.readFileSync(`${SECTIONS}/${file}`, 'utf8');
    for (const control of RINGED_CONTROLS) {
      for (const body of ringedBodies(source, control)) {
        seen.add(control);
        assert.doesNotMatch(body, /icon-check-circle\b/, `${file}: ${control} nests a ringed glyph`);
      }
    }
  }
  assert.ok(seen.has('todo-box'), 'the scope list is checked');
  assert.ok(seen.has('plan-approve'), 'the consent chip is checked');
});

test('brand: the studio pill pads both inline ends for its corner', () => {
  /* The choice pill always wears --radius-full. A leading swatch that starts
     on the left curve must not use a smaller pad than the trailing label; the
     old 8 px left pad was the curve's inset, not a visible gap. */
  const choice = css.match(/\.choice \{([\s\S]*?)\n\}/);
  assert.ok(choice, 'the studio choice is locatable');
  assert.match(choice[1], /border-radius:\s*var\(--radius-full\)/, 'the choice is a pill');
  assert.match(choice[1], /padding:\s*6px 11px;/, 'both inline ends share the pad');
  assert.doesNotMatch(choice[1], /padding:\s*6px 11px 6px 8px/, 'the curve is not the left pad');
  assert.match(css, /\.choice \{ justify-content: center; padding: 5px 8px; gap: 4px; font-size: 9px; \}/,
    'the narrow pill keeps both ends');
});
