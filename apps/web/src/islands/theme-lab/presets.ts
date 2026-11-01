export const PRESETS = {
  arcane: { label: 'Arcane', primaryHue: 280, accentHue: 90 },
  meridian: { label: 'Meridian', primaryHue: 235, accentHue: 160 },
  bloom: { label: 'Bloom', primaryHue: 135, accentHue: 330 },
  ember: { label: 'Ember', primaryHue: 12, accentHue: 45 },
} as const;

export type PresetKey = keyof typeof PRESETS;
