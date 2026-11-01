import type { Leader } from './geometry';

const NS = 'http://www.w3.org/2000/svg';

/* The leader is one path plus its aim mark. It is appended to the body, not the
   copy: the copy is sticky and the bar is fixed, so neither can own a fixed
   layer without shifting it. The ring names the target, the dot holds its
   centre, and the halo is the pulse that draws the eye to the pair. All three
   are decoration and never take input. */
export function createLeader(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'brand-thread');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('class', 'brand-thread-path');
  /* One unit of route, whatever the box heights made it: the stylesheet draws
     the line by a fraction of its own length instead of a measured total. */
  path.setAttribute('pathLength', '1');
  svg.append(
    path,
    circle('brand-thread-halo', 5.5),
    circle('brand-thread-ring', 5.5),
    circle('brand-thread-dot', 3),
  );
  document.body.append(svg);
  return svg;
}

export function paintLeader(svg: SVGSVGElement, leader: Leader): void {
  const path = svg.querySelector('.brand-thread-path');
  const mark = svg.querySelectorAll('circle');
  if (!path || mark.length === 0) return;
  path.setAttribute('d', leader.path);
  for (const node of mark) {
    node.setAttribute('cx', String(leader.x));
    node.setAttribute('cy', String(leader.y));
  }
}

function circle(className: string, radius: number): SVGCircleElement {
  const node = document.createElementNS(NS, 'circle');
  node.setAttribute('class', className);
  node.setAttribute('r', String(radius));
  return node;
}
