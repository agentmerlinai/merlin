import { useMemo } from 'react';
import { computeTheme, snapTheme, TYPE_PRESETS, resolveCode, resolveFonts } from '@merlin/theme/tokens';
import { ICON_KITS, RADIUS_STYLES, type IconKit, type RadiusStyle } from '@merlin/theme/kits';
import { Icon } from '../../components/Icon';
import { PRESETS, type PresetKey } from './presets';
import { resetTheme, selectIconKit, selectPreset, selectRadius, setHues, useThemeStudio } from './store';

const roles = ['error', 'warning', 'success'] as const;

const KIT_VIEWS = Object.entries(ICON_KITS) as [IconKit, (typeof ICON_KITS)[IconKit]][];
const RADIUS_VIEWS = Object.entries(RADIUS_STYLES) as [RadiusStyle, (typeof RADIUS_STYLES)[RadiusStyle]][];

type Layout = 'section' | 'panel';

/* One set of controls serves the page chrome and the design-system page. The
   layout only changes ids and the footer: the generator stays in one place. */
export function ThemeControls({
  layout = 'section',
  designSystemLink = false,
}: {
  layout?: Layout;
  designSystemLink?: boolean;
}) {
  const state = useThemeStudio();
  const fonts = useMemo(() => resolveFonts(state.type), [state.type]);
  const code = useMemo(() => resolveCode(state.type), [state.type]);
  const theme = useMemo(
    () =>
      computeTheme({
        primaryHue: state.primaryHue,
        accentHue: state.accentHue,
        fonts,
        code,
        radius: state.radius,
      }),
    [state.primaryHue, state.accentHue, fonts, code, state.radius]
  );
  const id = (name: string) => `${layout === 'panel' ? 'brand-' : ''}${name}`;

  const presetViews = useMemo(
    () =>
      (Object.entries(PRESETS) as [PresetKey, (typeof PRESETS)[PresetKey]][]).map(([key, preset]) => {
        const target = snapTheme(preset.primaryHue, preset.accentHue);
        const { primitives } = computeTheme(target);
        return {
          key,
          label: preset.label,
          target,
          primary: primitives['--color-primary-cta-light'],
          accent: primitives['--color-accent-cta-light'],
        };
      }),
    []
  );

  const typePresetViews = useMemo(
    () =>
      Object.entries(TYPE_PRESETS).map(([key, preset]) => ({
        key,
        label: preset.label,
      })),
    []
  );

  const usePreset = (view: (typeof presetViews)[number]) => {
    setHues({ primaryHue: view.target.primaryHue, accentHue: view.target.accentHue });
  };

  return (
    <div className="theme-controls" data-layout={layout}>
      <div className="presets" role="group" aria-label="Colour presets">
        {presetViews.map((view) => (
          <button
            key={view.key}
            className="choice"
            type="button"
            data-preset={view.key}
            aria-pressed={
              view.target.primaryHue === state.primaryHue && view.target.accentHue === state.accentHue
            }
            title={view.target.snapped ? `Snapped to ${view.target.primaryHue}° / ${view.target.accentHue}°` : undefined}
            onClick={() => usePreset(view)}
          >
            <span className="swatch-pair" aria-hidden="true">
              <span data-preset-swatch="primary" style={{ background: view.primary }} />
              <span data-preset-swatch="accent" style={{ background: view.accent }} />
            </span>
            {view.label}
          </button>
        ))}
      </div>

      <div className="knobs">
        <label className="knob" htmlFor={id('primary-hue')}>
          <span className="knob-head">
            <span
              className="knob-swatch"
              data-knob-swatch="primary"
              aria-hidden="true"
              style={{ background: theme.primitives['--color-primary-cta-light'] }}
            />
            <span className="knob-name">Primary hue</span>
            <output className="knob-value" id={id('primary-hue-value')} htmlFor={id('primary-hue')}>
              {state.primaryHue}°
            </output>
          </span>
          <input
            className="knob-range"
            id={id('primary-hue')}
            type="range"
            min={0}
            max={360}
            step={1}
            value={state.primaryHue}
            aria-valuetext={`${state.primaryHue} degrees`}
            onChange={(event) => setHues({ primaryHue: Number(event.target.value), accentHue: state.accentHue })}
          />
        </label>
        <label className="knob" htmlFor={id('accent-hue')}>
          <span className="knob-head">
            <span
              className="knob-swatch"
              data-knob-swatch="accent"
              aria-hidden="true"
              style={{ background: theme.primitives['--color-accent-cta-light'] }}
            />
            <span className="knob-name">Accent hue</span>
            <output className="knob-value" id={id('accent-hue-value')} htmlFor={id('accent-hue')}>
              {state.accentHue}°
            </output>
          </span>
          <input
            className="knob-range"
            id={id('accent-hue')}
            type="range"
            min={0}
            max={360}
            step={1}
            value={state.accentHue}
            aria-valuetext={`${state.accentHue} degrees`}
            onChange={(event) => setHues({ primaryHue: state.primaryHue, accentHue: Number(event.target.value) })}
          />
        </label>
      </div>

      <label className="typeface" htmlFor={id('typeface')}>
        <span className="typeface-name">Typeface</span>
        <select
          className="typeface-select"
          id={id('typeface')}
          value={state.type.preset}
          onChange={(event) => selectPreset(event.target.value)}
        >
          {typePresetViews.map((view) => (
            <option key={view.key} value={view.key}>
              {view.label}
            </option>
          ))}
        </select>
      </label>

      <div className="theme-kits">
        <div className="kit-row" role="group" aria-label="Icon kit">
          <span className="kit-name">Icon kit</span>
          <div className="kit-choices">
            {KIT_VIEWS.map(([key, kit]) => (
              <button
                key={key}
                className="choice"
                type="button"
                data-kit-choice={key}
                aria-pressed={state.iconKit === key}
                title={`${kit.label} icon kit`}
                onClick={() => selectIconKit(key)}
              >
                <Icon name="icon-cube" kit={key} className="choice-glyph" />
                {kit.label}
              </button>
            ))}
          </div>
        </div>

        <div className="kit-row" role="group" aria-label="Corner style">
          <span className="kit-name">Corners</span>
          <div className="kit-choices">
            {RADIUS_VIEWS.map(([key, style]) => (
              <button
                key={key}
                className="choice"
                type="button"
                data-radius={key}
                aria-pressed={state.radius === key}
                title={`${style.label} corners`}
                onClick={() => selectRadius(key)}
              >
                <span
                  className="choice-radius"
                  aria-hidden="true"
                  style={{ borderRadius: style.scale.md }}
                />
                {style.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="token-tape" aria-hidden="true">
        <div className="tape-row">
          <span className="tape-name">Primary</span>
          <span className="tape" data-tape="primary">
            {theme.palettes.primary
              .filter((shade) => !shade.isCTA)
              .map((shade) => (
                <span key={shade.name} style={{ background: shade.hex }} />
              ))}
          </span>
        </div>
        <div className="tape-row">
          <span className="tape-name">Accent</span>
          <span className="tape" data-tape="accent">
            {theme.palettes.accent
              .filter((shade) => !shade.isCTA)
              .map((shade) => (
                <span key={shade.name} style={{ background: shade.hex }} />
              ))}
          </span>
        </div>
        <div className="tape-row">
          <span className="tape-name">Status</span>
          <span className="tape" data-tape="semantics">
            {roles.map((role) => (
              <span key={role} style={{ background: `var(--color-${role})` }} title={role} />
            ))}
          </span>
        </div>
      </div>

      {designSystemLink && (
        <div className="lab-actions">
          <button className="brand-reset" type="button" onClick={resetTheme} title="Restore default colour and type">
            Reset
          </button>
          <a className="lab-ds" href="/design-system/">
            Design system
          </a>
        </div>
      )}
    </div>
  );
}
