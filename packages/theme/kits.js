/* Icon kits and corner styles are brand choices, but their vocabulary lives
   here so the studio, token generator, boot script, and sprite share one
   source. `sprite` is the id prefix the build writes; source markup never
   names a kit. */

export const ICON_KITS = {
  phosphor: { label: 'Phosphor', sprite: 'ph' },
  lucide: { label: 'Lucide', sprite: 'lx' },
  pixel: { label: 'Pixelarticons', sprite: 'px' },
};

export const ICON_KIT_KEYS = Object.keys(ICON_KITS);
export const DEFAULT_ICON_KIT = 'phosphor';
export const isIconKit = (value) => typeof value === 'string' && value in ICON_KITS;

export const RADIUS_KEYS = ['none', 'sm', 'md', 'lg', 'xl', 'full'];
export const RADIUS_VAR_KEYS = RADIUS_KEYS.map((key) => `--radius-${key}`);

/* Each style keeps the nesting rule (panel > well > plate) and owns `full`,
   so a sharp kit also squares its pills. Soft is the existing scale. */
export const RADIUS_STYLES = {
  soft: {
    label: 'Soft',
    scale: { none: '0', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  },
  sharp: {
    label: 'Sharp',
    scale: { none: '0', sm: '0', md: '2px', lg: '4px', xl: '6px', full: '2px' },
  },
  round: {
    label: 'Round',
    scale: { none: '0', sm: '8px', md: '14px', lg: '20px', xl: '28px', full: '9999px' },
  },
};

export const RADIUS_STYLE_KEYS = Object.keys(RADIUS_STYLES);
export const DEFAULT_RADIUS_STYLE = 'soft';
export const isRadiusStyle = (value) => typeof value === 'string' && value in RADIUS_STYLES;

/* An unknown style is a code error, not reader input: fail loudly. Stored
   brand values are validated separately and degrade to the default. */
export function radiusVars(style = DEFAULT_RADIUS_STYLE) {
  const preset = RADIUS_STYLES[style];
  if (!preset) throw new Error(`Unknown radius style: ${style}`);
  return Object.fromEntries(
    Object.entries(preset.scale).map(([key, value]) => [`--radius-${key}`, value])
  );
}
