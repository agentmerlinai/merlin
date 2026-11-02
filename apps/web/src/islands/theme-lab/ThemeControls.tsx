import { useMemo } from 'react';
import { computeTheme, resolveCode, resolveFonts } from '@merlin/theme/tokens';
import { Icon } from '../../components/Icon';
import { KIT_VIEWS, PRESET_VIEWS, RADIUS_VIEWS, TYPE_VIEWS, type PresetView } from './options';
import { resetTheme, selectIconKit, selectPreset, selectRadius, setHues, useThemeStudio } from './store';

const roles = ['error', 'warning', 'success'] as const;

/* The design-system page's full control set. The home kit section composes
   the same store and option lists in its own layout; this file keeps one
   control set for the reference page, with native ranges and buttons. */
export function ThemeControls() {
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

  const usePreset = (view: PresetView) => {
    setHues({ primaryHue: view.target.primaryHue, accentHue: view.target.accentHue });
  };

  return (
    <div className="theme-controls">
      <div className="presets" role="group" aria-label="Colour presets">
        {PRESET_VIEWS.map((view) => (
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
              <span style={{ background: view.primary }} />
              <span style={{ background: view.accent }} />
            </span>
            {view.label}
          </button>
        ))}
      </div>

      <div className="knobs">
        <label className="knob" htmlFor="primary-hue">
          <span className="knob-head">
            <span className="knob-swatch" aria-hidden="true" style={{ background: 'var(--color-primary-cta-light)' }} />
            <span className="knob-name">Primary hue</span>
            <output className="knob-value" id="primary-hue-value" htmlFor="primary-hue">
              {state.primaryHue}°
            </output>
          </span>
          <input
            className="knob-range"
            id="primary-hue"
            type="range"
            min={0}
            max={360}
            step={1}
            value={state.primaryHue}
            aria-valuetext={`${state.primaryHue} degrees`}
            onChange={(event) => setHues({ primaryHue: Number(event.target.value), accentHue: state.accentHue })}
          />
        </label>
        <label className="knob" htmlFor="accent-hue">
          <span className="knob-head">
            <span className="knob-swatch" aria-hidden="true" style={{ background: 'var(--color-accent-cta-light)' }} />
            <span className="knob-name">Accent hue</span>
            <output className="knob-value" id="accent-hue-value" htmlFor="accent-hue">
              {state.accentHue}°
            </output>
          </span>
          <input
            className="knob-range"
            id="accent-hue"
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

      <label className="typeface" htmlFor="typeface">
        <span className="typeface-name">Typeface</span>
        <select
          className="typeface-select"
          id="typeface"
          value={state.type.preset}
          onChange={(event) => selectPreset(event.target.value)}
        >
          {TYPE_VIEWS.map((view) => (
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
            {KIT_VIEWS.map((view) => (
              <button
                key={view.key}
                className="choice"
                type="button"
                data-kit-choice={view.key}
                aria-pressed={state.iconKit === view.key}
                title={`${view.label} icon kit`}
                onClick={() => selectIconKit(view.key)}
              >
                <Icon name="icon-cube" kit={view.key} className="choice-glyph" />
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <div className="kit-row" role="group" aria-label="Corner style">
          <span className="kit-name">Corners</span>
          <div className="kit-choices">
            {RADIUS_VIEWS.map((view) => (
              <button
                key={view.key}
                className="choice"
                type="button"
                data-radius={view.key}
                aria-pressed={state.radius === view.key}
                title={`${view.label} corners`}
                onClick={() => selectRadius(view.key)}
              >
                <span className="choice-radius" aria-hidden="true" style={{ borderRadius: view.sample }} />
                {view.label}
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

      <div className="lab-actions">
        <button className="theme-reset" type="button" onClick={resetTheme} title="Restore the default colour, type, kit, and corners">
          Reset
        </button>
      </div>
    </div>
  );
}
