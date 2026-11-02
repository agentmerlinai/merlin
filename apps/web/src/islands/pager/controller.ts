/* Position and navigation answer different questions. The spine says where the
   deck rests across the whole document (one step per panel); the running head
   names that panel and opens the one contents list. Both read the panels
   themselves, so a panel's name has one source: its own label, index, eyebrow,
   or heading. No second list exists anywhere in the chrome. */

const PANEL_SELECTOR = '.hero, .story-beat, .section, .close';

type Panel = {
  el: HTMLElement;
  point: HTMLElement;
  name: string;
  index: string | null;
};

/* A panel names itself. The story's index carries the chapter name; a section's
   eyebrow carries its short name; the intro and close carry an explicit label
   because their headings are sentences, not names. Scoped to the panel's own
   heading area, so the hero cannot borrow the index of the story inside it. */
function panelName(el: HTMLElement): string {
  const explicit = el.dataset.label;
  if (explicit) return explicit;
  if (el.classList.contains('story-beat')) {
    const chapter = el.querySelector('.story-index')?.textContent?.split('·')[1]?.trim();
    if (chapter) return chapter;
  }
  const eyebrow = el.querySelector(':scope > .wrap > .eyebrow')?.textContent?.trim();
  if (eyebrow) return eyebrow;
  return el.querySelector('h1, h2')?.textContent?.trim() ?? '';
}

/* A panel's numeral has one source: its explicit `data-index` (the intro's
   00, the kit's 07, the close's 08) or, for a story beat, its own chapter
   index. No deck ordinal exists, so a row and the running head can never
   print different numbers. */
function panelIndex(el: HTMLElement): string | null {
  const explicit = el.dataset.index;
  if (explicit) return explicit;
  if (!el.classList.contains('story-beat')) return null;
  const index = el.querySelector('.story-index')?.textContent ?? '';
  return index.includes('·') ? index.split('·')[0].trim() : null;
}

/* A panel's rest comes from its own point, exactly as the scroll engine
   resolves it: `start` subtracts the point's margin, `end` measures from the
   snapport's bottom edge. One resolver, so the chrome cannot disagree with
   where the deck actually rests. */
function snapPosition(point: HTMLElement): number {
  const rect = point.getBoundingClientRect();
  const style = getComputedStyle(point);
  if (style.scrollSnapAlign.startsWith('end')) {
    return rect.bottom + window.scrollY - window.innerHeight;
  }
  const margin = parseFloat(style.scrollMarginTop) || 0;
  return rect.top + window.scrollY - margin;
}

function nearestPanel(panels: Panel[], y: number): number {
  let best = 0;
  let gap = Infinity;
  panels.forEach((panel, i) => {
    const distance = Math.abs(snapPosition(panel.point) - y);
    if (distance < gap) {
      gap = distance;
      best = i;
    }
  });
  return best;
}

function collectPanels(): Panel[] {
  const panels: Panel[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(PANEL_SELECTOR)) {
    const point = el.querySelector<HTMLElement>(':scope > .snap-point');
    if (!el.id || !point) continue;
    panels.push({ el, point, name: panelName(el), index: panelIndex(el) });
  }
  return panels;
}

/* The spine is one continuous rule: one equal step per panel, no separators, no
   passed shading. Only the current step is drawn, as a slice that slides to
   its step, so the strip says where the deck rests and which way it travelled
   without splitting the line. */
function buildSpine(panels: Panel[]): HTMLElement | null {
  const spine = document.querySelector<HTMLElement>('[data-pager-spine]');
  if (!spine) return null;
  spine.style.setProperty('--pager-segments', String(panels.length));
  const fill = document.createElement('i');
  fill.className = 'pager-spine-fill';
  spine.append(fill);
  return spine;
}

/* The row's owner: the list item and the anchor inside it, so the caller
   appends one thing and marks the other. */
type Row = { item: HTMLLIElement; link: HTMLAnchorElement };

function rowFor(panel: Panel): Row {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'pager-row';
  link.href = `#${panel.el.id}`;
  const num = document.createElement('span');
  num.className = 'pager-row-num';
  num.textContent = panel.index ?? '';
  const name = document.createElement('span');
  name.textContent = panel.name;
  link.append(num, name);
  item.append(link);
  return { item, link };
}

/* One flat list, in panel order: the deck tells the story, so the contents
   repeats it without headings or rules between runs. It is a popover, so light
   dismiss, Escape, and the top layer come from the platform, not from a second
   copy of the panel map in the markup. */
function buildContents(panels: Panel[]): { root: HTMLElement; rows: HTMLAnchorElement[] } {
  const root = document.createElement('nav');
  root.className = 'pager-contents';
  root.id = 'pager-contents';
  root.setAttribute('popover', 'auto');
  root.setAttribute('aria-label', 'Contents');
  const list = document.createElement('ul');
  const rows = panels.map((panel) => {
    const { item, link } = rowFor(panel);
    list.append(item);
    return link;
  });
  root.append(list);
  return { root, rows };
}

function chevron(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 8 5');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M1 1l3 3 3-3');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  svg.append(path);
  return svg;
}

/* The trigger states the current panel and opens the list: one control, one
   label source, at every width. The prefix keeps the accessible name truthful
   while the visible text stays the panel's own numeral and name. */
function buildTrigger(root: HTMLElement): { button: HTMLButtonElement; num: HTMLElement; now: HTMLElement } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pager-trigger';
  button.setAttribute('popovertarget', 'pager-contents');
  button.setAttribute('aria-controls', 'pager-contents');
  button.setAttribute('aria-expanded', 'false');
  const prefix = document.createElement('span');
  prefix.className = 'pager-sr';
  prefix.textContent = 'Contents: ';
  const num = document.createElement('span');
  num.className = 'pager-trigger-num';
  const now = document.createElement('span');
  now.className = 'pager-now';
  button.append(prefix, num, now, chevron());
  root.append(button);
  return { button, num, now };
}

function markCurrent(
  panels: Panel[],
  rows: HTMLAnchorElement[],
  spine: HTMLElement | null,
  best: number
): Panel {
  rows.forEach((row, i) => {
    if (i === best) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
  });
  spine?.style.setProperty('--pager-step', String(best));
  return panels[best];
}

export function initPager(root: HTMLElement): void {
  const panels = collectPanels();
  if (panels.length === 0) return;

  const spine = buildSpine(panels);
  const contents = buildContents(panels);
  const { button, num, now } = buildTrigger(root);
  root.append(contents.root);

  const live = document.createElement('p');
  live.className = 'pager-live pager-sr';
  live.setAttribute('aria-live', 'polite');
  root.append(live);

  contents.root.addEventListener('toggle', (event) => {
    const open = (event as Event & { newState?: string }).newState === 'open';
    button.setAttribute('aria-expanded', String(open));
  });
  contents.root.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) contents.root.hidePopover();
  });

  let current = -1;
  const render = () => {
    const best = nearestPanel(panels, window.scrollY);
    const panel = markCurrent(panels, contents.rows, spine, best);
    num.textContent = panel.index ?? '';
    num.hidden = !panel.index;
    now.textContent = panel.name;
    if (best !== current) {
      current = best;
      live.textContent = `${panel.name} — panel ${best + 1} of ${panels.length}`;
      /* One station signal. The kit section's tests read this owner instead
         of re-deriving the nearest panel from the scroll. */
      document.documentElement.dataset.panel = panel.el.id;
      document.dispatchEvent(new CustomEvent('merlin:panel', { detail: { id: panel.el.id } }));
    }
  };

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      render();
    });
  };

  render();
  document.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('scrollend', schedule);
  /* Safari has no `scrollsnapchange`; fire the snap event only where it exists
     and let `scroll` + rAF carry the same frame. */
  if ('onscrollsnapchange' in document) document.addEventListener('scrollsnapchange', schedule);
  window.addEventListener('resize', schedule);
}
