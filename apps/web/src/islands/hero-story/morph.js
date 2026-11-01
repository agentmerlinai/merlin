/* The proxy's geometry is measured, not authored: an anchor's rect changes
   with viewport, theme and surface, and the morph must land exactly on it.
   Stage-local pixels keep the box and its face in one coordinate space.

   A seam pairs items, not surfaces. `data-anchor="<n>"` lists what leaves
   surface n and `data-arrive="<n>"` lists where it lands. A surface that names
   its items (`data-item`) meets its own destination by that name, wherever the
   two sit in the DOM; a single-item seam needs no name and pairs by position.
   A missing, repeated or unmatched name is a layout bug, so it is reported and
   the seam is left unmeasured rather than flown to the wrong box. */
const SEAMS = 5;

export function createMorph(stage) {
  const carriers = new Map();
  stage.querySelectorAll('.story-carrier').forEach(function (el) {
    carriers.set(itemKey(el), el);
  });

  function itemKey(el) {
    return el.dataset.seam + ':' + (el.dataset.item || '');
  }

  function rect(el) {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: r.left - s.left - stage.clientLeft,
      y: r.top - s.top - stage.clientTop,
      w: r.width,
      h: r.height
    };
  }

  /* The faces are read under the stage flags below, so the rect belongs to the
     pose the frame will show at that end of the travel, not to a live playhead. */
  function anchors(attr, n) {
    return Array.from(stage.querySelectorAll('[' + attr + '="' + n + '"]')).map(function (el) {
      return { el: el, box: rect(el) };
    });
  }

  function write(el, a, b) {
    if (!el || !a || !b || !(a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0)) return;
    const sx = b.w / a.w;
    const sy = b.h / a.h;
    const set = function (name, value) { el.style.setProperty(name, value); };
    set('--from-x', a.x + 'px');
    set('--from-y', a.y + 'px');
    set('--from-w', a.w + 'px');
    set('--from-h', a.h + 'px');
    set('--to-x', b.x + 'px');
    set('--to-y', b.y + 'px');
    set('--to-sx', String(sx));
    set('--to-sy', String(sy));
    /* The face holds its authored size when the box grows (the card becomes a
       page) and shrinks with the box when the box shrinks (the page becomes a
       seed). */
    set('--face-sx', String(Math.min(1, 1 / sx)));
    set('--face-sy', String(Math.min(1, 1 / sy)));
  }

  function fail(seam, detail) {
    console.error('hero-story: seam ' + seam + ' ' + detail + '; the seam is not measured.');
    return null;
  }

  /* The pairs a seam flies, in the sources' order. A seam whose sources are all
     named is matched by name, so the rota's notes and the plan's bars need no
     shared ordering; an unnamed seam (one item) pairs by position, and the
     destination's own name — the canvas tile that is also a seam's arrival — is
     none of its business. Naming only some sources is a layout bug. */
  function pairs(seam, from, to) {
    const names = from.map(function (s) { return s.el.dataset.item || ''; });
    if (!names.every(Boolean)) {
      if (names.some(Boolean)) return fail(seam, 'names only some of its sources');
      return from.length === to.length ? from.map(function (s, i) { return [s, to[i]]; }) :
        fail(seam, 'has ' + from.length + ' sources and ' + to.length + ' destinations');
    }
    const arrivals = new Map();
    for (const d of to) {
      const key = d.el.dataset.item;
      if (!key || arrivals.has(key)) return fail(seam, 'has the destination "' + (key || '') + '" more than once');
      arrivals.set(key, d);
    }
    const out = [];
    for (const s of from) {
      const key = s.el.dataset.item;
      if (!arrivals.has(key)) return fail(seam, 'has no destination for "' + key + '"');
      out.push([s, arrivals.get(key)]);
      arrivals.delete(key);
    }
    return arrivals.size ? fail(seam, 'has a destination with no source') : out;
  }

  /* The source is read at its worked (end) frame and the destinations at their
     first frame; the stage flags ask CSS for those two poses with `!important`
     overrides, so the read is valid whenever it happens, even while a scene is
     playing. The overrides never remove `animation-name`, so every playhead
     keeps running. One flag pair per seam, not per item: the pose is a property
     of the surface, not of a box. */
  function measure(seam) {
    if (seam < 1 || seam > SEAMS) return;
    let from;
    let to;
    stage.dataset.measureFrom = String(seam);
    try {
      from = anchors('data-anchor', seam);
      /* Clear the source pose before reading the destination: a source rule must
         never reach into a destination box. */
      delete stage.dataset.measureFrom;
      stage.dataset.measure = String(seam + 1);
      to = anchors('data-arrive', seam);
    } finally {
      /* A pose is temporary even if a read throws. */
      delete stage.dataset.measure;
      delete stage.dataset.measureFrom;
    }

    const flights = pairs(seam, from, to);
    if (!flights) return;
    for (const [source, arrival] of flights) {
      /* The proxy is keyed by the item that leaves, so a surface that holds
         several items names each one; a single-item seam needs no key. A proxy
         that is missing is a layout bug, not a box to guess at. */
      const carrier = carriers.get(seam + ':' + (source.el.dataset.item || ''));
      if (!carrier) {
        console.error('hero-story: seam ' + seam + ' has no proxy for item "' +
          (source.el.dataset.item || '') + '".');
        continue;
      }
      write(carrier, source.box, arrival.box);
    }
  }

  function measureAll() {
    for (let n = 1; n <= SEAMS; n++) measure(n);
  }

  return { measure: measure, measureAll: measureAll };
}
