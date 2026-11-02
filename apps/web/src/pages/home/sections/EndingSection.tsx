import type { CSSProperties } from 'react';
import { Icon } from '../../../components/Icon';
import { project, repo } from '../../../data/project';

/* The tree is the argument: seven files the reader could write. The marks
   cascade in CSS by index, so the list length and the `--i` phase are one
   thing; keep them here, not in the markup. */
const ROWS = [
  { mark: 'M', icon: 'icon-cpu', path: 'loop.ts', note: 'the agent' },
  { mark: 'M', icon: 'icon-database', path: 'context/', note: 'per-turn assembly' },
  { mark: 'A', icon: 'icon-wrench', path: 'tools/', note: 'pdf · erp · stock' },
  { mark: 'A', icon: 'icon-shield-check', path: 'hooks/', note: 'before-send' },
  { mark: 'D', icon: 'icon-puzzle-piece', path: 'extensions/', note: 'quote-kit' },
  { mark: 'M', icon: 'icon-monitor', path: 'views/', note: 'approval.tsx' },
  { mark: 'M', icon: 'icon-paint-brush', path: 'brand.css', note: 'your palette' },
] as const;

const DOORS = [
  { href: 'star', label: 'Star on GitHub', icon: 'gh-logo', primary: true },
  { href: 'fork', label: 'Fork it', icon: 'icon-git-fork', primary: false },
  /* Two doors: the star and the fork. Both land on the same repo. */
] as const;

/* One panel closes the deck: the argument and the invitation share a screen,
   so the reader meets one ending instead of two. The copy names what the tree
   shows and then hands it over; the stage note sits under the doors, where
   the reader decides. */
export function EndingSection() {
  return (
    <section className="section close" id="tailor" data-label="Tailor" data-index="08">
      {/* Panel point: the deck rests on panel tops only. */}
      <span className="snap-point" aria-hidden="true" />
      <div className="wrap">
        <p className="eyebrow"><Icon name="icon-puzzle-piece" className="icon" />The shape</p>
        <div className="end-grid">
          <div className="end-copy">
            <h2>Yours to break.</h2>
            {/* Who makes it and what it stands on. The association is prose, not
                a badge: a reader who wants the engine can follow the one link. */}
            <p className="section-sub end-note">
              Merlin is a research project by the{' '}
              <svg className="goat-mark end-goat" viewBox="0 0 90.6 90.6" aria-hidden="true"><use href="#goatdb-mark" /></svg>
              <a className="end-link" href={project.teamUrl} target="_blank" rel="noopener">GoatDB team</a>.
              It is pre-alpha and under active development — come over to GitHub
              and lend a hand. Interfaces, APIs, and behavior will change.
            </p>
          </div>
          <div className="repo surface-panel">
            {/* The head states one thing: which checkout, on which branch. Two
                bare words in the panel's corners read as two unrelated labels,
                so each carries the glyph that names its role. */}
            <div className="repo-head">
              <span className="repo-name">
                <Icon name="icon-folder-simple" className="icon" />
                checkout
              </span>
              <span className="repo-branch">
                <Icon name="icon-git-branch" className="icon" />
                main
              </span>
            </div>
            <div className="repo-tree surface-well">
              {ROWS.map((row, index) => (
                <div className="repo-row" key={row.path} style={{ '--i': index } as CSSProperties}>
                  <span className="repo-mark" aria-hidden="true">{row.mark}</span>
                  <Icon name={row.icon} className="icon" />
                  <span className="path">{row.path}</span><span className="note">{row.note}</span>
                </div>
              ))}
            </div>
            <p className="repo-foot surface-plate">
              <Icon name="icon-wifi-slash" className="icon" />
              The whole shape crosses the air gap in one bundle.
            </p>
          </div>
          {/* The doors follow the sentence that explains what they open. */}
          <div className="cta-row end-doors">
            {DOORS.map((door) => (
              <a className={door.primary ? 'btn btn-primary' : 'btn btn-outline'} href={repo[door.href]} target="_blank" rel="noopener" key={door.href}>
                {/* The star door wears the partner's mark; the fork door is a UI glyph. */}
                {door.primary ? <svg className="icon" viewBox="0 0 98 96" fill="currentColor" aria-hidden="true"><use href="#gh-logo" /></svg> : <Icon name={door.icon} />}
                {door.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
