import type { ReactNode } from 'react';
import { BOARD, NoteFace, type Card } from './StoryCard';
import { Icon } from '../../../components/Icon';

/* One proxy per boundary, and one per item where a boundary carries several.
   Each face is the appearance the work item has on the surface it is leaving,
   so the flight reads as that object moving and changing shape, not as a card
   pasted over the app. Two boundaries carry one proxy per work item: the canvas
   (3) and the rota (4). They name each proxy with the item's `data-item` key, so
   a note meets its own bar instead of the one in the same slot (see the seam
   block for both timing tables). */
const FACES: Record<number, ReactNode> = {
  1: (
    <span className="story-face story-face--artifact">
      <span className="artifact-head">
        <Icon name="icon-file-text" className="icon artifact-mark" />
        <p className="artifact-title">Tuesday launch</p>
        <span className="artifact-actions">
          <Icon name="icon-pencil-simple" className="icon" />
          <Icon name="icon-download-simple" className="icon" />
        </span>
      </span>
      <span className="artifact-line"><span className="artifact-num">1</span>Provision the VM</span>
      <span className="artifact-line"><span className="artifact-num">2</span>Verify access</span>
      <span className="artifact-line"><span className="artifact-num">3</span>Dry run at 09:00</span>
    </span>
  ),
  2: (
    <span className="story-face story-face--doc">
      <span className="artifact-head">
        <Icon name="icon-file-text" className="icon artifact-mark" />
        <p className="artifact-title">Tuesday launch</p>
        <span className="artifact-actions">
          <Icon name="icon-pencil-simple" className="icon" />
          <Icon name="icon-download-simple" className="icon" />
        </span>
      </span>
      <span className="collab-line"><span className="collab-num">1</span><span className="collab-text">Provision the VM.</span></span>
      <span className="collab-line collab-line--human"><span className="collab-num">2</span><span className="collab-text">Verify team access and MFA.</span></span>
      {/* The doc leaves with the work done: every line typed and the one cursor
          that never left still on its line. The flag and the highlights belong
          to the edit, which is over. */}
      <span className="collab-line collab-line--merlin"><span className="collab-num">3</span><span className="collab-text">Dry run the rollout at 09:00.</span><span className="collab-caret collab-caret--merlin" /></span>
      <span className="collab-line"><span className="collab-num">4</span><span className="collab-text">Freeze the change window.</span></span>
      <span className="collab-line"><span className="collab-num">5</span><span className="collab-text">Page the on-call.</span></span>
    </span>
  ),
  4: (
    <span className="story-face story-face--slot">
      <span className="slot-who">08–16</span>
    </span>
  ),
  5: (
    <span className="story-face story-face--record">
      <span className="record-face-line">Access ends Fri · 3 of 4</span>
      <span className="record-face-audit">Maya approved · Undo</span>
    </span>
  )
};

const SEAMS = [1, 2, 5] as const;

/* The two multi-item boundaries share one proxy: the note the item wears on the
   surface it leaves is the same note on both. `data-face` lets the paper recipe
   and the plate edge be declared once for every note carrier. */
function NoteCarrier({ seam, card }: { seam: 3 | 4; card: Card }) {
  return (
    <span className="story-carrier" data-seam={seam} data-item={card.key} data-face="note" aria-hidden="true">
      <span className="story-face story-face--note"><NoteFace label={card.label} /></span>
    </span>
  );
}

export function StoryCarrier() {
  return (
    <>
      {SEAMS.map((seam) => (
        <span className="story-carrier" data-seam={seam} aria-hidden="true" key={seam}>
          {FACES[seam]}
        </span>
      ))}
      {/* The gap is the rota's protagonist: it leaves last and lands on the bar
          the plan's own scene then drags. */}
      <span className="story-carrier" data-seam={4} data-item="access" aria-hidden="true" key="4-access">
        {FACES[4]}
      </span>
      {BOARD.map((card) => <NoteCarrier key={`3-${card.key}`} seam={3} card={card} />)}
      {BOARD.map((card) => <NoteCarrier key={`4-${card.key}`} seam={4} card={card} />)}
    </>
  );
}
