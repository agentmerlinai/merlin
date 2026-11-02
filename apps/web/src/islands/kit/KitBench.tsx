import { useEffect, useState } from 'react';
import { AgentCard, Badge, Button, Input } from '@merlin/ui';
import { Icon } from '../../components/Icon';
import { KIT_VIEWS, PRESET_VIEWS, RADIUS_VIEWS, TYPE_VIEWS, type PresetView } from '../theme-lab/options';
import {
  hydrateStore,
  resetTheme,
  selectIconKit,
  selectPreset,
  selectRadius,
  setHues,
  useThemeStudio,
} from '../theme-lab/store';

type Group = 'colour' | 'type' | 'shape';

const GROUPS: { key: Group; label: string }[] = [
  { key: 'colour', label: 'Colour' },
  { key: 'type', label: 'Type' },
  { key: 'shape', label: 'Shape' },
];

/* Four archetypes — round, angular, geometric, simple — so each tile shows how
   the kit draws rather than one lucky glyph. The row spans the tile, which is
   why the samples are spaced, not huddled at the start. */
const KIT_SAMPLES = ['icon-chat-circle', 'icon-lightning', 'icon-cube', 'icon-check'];

/* The story's one hands-on station. The controls are the content: every choice
   writes the shared brand store, so the whole page — the canvas behind this
   panel included — is the preview. On a phone the three groups become tabs and
   the specimen stacks above them; a short, wide window retires the specimen
   because it has no height left beside the controls. */
export function KitBench() {
  const state = useThemeStudio();
  const [group, setGroup] = useState<Group>('colour');

  useEffect(() => {
    hydrateStore();
  }, []);

  const usePreset = (view: PresetView) => {
    setHues({ primaryHue: view.target.primaryHue, accentHue: view.target.accentHue });
  };

  const preset = PRESET_VIEWS.find(
    (view) => view.target.primaryHue === state.primaryHue && view.target.accentHue === state.accentHue
  );
  const face = TYPE_VIEWS.find((view) => view.key === state.type.preset);
  const kit = KIT_VIEWS.find((view) => view.key === state.iconKit);
  const corners = RADIUS_VIEWS.find((view) => view.key === state.radius);
  const summary = [preset?.label ?? 'Custom', face?.label, kit?.label, corners?.label].filter(Boolean).join(' · ');

  return (
    <>
      <div className="kit-left">
        <header className="kit-head">
          <span className="kit-eyebrow">The kit</span>
          <h2 className="kit-title" id="kit-title">The design system is a base too.</h2>
          <p className="kit-lead">
            Adapt it to your brand, not the other way around. Every surface on this page follows.
          </p>
        </header>

        {/* The specimen is one live surface, not a screenshot. It is a preview,
            so it stays out of the a11y tree; the controls below carry the names. */}
        <div className="kit-specimen" aria-hidden="true" inert>
          <div className="kit-specimen-head">
            <span className="kit-specimen-name"><Icon name="icon-chat-circle" className="icon" />Merlin</span>
            <Badge variant="success" dot>live</Badge>
          </div>
          <AgentCard>
            <AgentCard.Header
              title="Launch assistant"
              icon={<Icon name="icon-robot" className="icon kit-card-glyph" />}
              status={<Badge variant="accent">agent</Badge>}
            />
            <AgentCard.Body>
              <AgentCard.Note>I drafted the rollout and checked access.</AgentCard.Note>
              <AgentCard.Steps>
                <AgentCard.Step status="done" meta="0.8s">
                  <Icon name="icon-file-text" className="icon kit-step-glyph" />
                  <span className="kit-step-label">read · launch-plan.docx</span>
                </AgentCard.Step>
                <AgentCard.Step status="active" meta="now">
                  <Icon name="icon-shield-check" className="icon kit-step-glyph" />
                  <span className="kit-step-label">check · team access</span>
                </AgentCard.Step>
                <AgentCard.Step status="pending">
                  <Icon name="icon-pencil-simple" className="icon kit-step-glyph" />
                  <span className="kit-step-label">draft · rollout</span>
                </AgentCard.Step>
              </AgentCard.Steps>
            </AgentCard.Body>
            <AgentCard.Footer>
              <Button size="sm" variant="ghost">
                <Icon name="icon-arrow-u-up-left" className="icon kit-btn-glyph" />
                Review
              </Button>
              <Button size="sm">
                <Icon name="icon-check" className="icon kit-btn-glyph" />
                Approve
              </Button>
            </AgentCard.Footer>
          </AgentCard>
          <div className="kit-composer">
            <Input id="kit-specimen-prompt" placeholder="Ask for a change..." />
            <Icon name="icon-arrow-right" className="icon kit-composer-send" />
          </div>
          <div className="kit-specimen-tags">
            <Badge variant="primary">
              <Icon name="icon-signature" className="icon kit-tag-glyph" />
              signed
            </Badge>
            <Badge variant="accent">
              <Icon name="icon-hard-drive" className="icon kit-tag-glyph" />
              local
            </Badge>
            <Badge variant="warning">
              <Icon name="icon-clock-countdown" className="icon kit-tag-glyph" />
              review
            </Badge>
          </div>
        </div>
      </div>

      <div className="kit-controls">
        <div className="kit-tabs" role="group" aria-label="Kit options">
          {GROUPS.map((item) => (
            <button
              key={item.key}
              className="kit-tab"
              type="button"
              data-kit-tab={item.key}
              aria-pressed={group === item.key}
              aria-controls={`kit-group-${item.key}`}
              onClick={() => setGroup(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="kit-group" id="kit-group-colour" data-kit-group="colour" data-active={group === 'colour'}>
          <span className="kit-group-name">Colour</span>
          <div className="kit-tiles kit-tiles--presets" role="group" aria-label="Colour presets">
            {PRESET_VIEWS.map((view) => (
              <button
                key={view.key}
                className="kit-tile kit-tile--preset"
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
                <span className="kit-tile-label">{view.label}</span>
              </button>
            ))}
          </div>
          <div className="kit-knobs">
            <label className="knob" htmlFor="kit-primary-hue">
              <span className="knob-head">
                <span className="knob-swatch" aria-hidden="true" style={{ background: 'var(--color-primary-cta-light)' }} />
                <span className="knob-name">Primary</span>
                <output className="knob-value" id="kit-primary-hue-value" htmlFor="kit-primary-hue">
                  {state.primaryHue}°
                </output>
              </span>
              <input
                className="knob-range"
                id="kit-primary-hue"
                type="range"
                min={0}
                max={360}
                step={1}
                value={state.primaryHue}
                aria-valuetext={`${state.primaryHue} degrees`}
                onChange={(event) => setHues({ primaryHue: Number(event.target.value), accentHue: state.accentHue })}
              />
            </label>
            <label className="knob" htmlFor="kit-accent-hue">
              <span className="knob-head">
                <span className="knob-swatch" aria-hidden="true" style={{ background: 'var(--color-accent-cta-light)' }} />
                <span className="knob-name">Accent</span>
                <output className="knob-value" id="kit-accent-hue-value" htmlFor="kit-accent-hue">
                  {state.accentHue}°
                </output>
              </span>
              <input
                className="knob-range"
                id="kit-accent-hue"
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
        </div>

        <div className="kit-group" id="kit-group-type" data-kit-group="type" data-active={group === 'type'}>
          <span className="kit-group-name">Type</span>
          <div className="kit-tiles kit-tiles--types" role="group" aria-label="Typeface">
            {TYPE_VIEWS.map((view) => (
              <button
                key={view.key}
                className="kit-tile kit-tile--type"
                type="button"
                data-typeface={view.key}
                aria-pressed={state.type.preset === view.key}
                title={view.note}
                onClick={() => selectPreset(view.key)}
              >
                <span className="kit-type-sample" aria-hidden="true" style={{ fontFamily: view.stack }}>Aa</span>
                <span className="kit-tile-label">{view.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="kit-group" id="kit-group-shape" data-kit-group="shape" data-active={group === 'shape'}>
          <span className="kit-group-name">Glyphs</span>
          <div className="kit-tiles kit-tiles--kits" role="group" aria-label="Icon kit">
            {KIT_VIEWS.map((view) => (
              <button
                key={view.key}
                className="kit-tile kit-tile--kit"
                type="button"
                data-kit-choice={view.key}
                aria-pressed={state.iconKit === view.key}
                title={`${view.label} icon kit`}
                onClick={() => selectIconKit(view.key)}
              >
                <span className="kit-sample-row" aria-hidden="true">
                  {KIT_SAMPLES.map((name) => (
                    <Icon key={name} name={name} kit={view.key} className="kit-glyph" />
                  ))}
                </span>
                <span className="kit-tile-label">{view.label}</span>
              </button>
            ))}
          </div>
          <span className="kit-group-name">Corners</span>
          <div className="kit-tiles kit-tiles--corners" role="group" aria-label="Corner style">
            {RADIUS_VIEWS.map((view) => (
              <button
                key={view.key}
                className="kit-tile kit-tile--corner"
                type="button"
                data-radius={view.key}
                aria-pressed={state.radius === view.key}
                title={`${view.label} corners`}
                onClick={() => selectRadius(view.key)}
              >
                <span className="kit-corner" aria-hidden="true" style={{ borderRadius: view.sample }} />
                <span className="kit-tile-label">{view.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="kit-actions">
          <p className="kit-state" aria-hidden="true">{summary}</p>
          <button className="theme-reset" type="button" onClick={resetTheme} title="Restore the default colour, type, kit, and corners">
            Reset
          </button>
          <a className="kit-ds" href="/design-system/">
            Open the design system <Icon name="icon-arrow-right" className="icon" />
          </a>
        </div>
      </div>
    </>
  );
}
