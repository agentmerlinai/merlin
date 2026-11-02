import { KitBench } from '../../../islands/kit/KitBench';

/* The story's one hands-on section. It is the first standalone panel after
   the hero: its own numeral, no clock, no story stage behind it, and no paper
   to hide one. It uses the same section shell as the ending, so the page grid
   stays continuous above and below the card. */
export function KitSection() {
  return (
    <section className="section kit" id="kit" data-label="The kit" data-index="07" aria-labelledby="kit-title">
      <span className="snap-point" aria-hidden="true" />
      <div className="wrap">
        <div className="kit-bench surface-panel" data-island="kit">
          <KitBench />
        </div>
      </div>
    </section>
  );
}
