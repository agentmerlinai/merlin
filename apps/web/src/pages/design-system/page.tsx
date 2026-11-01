import { Badge } from '@merlin/ui';
import { SiteLayout } from '../../components/SiteLayout';
import { ThemeLab } from '../../islands/theme-lab/ThemeLab';
import { Foundations } from './Foundations';
import { showcases } from './showcases';

export default function DesignSystemPage() {
  return (
    <SiteLayout current="design-system">
      <section className="ds-hero">
        <div className="wrap">
          <p className="eyebrow">Merlin design system</p>
          <h1>One kit. Both themes.</h1>
          <p className="hero-sub">
            The components and tokens behind the Merlin surface. The page is the preview:
            move the hues and every role, surface, and state follows.
          </p>
          <div className="ds-hero-meta">
            <Badge variant="success" dot>React 19</Badge>
            <Badge variant="primary">CSS Modules</Badge>
            <Badge variant="accent">Semantic tokens</Badge>
          </div>
        </div>
      </section>

      <section className="section ds-section" id="theme">
        <div className="wrap">
          <p className="eyebrow">Live theme</p>
          <h2>The page is the preview.</h2>
          <p className="section-sub">Two hues rewrite the token layer. Every component on this page reads the same roles.</p>
          <div className="theme-lab surface-panel" data-island="lab">
            <ThemeLab />
          </div>
        </div>
      </section>

      <section className="section ds-section" id="foundations">
        <div className="wrap">
          <p className="eyebrow">Foundations</p>
          <h2>Roles, scales, and space.</h2>
          <Foundations />
        </div>
      </section>

      <section className="section ds-section" id="components">
        <div className="wrap">
          <p className="eyebrow">Components</p>
          <h2>The kit in use.</h2>
          <p className="section-sub">Every component below imports the public API. The gallery is the contract.</p>
          <div className="ds-showcases">
            {showcases.map((showcase) => (
              <article className="ds-showcase surface-panel" id={showcase.id} key={showcase.id}>
                <header className="ds-showcase-head">
                  <h3>{showcase.title}</h3>
                  <p>{showcase.description}</p>
                </header>
                <div className="ds-showcase-body">{showcase.render()}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section ds-section" id="accessibility">
        <div className="wrap">
          <p className="eyebrow">Accessibility</p>
          <h2>Visible, legible, still.</h2>
          <div className="ds-a11y">
            <article className="surface-panel ds-a11y-card">
              <h3>Focus is never hidden.</h3>
              <p>The shared focus ring is a token. Every interactive control uses it; the theme lab sliders keep native keyboard behaviour.</p>
            </article>
            <article className="surface-panel ds-a11y-card">
              <h3>Contrast is computed.</h3>
              <p>The token generator solves CTA text and reports status-hue collisions. The lab surfaces those diagnostics instead of hiding them.</p>
            </article>
            <article className="surface-panel ds-a11y-card">
              <h3>Reduced motion is a first-class state.</h3>
              <p>The landing story stops scrubbing, the carrier snaps, and the gallery animations stop. No motion is required to read the page.</p>
            </article>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
