import { vars } from '../../../components/vars';
import { Icon } from '../../../components/Icon';

/* One card is paper plus the hand on it. The hold wrapper is the card's only
   presence fact: its fade drives the knobs and the hand together, so a handle
   can never appear without the hand that owns it. A card with no hold (a link
   target) is bare paper. Geometry stays in CSS, keyed by the card's name; the
   motion is an act the card carries (see `ACTS`). */
export type Hand = 'maya' | 'merlin';
export type Identity = 'human' | 'merlin';
export type BoardKey = 'cutover' | 'rollback' | 'dryrun';
export type Card = { key: BoardKey; label: string; hold?: Hand; arrive?: number };

/* The board is made of the document: every card is a note, and the note the
   doc became sits among them. Order is paint order and the order the tiles
   leave the board; the seam carries one proxy per row and the calendar entry
   each tile lands on reads the same row, so a name is written once. */
export const BOARD: Card[] = [
  { key: 'cutover', label: 'Cutover', hold: 'maya', arrive: 2 },
  { key: 'rollback', label: 'Rollback' },
  { key: 'dryrun', label: 'Dry run', hold: 'merlin' }
];

/* An act is one hand's whole presence on the board: the window it is on the
   paper, and the route it walks while it is there. The route is the readable
   truth — it takes the paper, the paper is dragged under it, it takes the point
   it pulls, the paper grows, then it leaves for the edge a link starts from —
   and the sheet's own tracks are read off that route's beats in CSS (see the
   canvas rule), so the paper can never be moved by a grip that is not on it.
   `hand` is `[start, span]` as a fraction of the scene; a time is written once,
   in one unit, for both hands. `path` is the route across the paper: where the
   hand starts, the paper it takes, the point it pulls, the edge centre. A hand
   with fewer stops repeats its last one. */
export type Act = {
  hand: [number, number];
  path: [string, string][];
};

const HANDS: Record<Hand, {
  name: string; icon: string; identity: Identity; act: Act;
}> = {
  maya: {
    name: 'Maya', icon: 'icon-user', identity: 'human',
    act: {
      /* A carry takes the paper (the offset is a nudge, not a second position),
         drags it in, and lets go where the calendar's seam is cut: it has no
         point to pull and no second edge to walk to. */
      hand: [.06, .28],
      path: [['calc(62% + 9px)', 'calc(52% - 8px)'], ['62%', '52%']]
    }
  },
  merlin: {
    name: 'Merlin', icon: 'icon-robot', identity: 'merlin',
    act: {
      /* A resize is a carry and then a pull: the same route, one stop further.
         The hand drags the sheet in from its body, walks to the corner knob,
         holds it through the growth, then slides to the edge centre the link
         leaves from. */
      hand: [.50, .32],
      path: [
        ['calc(62% + 9px)', 'calc(52% - 8px)'],
        ['62%', '52%'],
        ['100%', '100%'],
        ['50%', '100%']
      ]
    }
  }
};

/* The act reaches CSS as one block of custom properties. No rule forks per
   hand: `--act-hand` is when the hand is on the paper, `--ptr-*` its route. */
const actVars = (act: Act) => {
  const stop = (at: number) => act.path[at] ?? act.path[act.path.length - 1];
  return vars({
    '--act-hand': act.hand[0], '--act-hand-span': act.hand[1],
    '--ptr-1x': stop(0)[0], '--ptr-1y': stop(0)[1],
    '--ptr-2x': stop(1)[0], '--ptr-2y': stop(1)[1],
    '--ptr-3x': stop(2)[0], '--ptr-3y': stop(2)[1],
    '--ptr-4x': stop(3)[0], '--ptr-4y': stop(3)[1]
  });
};

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;

function Hold({ hand }: { hand: Hand }) {
  const { name, icon, identity } = HANDS[hand];
  return (
    <span className="collab-hold" data-hand={hand} aria-hidden="true">
      <span className={`collab-select collab-select--${identity}`}>
        <span className="collab-knobs">
          {CORNERS.map((corner) => <span key={corner} className={`collab-knob collab-knob--${corner}`} />)}
        </span>
      </span>
      <span className={`collab-pointer collab-pointer--${identity}`}>
        <Icon name="icon-cursor" className="icon" />
        <span className={`collab-pointer-name presence presence--${identity}`}>
          <Icon name={icon} className="icon" />{name}
        </span>
      </span>
    </span>
  );
}

/* The sheet's face: a name and the written lines. Blank paper below the lines
   is what a sticky note is - room for the next line. One face is drawn in three
   places - the board, the proxy that carries a tile off it, and the calendar
   entry it lands on - so the seam has no frame where two appearances disagree. */
export function NoteFace({ label }: { label: string }) {
  return (
    <>
      <span className="collab-note-label">{label}</span>
      <span className="collab-note-line"><span className="collab-note-bar" /></span>
      <span className="collab-note-line"><span className="collab-note-bar collab-note-bar--short" /></span>
      <span className="collab-note-line"><span className="collab-note-bar collab-note-bar--tiny" /></span>
    </>
  );
}

/* An entry is a tile that has landed: the week's cell holds the board's own
   face on the board's own paper. It lists the canvas seam's destination and
   keeps the tile's item key, so the seam pairs the two by row and a name is
   written once. The week then hands the same item on: an entry is the source
   of the rota's seam, so the key carries the note into the plan's own bar. */
export function Entry({ card }: { card: Card }) {
  return (
    <span className="entry surface-plate" data-arrive={3} data-anchor={4} data-item={card.key}>
      <NoteFace label={card.label} />
    </span>
  );
}

/* A tile is a source for the seam that leaves the board (`data-anchor`) and, for
   the one the doc became, the destination of the seam before it (`data-arrive`).
   `data-item` is the tile's row in the seam's timing table. `data-act` marks a
   card a hand touches: the scene's one motion list reads it, and its vars are
   the act. */
export function StoryCard({ card }: { card: Card }) {
  const held = card.hold ? HANDS[card.hold] : undefined;
  return (
    <div
      className="collab-note surface-plate"
      data-item={card.key}
      data-arrive={card.arrive}
      data-act={held ? '' : undefined}
      data-anchor={3}
      style={held ? actVars(held.act) : undefined}
    >
      {card.hold && <Hold hand={card.hold} />}
      <NoteFace label={card.label} />
    </div>
  );
}
