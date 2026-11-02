import { computeTheme, resolveFonts, fontStack, snapTheme, TYPE_PRESETS } from '@merlin/theme/tokens';
import { ICON_KITS, RADIUS_STYLES, type IconKit, type RadiusStyle } from '@merlin/theme/kits';
import { PRESETS, type PresetKey } from './presets';

/* One derived list per brand choice. The home kit section and the
   design-system lab compose them differently, but both read the same values
   and handlers, so a new preset cannot reach one surface and miss the other. */

export type PresetView = {
  key: PresetKey;
  label: string;
  target: ReturnType<typeof snapTheme>;
  primary: string;
  accent: string;
};

export const PRESET_VIEWS: PresetView[] = (Object.entries(PRESETS) as [
  PresetKey,
  (typeof PRESETS)[PresetKey],
][]).map(([key, preset]) => {
  const target = snapTheme(preset.primaryHue, preset.accentHue);
  const { primitives } = computeTheme(target);
  return {
    key,
    label: preset.label,
    target,
    primary: primitives['--color-primary-cta-light'],
    accent: primitives['--color-accent-cta-light'],
  };
});

export type TypeView = {
  key: keyof typeof TYPE_PRESETS;
  label: string;
  note: string;
  stack: string;
};

export const TYPE_VIEWS: TypeView[] = (Object.entries(TYPE_PRESETS) as [
  keyof typeof TYPE_PRESETS,
  (typeof TYPE_PRESETS)[keyof typeof TYPE_PRESETS],
][]).map(([key, preset]) => ({
  key,
  label: preset.label,
  note: preset.note,
  stack: fontStack(resolveFonts({ preset: key }).heading),
}));

export type KitView = { key: IconKit; label: string };
export const KIT_VIEWS: KitView[] = (Object.entries(ICON_KITS) as [
  IconKit,
  (typeof ICON_KITS)[IconKit],
][]).map(([key, kit]) => ({ key, label: kit.label }));

export type RadiusView = { key: RadiusStyle; label: string; sample: string };
export const RADIUS_VIEWS: RadiusView[] = (Object.entries(RADIUS_STYLES) as [
  RadiusStyle,
  (typeof RADIUS_STYLES)[RadiusStyle],
][]).map(([key, style]) => ({ key, label: style.label, sample: style.scale.md }));
