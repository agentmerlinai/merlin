import { repo } from '../../../data/project';
import { StoryBeats } from './StoryBeats';
import { StoryStage } from './StoryStage';

export function HeroSection() {
  return (
    <section className="hero" id="top" data-island="hero" data-label="Intro" data-index="00">
      <div className="hero-bg" aria-hidden="true" />
      {/* The story is a runway on the page's only scroller. The stage and the
          copy are sticky children, so pinning needs no scrollport of its own.
          A nested deck here would own the wheel and the keys, and leaving the
          last chapter would depend on scroll chaining, which keyboard input
          never does and a wheel gesture only does once it restarts. */}
      {/* The deck rests on panel tops: the intro is the first panel, and its
          point is the page top. */}
      <span className="snap-point" aria-hidden="true" />
      <div className="wrap hero-story">
        {/* Source order is the mobile composition: the agent sits on top and
            every copy holds under it. The desktop grid assigns its areas
            explicitly, so this order serves neither column over the other. */}
        {/* The stage is decorative: the copy column carries the narrative. */}
        <StoryStage />
        <div className="story-intro">
          {/* One body owns the intro's center line: the same stage-height box
              the chapters use, so the invitation and the story read on one
              optical line. The intro itself still fills the first page. */}
          <div className="story-intro-body">
            <span className="kicker">Open source · self-hosted · yours</span>
            <h1>Build collaborative agent experiences.</h1>
            <p className="hero-sub">
              Merlin is a minimal base for agent apps. The agent loop, tools, UI, auth, and
              live state ship in one process. People and agents edit the same
              record, and every change is cryptographically signed.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" href={repo.star} target="_blank" rel="noopener">
                <svg className="icon" viewBox="0 0 98 96" fill="currentColor" aria-hidden="true"><use href="#gh-logo" /></svg>
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
        <StoryBeats />
      </div>
    </section>
  );
}
