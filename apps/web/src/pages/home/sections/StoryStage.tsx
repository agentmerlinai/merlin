import { StoryCarrier } from './StoryCarrier';
import { StoryPane1 } from './StoryPane1';
import { StoryPane2 } from './StoryPane2';
import { StoryPane3 } from './StoryPane3';
import { StoryPane4 } from './StoryPane4';
import { StoryPane5 } from './StoryPane5';
import { StoryPane6 } from './StoryPane6';

/* The frame is a character, not the stage's skin. Chapters 1–5 live inside the
   app card; chapter 6 leaves it with the plan and draws the perimeter instead.
   The card is a sibling of the viewport, so it can fade without fading the
   panes, and its shadow is never clipped by the viewport's overflow. */
export function StoryStage() {
  return (
    <div className="story-frame">
      <aside className="story-stage" data-story-stage aria-hidden="true">
        <StoryPane1 />
        <StoryPane2 />
        <StoryPane3 />
        <StoryPane4 />
        {/* The base is the plan's substrate: it sits under the plan, so the
            plan's field clears onto it instead of crossfading into a hole. */}
        <StoryPane6 />
        <StoryPane5 />
        <StoryCarrier />
      </aside>
      <span className="story-card" aria-hidden="true" />
    </div>
  );
}
