import { DEFAULT_THEME, SPACE_STEPS, TYPE_BASE, TYPE_INDICES, TYPE_RATIO, TYPE_STEPS, computeTheme } from '@merlin/theme/tokens';
import { ICON_KITS, RADIUS_KEYS, RADIUS_STYLES, type IconKit } from '@merlin/theme/kits';
import { Icon } from '../../components/Icon';

const theme = computeTheme(DEFAULT_THEME);

const SEMANTIC = [
  '--bg-page', '--bg-surface', '--bg-muted', '--text-primary',
  '--text-secondary', '--text-muted', '--color-primary', '--color-accent',
  '--color-error', '--color-warning', '--color-success', '--border-default', '--focus-ring',
];

const ICONS = ['icon-chat-circle', 'icon-file-text', 'icon-cube', 'icon-database', 'icon-shield-check', 'icon-signature', 'icon-cpu', 'icon-users-three'];
const KITS = Object.entries(ICON_KITS) as [IconKit, (typeof ICON_KITS)[IconKit]][];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="ds-block" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Foundations() {
  return (
    <div className="ds-foundations">
      <Section id="colour" title="Colour roles">
        <p className="ds-note">Every role is computed from the two brand hues. The same role has a light and a dark value.</p>
        <div className="ds-table" role="table" aria-label="Semantic colour roles">
          <div className="ds-table-row ds-table-head" role="row">
            <span role="columnheader">Token</span><span role="columnheader">Light</span><span role="columnheader">Dark</span>
          </div>
          {SEMANTIC.map((token) => (
            <div className="ds-table-row" role="row" key={token}>
              <code role="cell">{token}</code>
              <span className="ds-token" role="cell">
                <span className="ds-chip" aria-hidden="true" style={{ background: theme.semanticLight[token] }} />
                <code>{theme.semanticLight[token]}</code>
              </span>
              <span className="ds-token" role="cell">
                <span className="ds-chip" aria-hidden="true" style={{ background: theme.semanticDark[token] }} />
                <code>{theme.semanticDark[token]}</code>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="scales" title="Palettes">
        <p className="ds-note">Each role owns a generated scale. The CTA pair sits outside the ramp and is solved for contrast.</p>
        <div className="ds-scales">
          {(['primary', 'accent', 'neutral', 'error', 'warning', 'success'] as const).map((role) => (
            <div className="ds-scale" key={role}>
              <span className="ds-scale-name">{role}</span>
              <div className="ds-swatches" aria-hidden="true">
                {theme.palettes[role].filter((shade) => !shade.isCTA).map((shade) => (
                  <span key={shade.name} className="ds-swatch" style={{ background: shade.hex }} title={`${role}-${shade.name} ${shade.hex}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="Type and space">
        <div className="ds-type">
          {TYPE_STEPS.map((step, i) => (
            <div className="ds-type-row" key={step}>
              <code>text-{step}</code>
              <span style={{ fontSize: `${(TYPE_BASE * TYPE_RATIO ** TYPE_INDICES[i]).toFixed(1)}px` }}>Build collaborative agent experiences.</span>
            </div>
          ))}
        </div>
        <div className="ds-space">
          {SPACE_STEPS.map((step) => (
            <div className="ds-space-row" key={step}>
              <code>{step * 4}px</code>
              <span className="ds-space-bar" style={{ width: `${step * 4}px` }} />
            </div>
          ))}
        </div>
        <div className="ds-radii">
          {Object.entries(RADIUS_STYLES).map(([key, style]) => (
            <div className="ds-radius-row" key={key}>
              <code className="ds-radius-name">{style.label}</code>
              {RADIUS_KEYS.map((step) => (
                <div className="ds-radius" key={step}>
                  <span className="ds-radius-box" style={{ borderRadius: style.scale[step] }} />
                  <code>{step} · {style.scale[step]}</code>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section id="kits" title="Icon kits">
        <p className="ds-note">One canonical glyph name, three drawings. The studio swaps the kit without changing the markup.</p>
        <div className="ds-kits">
          {KITS.map(([key, kit]) => (
            <div className="ds-kit" key={key}>
              <h3>{kit.label}</h3>
              <div className="ds-icons">
                {ICONS.map((name) => (
                  <span className="ds-icon" key={name}>
                    <Icon name={name} kit={key} className="ds-kit-icon" />
                    <code>{name.replace('icon-', '')}</code>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="surfaces" title="Surfaces and motion">
        <div className="ds-surfaces">
          <div className="surface-panel ds-surface">panel</div>
          <div className="surface-well ds-surface">well</div>
          <div className="surface-plate ds-surface">plate</div>
        </div>
        <p className="ds-note">Depth is one fill step plus one shadow token. Components never invent their own shadow or fill.</p>
        <div className="ds-motion">
          <span className="ds-motion-dot" aria-hidden="true" />
          <span>one hand curve · reduced motion removes the move</span>
        </div>
      </Section>
    </div>
  );
}
