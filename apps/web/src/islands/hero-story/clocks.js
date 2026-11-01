/* The scene playhead for browsers without CSS animation triggers.
   Chrome (146+) starts a pane's clock from `animation-trigger` in site.css.
   Safari 26 and Firefox 159 support scroll-driven animations but have no trigger
   layer, so here the same keyframes run as ordinary time-driven animations and
   this observer starts them when their beat reaches the station line.

   Why IntersectionObserver, not scroll events: the browser reports the crossing
   of the station line, so no scroll listener, no rAF loop, and no scroll write.
   Why `top` of `.story-copy`: the station has one owner (site.css), and that
   rule already resolves it to pixels.

   The CSS stays the single source of animation values. This module only owns
   `playState` and `currentTime`, which is why it may use the Web Animations API
   while the seam controller may not. */

/* A scroll-driven animation is scrubbed by the timeline, so the driver must
   leave it alone; an infinite one (a caret blink) is not a scene. What is
   left is the pane's clock: its finite, document-timeline animations. */
function isClock(animation) {
  return (
    animation.timeline === document.timeline &&
    (typeof CSSAnimation === 'undefined' || animation instanceof CSSAnimation) &&
    Number.isFinite(animation.effect?.getTiming().iterations)
  );
}

/* The pane's scene clock: all of its finite, document-timeline animations.
   Exported because the brand leader waits for the same clock to end, so one
   definition of "the scene is over" serves both islands. */
export function sceneClocks(pane) {
  return pane.getAnimations({ subtree: true }).filter(isClock);
}

/* The station is authored once, as the copy box's sticky `top`. */
function stationOf(root) {
  const copy = root.querySelector('.story-copy');
  const top = copy ? parseFloat(getComputedStyle(copy).top) : NaN;
  if (Number.isFinite(top)) return top;
  return parseFloat(getComputedStyle(root).getPropertyValue('--story-station')) || 0;
}

/* The parked frame is the first keyframe, which is the pose the seam and its
   anchors expect. */
function park(animations = []) {
  for (const animation of animations) parkOne(animation);
}

function parkOne(animation) {
  animation.pause();
  animation.currentTime = 0;
}

/* A beat plays once per arrival: park first, so a replay never resumes where
   the last visit stopped. */
function play(animations = []) {
  for (const animation of animations) {
    parkOne(animation);
    animation.play();
  }
}

function beatsOf(root) {
  return [...root.querySelectorAll('.story-beat')].map((el) => ({
    point: el.querySelector(':scope > .snap-point'),
    pane: root.querySelector(`.story-pane[data-pane="${el.dataset.storyBeat}"]`),
  }));
}

/* The trigger range in site.css starts 4 px before the station line, so a
   snap that lands exactly on the line is still inside the range. The driver
   needs the same 4 px for a second reason: a decision taken exactly on the
   boundary leaves IntersectionObserver quiet, because the target reaches the
   line without ever crossing it. */
const EARLY = 4;

/* A point is passed once its top reaches the line. The last passed beat owns
   the stage, exactly as the trigger layer's activation range does. */
function lastPassed(beats, line) {
  let active = -1;
  beats.forEach((beat, index) => {
    const top = beat.point?.getBoundingClientRect().top;
    if (top !== undefined && top <= line) active = index;
  });
  return active;
}

export function initClocks(root) {
  const noop = function () {};
  if (CSS.supports('animation-trigger', '--t play-forwards')) return noop;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return noop;

  const beats = beatsOf(root);
  if (!beats.some((beat) => beat.pane)) return noop;

  const clocks = new Map();
  let station = 0;
  let active = -1;
  let observer = null;
  let pending = 0;

  function collect() {
    for (const beat of beats) if (beat.pane) clocks.set(beat.pane, sceneClocks(beat.pane));
  }

  /* Leaving resets: the next forward arrival must replay from the first frame,
     which is the deterministic pose the seam and its anchors expect. */
  function select(next) {
    if (next === active) return;
    const previous = active;
    active = next;
    if (previous >= 0 && beats[previous].pane) park(clocks.get(beats[previous].pane));
    if (next >= 0 && beats[next].pane) play(clocks.get(beats[next].pane));
  }

  function sync() {
    select(lastPassed(beats, station + EARLY));
  }

  /* The observer is the scroll subscription: one callback per station
     crossing. It watches each beat's point, 1 px tall, so a crossing is a
     single event; `lastPassed` recomputes every point, so a fast jump whose
     entries arrive out of order still lands on the right beat. */
  function observe() {
    observer?.disconnect();
    station = stationOf(root);
    observer = new IntersectionObserver(sync, {
      rootMargin: `-${station + EARLY}px 0px 0px 0px`,
      threshold: 0,
    });
    for (const beat of beats) if (beat.point) observer.observe(beat.point);
    sync();
  }

  /* A resize moves the station and can replace a pane's animations; the running
     pane keeps its playhead, every other pane waits at its first frame. */
  function refresh() {
    collect();
    clocks.forEach((animations, pane) => {
      if (pane !== beats[active]?.pane) park(animations);
    });
    observe();
  }

  function scheduleRefresh() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = 0;
      refresh();
    }, 120);
  }

  collect();
  clocks.forEach((animations) => park(animations));
  observe();
  window.addEventListener('resize', scheduleRefresh, { passive: true });

  return function destroy() {
    observer?.disconnect();
    if (pending) clearTimeout(pending);
    window.removeEventListener('resize', scheduleRefresh);
  };
}
