import type { ReactNode } from 'react';
import { BrandControl } from '../islands/theme-lab/BrandControl';
import { ThemeToggle } from '../islands/theme-toggle/ThemeToggle';

type PageId = 'home' | 'design-system';

const homeLink = (current: PageId, hash: string) => (current === 'home' ? hash : `/${hash}`);

export function SiteLayout({ current, children }: { current: PageId; children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href={current === 'home' ? '#top' : '/'} aria-label="Merlin home">
            <svg className="brand-mark" viewBox="0 0 828 740" aria-hidden="true">
              <use href="#merlin-mark" />
            </svg>
            <span>Merlin</span>
          </a>

          {/* The deck owns its own contents: on home the nav states where the
              reader is instead of listing nine panels. */}
          {current === 'home' ? (
            <div className="pager" data-island="pager" />
          ) : (
            <nav className="nav-links" aria-label="Primary">
              <a href={homeLink(current, '#chapter-6')}>The base</a>
              <a href={homeLink(current, '#tailor')}>Tailor</a>
              <a href="/design-system/" aria-current={current === 'design-system' ? 'page' : undefined}>
                Design system
              </a>
            </nav>
          )}

          <div className="nav-actions">
            <div data-island="brand">
              <BrandControl />
            </div>
            <div data-island="theme">
              <ThemeToggle />
            </div>
          </div>
        </div>
        {/* The spine spans the nav's edge; the island fills one mark on it, so
            the mark and the contents read the same panel list. */}
        {current === 'home' && <div className="pager-spine" data-pager-spine aria-hidden="true" />}
      </header>

      <main id="main">{children}</main>
    </>
  );
}
