import {
  SHADE_NAMES, LIGHTNESS,
  oklchToHex, oklchStr,
  contrastRatio, bestTextColor,
  maxGamutChroma, generateScale, computeOptimalShade
} from './oklch.js';

export const DEFAULT_THEME = {
  primaryHue: 280, // wizard archetype — intentional, see COLOR_GUIDE § intentional ownership
  accentHue: 90,
  fonts: { body: 'MNeon', heading: 'MXenon', caption: 'MArgon', code: 'MNeon', agent: 'MKrypton', prose: 'MRadon' }
};

export const SPACE_BASE = 4;
export const SPACE_STEPS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
export const TYPE_BASE = 16;
export const TYPE_RATIO = 1.25;
export const TYPE_STEPS = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
export const TYPE_INDICES = [-2, -1, 0, 1, 2, 3, 4, 5, 6];
export const RADII = { none: '0', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' };

function buildRoles(primaryHue, accentHue) {
  return {
    primary:  { hue: primaryHue, peakChromaFraction: 0.65, forceWhiteText: true, label: `Primary (H=${primaryHue})` },
    accent:   { hue: accentHue,  peakChromaFraction: 0.95, label: `Accent (H=${accentHue})` },
    neutral:  { hue: primaryHue, peakChromaFraction: 0.09, label: 'Neutral (brand-tinted)' },
    error:    { hue: 25,         peakChromaFraction: 0.61, label: 'Error' },
    warning:  { hue: 70,         peakChromaFraction: 0.92, label: 'Warning' },
    success:  { hue: 155,        peakChromaFraction: 0.87, label: 'Success' },
  };
}

function buildPalettes(ROLES, lightBg, darkBg) {
  const palettes = {};
  for (const [role, cfg] of Object.entries(ROLES)) {
    const scale = generateScale(cfg.hue, cfg.peakChromaFraction);
    scale.label = cfg.label;

    const optLight = computeOptimalShade(cfg.hue, lightBg, cfg.forceWhiteText);
    const optDark  = computeOptimalShade(cfg.hue, darkBg,  cfg.forceWhiteText);
    if (!optLight) throw new Error(`No WCAG AA shade for hue ${cfg.hue} on light bg`);
    if (!optDark)  throw new Error(`No WCAG AA shade for hue ${cfg.hue} on dark bg`);

    const hoverLightL = Math.max(0.25, optLight.L - 0.06);
    const hoverDarkL  = Math.max(0.25, optDark.L  - 0.06);
    const hoverLightC = maxGamutChroma(hoverLightL, cfg.hue) * 0.95;
    const hoverDarkC  = maxGamutChroma(hoverDarkL,  cfg.hue) * 0.95;

    scale.ctaLight      = { ...optLight };
    scale.ctaLightHover = { L: hoverLightL, C: hoverLightC, hex: oklchToHex(hoverLightL, hoverLightC, cfg.hue), textColor: optLight.textColor };
    scale.ctaDark       = { ...optDark };
    scale.ctaDarkHover  = { L: hoverDarkL,  C: hoverDarkC,  hex: oklchToHex(hoverDarkL,  hoverDarkC,  cfg.hue), textColor: optDark.textColor };

    scale.push(
      { name: 'cta-light', ...optLight,  hue: cfg.hue, oklch: oklchStr(optLight.L,  optLight.C,  cfg.hue), isCTA: true },
      { name: 'cta-dark',  ...optDark,   hue: cfg.hue, oklch: oklchStr(optDark.L,   optDark.C,   cfg.hue), isCTA: true },
    );

    palettes[role] = scale;
  }
  return palettes;
}

function buildPrimitives(palettes, fonts) {
  const primitives = {};

  for (const [role, scale] of Object.entries(palettes)) {
    for (const s of scale) primitives[`--color-${role}-${s.name}`] = s.hex;
    primitives[`--color-${role}-cta-light`]       = scale.ctaLight.hex;
    primitives[`--color-${role}-cta-light-hover`] = scale.ctaLightHover.hex;
    primitives[`--color-${role}-cta-dark`]        = scale.ctaDark.hex;
    primitives[`--color-${role}-cta-dark-hover`]  = scale.ctaDarkHover.hex;
  }

  for (const step of SPACE_STEPS)
    primitives[`--space-${String(step).replace('.', '_')}`] = `${step * SPACE_BASE}px`;

  for (let i = 0; i < TYPE_STEPS.length; i++)
    primitives[`--font-size-${TYPE_STEPS[i]}`] = `${(TYPE_BASE * TYPE_RATIO ** TYPE_INDICES[i]).toFixed(1)}px`;

  for (const [k, v] of Object.entries(RADII)) primitives[`--radius-${k}`] = v;

  const f = { ...DEFAULT_THEME.fonts, ...fonts };
  primitives['--font-body']    = `'${f.body}', monospace`;
  primitives['--font-heading'] = `'${f.heading}', monospace`;
  primitives['--font-caption'] = `'${f.caption}', monospace`;
  primitives['--font-code']    = `'${f.code}', monospace`;
  primitives['--font-agent']   = `'${f.agent}', monospace`;
  primitives['--font-prose']   = `'${f.prose}', monospace`;

  return primitives;
}

function resolveSemanticLight(role, palettes, primitives) {
  const p = palettes[role];
  return {
    [`--color-${role}`]:        p.ctaLight.hex,
    [`--on-${role}`]:           p.ctaLight.textColor,
    [`--color-${role}-hover`]:  p.ctaLightHover.hex,
    [`--color-${role}-fg`]:     primitives[`--color-${role}-600`],
    [`--color-${role}-subtle`]: primitives[`--color-${role}-50`],
  };
}

function resolveSemanticDark(role, palettes, primitives) {
  const p = palettes[role];
  return {
    [`--color-${role}`]:        p.ctaDark.hex,
    [`--on-${role}`]:           p.ctaDark.textColor,
    [`--color-${role}-hover`]:  p.ctaDarkHover.hex,
    [`--color-${role}-fg`]:     primitives[`--color-${role}-300`],
    [`--color-${role}-subtle`]: primitives[`--color-${role}-950`],
  };
}

const COLOR_ROLES = ['primary', 'accent', 'error', 'warning', 'success'];

export function computeTheme({ primaryHue = DEFAULT_THEME.primaryHue, accentHue = DEFAULT_THEME.accentHue, fonts = {} } = {}) {
  const ROLES = buildRoles(primaryHue, accentHue);
  const neutralScale = generateScale(primaryHue, 0.09);
  const darkBg = neutralScale.find(s => s.name === 800).hex;
  const lightBg = '#ffffff';
  const palettes = buildPalettes(ROLES, lightBg, darkBg);
  const primitives = buildPrimitives(palettes, fonts);

  const semanticLight = {
    '--bg-page':        primitives['--color-neutral-50'],
    '--bg-surface':     '#ffffff',
    '--bg-muted':       primitives['--color-neutral-100'],
    '--bg-subtle':      primitives['--color-neutral-200'],
    '--text-primary':   primitives['--color-neutral-900'],
    '--text-secondary': primitives['--color-neutral-600'],
    '--text-muted':     primitives['--color-neutral-500'],
    '--text-inverse':   '#ffffff',
    ...Object.assign({}, ...COLOR_ROLES.map(r => resolveSemanticLight(r, palettes, primitives))),
    '--border-default': primitives['--color-neutral-500'],
    '--border-muted':   primitives['--color-neutral-300'],
    '--border-strong':  primitives['--color-neutral-600'],
    '--focus-ring':     primitives['--color-primary-600'],
    '--shadow-sm':      '0 1px 2px oklch(0 0 0 / .05)',
    '--shadow-md':      '0 2px 8px oklch(0 0 0 / .08), 0 1px 2px oklch(0 0 0 / .04)',
    '--shadow-lg':      '0 4px 16px oklch(0 0 0 / .10), 0 2px 4px oklch(0 0 0 / .04)',
  };

  const semanticDark = {
    '--bg-page':        primitives['--color-neutral-900'],
    '--bg-surface':     primitives['--color-neutral-800'],
    '--bg-muted':       primitives['--color-neutral-700'],
    '--bg-subtle':      primitives['--color-neutral-600'],
    '--text-primary':   primitives['--color-neutral-50'],
    '--text-secondary': primitives['--color-neutral-300'],
    '--text-muted':     primitives['--color-neutral-400'],
    '--text-inverse':   primitives['--color-neutral-900'],
    ...Object.assign({}, ...COLOR_ROLES.map(r => resolveSemanticDark(r, palettes, primitives))),
    '--border-default': primitives['--color-neutral-400'],
    '--border-muted':   primitives['--color-neutral-600'],
    '--border-strong':  primitives['--color-neutral-300'],
    '--focus-ring':     primitives['--color-primary-500'],
    '--shadow-sm':      '0 1px 2px oklch(0 0 0 / .20)',
    '--shadow-md':      '0 2px 8px oklch(0 0 0 / .30), 0 1px 2px oklch(0 0 0 / .15)',
    '--shadow-lg':      '0 4px 16px oklch(0 0 0 / .40), 0 2px 4px oklch(0 0 0 / .20)',
  };

  const spacingSemantic = {
    '--space-inline-xs': primitives['--space-1'],
    '--space-inline-sm': primitives['--space-2'],
    '--space-inline-md': primitives['--space-3'],
    '--space-inline-lg': primitives['--space-5'],
    '--space-stack-xs':  primitives['--space-1'],
    '--space-stack-sm':  primitives['--space-2'],
    '--space-stack-md':  primitives['--space-4'],
    '--space-stack-lg':  primitives['--space-6'],
    '--space-stack-xl':  primitives['--space-10'],
    '--space-inset-sm':  primitives['--space-2'],
    '--space-inset-md':  primitives['--space-4'],
    '--space-inset-lg':  primitives['--space-6'],
    '--space-gap-sm':    primitives['--space-2'],
    '--space-gap-md':    primitives['--space-3'],
    '--space-gap-lg':    primitives['--space-5'],
  };

  return { palettes, primitives, ROLES, semanticLight, semanticDark, spacingSemantic };
}

const TYPOGRAPHY_ALIASES = `  /* Typography aliases */
  --text-xs: var(--font-size-xs);
  --text-sm: var(--font-size-sm);
  --text-base: var(--font-size-base);
  --text-md: var(--font-size-md);
  --text-lg: var(--font-size-lg);
  --text-xl: var(--font-size-xl);
  --text-2xl: var(--font-size-2xl);
  --text-3xl: var(--font-size-3xl);
  --text-4xl: var(--font-size-4xl);
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
  --tracking-tight: -0.01em;
  --tracking-normal: 0;
  --tracking-wide: 0.04em;`;

export function generateCSS(themeConfig) {
  const { primitives, semanticLight, semanticDark, spacingSemantic } = computeTheme(themeConfig);

  const rootLines = [':root {'];
  for (const [k, v] of Object.entries(primitives)) rootLines.push(`  ${k}: ${v};`);
  for (const [k, v] of Object.entries(semanticLight)) rootLines.push(`  ${k}: ${v};`);
  for (const [k, v] of Object.entries(spacingSemantic)) rootLines.push(`  ${k}: ${v};`);
  rootLines.push(TYPOGRAPHY_ALIASES);
  rootLines.push('}');

  const darkLines = ['[data-theme="dark"] {'];
  for (const [k, v] of Object.entries(semanticDark)) darkLines.push(`  ${k}: ${v};`);
  darkLines.push('}');

  return rootLines.join('\n') + '\n' + darkLines.join('\n') + '\n';
}

export function applyTheme(themeConfig) {
  const css = generateCSS(themeConfig);
  let el = document.getElementById('merlin-primitives');
  if (!el) {
    el = document.createElement('style');
    el.id = 'merlin-primitives';
    document.head.appendChild(el);
  }
  el.textContent = css;
}
