import { BOARD, StoryCard } from './StoryCard';
import { Icon } from '../../../components/Icon';

/* The canvas is the board: one note is one sheet of the same paper the doc was,
   so the seam's shrink is a scale, not a squash. The cards live in `BOARD`
   (StoryCard.tsx) because the seam carries each of them and the rota grows an
   entry for each; the board is only where they are drawn. */
export function StoryPane3() {
  return (
    <div className="story-pane" data-pane={3}>
      <div className="collab-chrome">
        <Icon name="icon-frame-corners" className="icon" />
        <span className="collab-name">Launch canvas</span>
      </div>
      <div className="pane-body surface-well collab-body--canvas">
        <svg className="collab-grid" aria-hidden="true"><rect width="100%" height="100%" fill="url(#collab-dots)" /></svg>
        <div className="collab-frame">
          <span className="collab-frame-label">Tuesday launch</span>
          {/* A link is one gesture: its two legs and its pen share one clock and
              one pen track, so the two hands draw at one speed. A pen draws on
              the frame; the hand that draws B leaves the exact pixel the resize
              hand ends on, so no cursor is ever doubled. */}
          <span className="collab-wires" aria-hidden="true">
            <span className="collab-link collab-link--a">
              <span className="collab-wire collab-wire--a1" />
              <span className="collab-wire collab-wire--a2" />
              <span className="collab-pointer collab-pointer--human collab-pointer--draw"><Icon name="icon-cursor" className="icon" /><span className="collab-pointer-name presence presence--human"><Icon name="icon-user" className="icon" />Maya</span></span>
            </span>
            <span className="collab-link collab-link--b">
              <span className="collab-wire collab-wire--b1" />
              <span className="collab-wire collab-wire--b2" />
              <span className="collab-arrow-head" />
              <span className="collab-pointer collab-pointer--merlin collab-pointer--arrow"><Icon name="icon-cursor" className="icon" /><span className="collab-pointer-name presence presence--merlin"><Icon name="icon-robot" className="icon" />Merlin</span></span>
            </span>
          </span>
          {BOARD.map((card) => <StoryCard key={card.key} card={card} />)}
        </div>
        <span className="collab-zoom">100%</span>
      </div>
    </div>
  );
}
