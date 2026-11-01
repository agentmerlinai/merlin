import { sceneClocks } from '../hero-story/clocks';
import { createLeader, paintLeader } from './draw';
import { leaderFor } from './geometry';

/* The slip states where the brand studio lives; the leader is the geometry that
   points at the nav chip. It reads `data-panel` (the pager), the computed
   display, and the copy's own computed visibility (the stylesheet), so it owns
   no station, breakpoint, or memory of its own: the cue is true every visit. */

/* The note is the line's source, so the copy's window is the line's window.
   That window is scroll-linked (`story-copy-seen`), so no panel event can see
   it close; only the computed style can. */
const notePresent = (slip: HTMLElement): boolean =>
  getComputedStyle(slip).visibility === 'visible';

/* The line is the last beat of the chapter's scene: it waits for the pane's
   clock, so the annotation never preempts the sequence it comments on. A
   cancelled clock (a reset on exit) resolves too; the epoch below drops it. */
const settled = (): Promise<unknown> => {
  const pane = document.querySelector('.story-pane[data-pane="1"]');
  if (!pane) return Promise.resolve();
  return Promise.all(sceneClocks(pane).map((clock) => clock.finished.catch(() => undefined)));
};

export function initBrandThread(root: HTMLElement): void {
  const slip = root.querySelector<HTMLElement>('.brand-thread-ticket');
  const slot = slip?.parentElement;
  const chip = document.querySelector<HTMLElement>('.nav .brand-trigger');
  const bar = document.querySelector<HTMLElement>('.nav');
  if (!slip || !slot || !chip || !bar) return;

  const leader = createLeader();
  /* The stylesheet owns the breakpoint and the motion gate. */
  if (getComputedStyle(leader).display === 'none') {
    leader.remove();
    return;
  }

  /* False when the boxes leave no room for the lane, so the line never runs
     through the chapter's own heading. */
  const paint = (): boolean => {
    const next = leaderFor(
      slip.getBoundingClientRect(),
      slot.getBoundingClientRect(),
      chip.getBoundingClientRect(),
      bar.getBoundingClientRect(),
      document.documentElement.clientWidth,
    );
    if (!next) return false;
    paintLeader(leader, next);
    return true;
  };

  /* Every call takes a ticket, so a wait that outlives its station (or a
     resize) cannot draw a stale frame. */
  let epoch = 0;
  /* Armed means the station and its scene allow the cue. Presence is applied
     per scroll frame, because the copy's window can close between stations. */
  let armed = false;

  /* One writer for the switch: the cue is present only while the station is
     current and the note is still in its window. Repainting here also keeps
     the line on the note while the sticky copy rides. */
  const apply = (): void => {
    const next = String(armed && notePresent(slip) && paint());
    if (leader.dataset.visible !== next) leader.dataset.visible = next;
  };

  const reflect = (): void => {
    const ticket = ++epoch;
    if (document.documentElement.dataset.panel !== 'chapter-1') {
      armed = false;
      apply();
      return;
    }
    if (armed) {
      apply();
      return;
    }
    void settled().then(() => {
      if (ticket !== epoch) return;
      armed = true;
      apply();
    });
  };

  /* One frame per gesture burst: the copy moves under the pointer and leaves
     without a panel event, so the switch must follow the scroll. */
  let frame = 0;
  const sync = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };

  document.addEventListener('merlin:panel', () => reflect());
  document.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', reflect);
  void document.fonts.ready.then(reflect);
  reflect();
}
