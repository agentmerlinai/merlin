/* The story is stateless. Scroll drives every frame: the copy and the scene
   clocks are CSS view/trigger timelines, so the browser owns the station, the
   chapter and each surface's playhead. This script owns the one thing CSS
   cannot: the seam's measured geometry. The proxy must start on the source's
   worked frame and land on the destination's first frame, and both are measured
   boxes. Fonts and a resize change those boxes, so remeasure when they settle.

   The measurement flags force the two authored poses with `!important` CSS
   declarations. They never touch `animation-name`, so a remeasure is valid
   mid-scene and leaves every playhead running. */
import { loadPreset } from '@merlin/theme/fonts';
import { createMorph } from './morph.js';

export function initHeroStory(root) {
  const stage = root.querySelector('[data-story-stage]');
  if (!stage) return function () {};

  const morph = createMorph(stage);
  const controller = new AbortController();

  function measure() {
    morph.measureAll();
  }

  /* A face change changes the boxes. Wait for any face still loading, then
     measure the settled frame once; the pose overrides make the read safe at
     any playhead. */
  function measureSettled() {
    if (document.fonts && document.fonts.status === 'loading') {
      document.fonts.ready.then(measure);
      return;
    }
    measure();
  }

  let pending = 0;
  function scheduleMeasure() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = 0;
      measure();
    }, 120);
  }

  measure();
  window.addEventListener('resize', scheduleMeasure, { signal: controller.signal, passive: true });
  document.addEventListener('merlin:theme-change', (event) => {
    if (!event.detail?.fonts) return;
    /* The store names the preset it applied. Wait for that preset's faces only;
       the global font set may still be preloading other presets. */
    if (event.detail.preset) {
      loadPreset(event.detail.preset).then(measure);
      return;
    }
    measureSettled();
  }, { signal: controller.signal });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  return function destroy() {
    controller.abort();
    if (pending) clearTimeout(pending);
  };
}
