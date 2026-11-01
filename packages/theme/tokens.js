import {
  SHADE_NAMES, LIGHTNESS,
  oklchToHex, oklchStr,
  contrastRatio, bestTextColor,
  maxGamutChroma, generateScale, computeOptimalShade
} from './oklch.js';
import { resolveSemanticHues, SEMANTIC_FIELDS } from './semantic-fields.js';
import { DEFAULT_TYPE, TYPE_PRESETS, fontVars } from './fonts.js';
import { DEFAULT_RADIUS_STYLE, radiusVars } from './kits.js';

export { resolveSemanticHues, snapTheme, SEMANTIC_FIELDS, MIN_BRAND_GAP, MIN_SEMANTIC_GAP } from './semantic-fields.js';
export {
  FONT_ROLES, CODE_ROLES, FONT_VAR_KEYS, FONT_FAMILIES, FONT_CATEGORIES, TYPE_PRESETS, DEFAULT_TYPE,
  isFontFamily, isTypePreset, resolveFonts, resolveCode, fontStack, fontVars,
} from './fonts.js';

export const DEFAULT_THEME = {
  primaryHue: 280, // wizard archetype — intentional, see COLOR_GUIDE § intentional ownership
  accentHue: 90,
  fonts: TYPE_PRESETS.monaspace.fonts,
  code: TYPE_PRESETS.monaspace.code,
};

export const SPACE_BASE = 4;
export const SPACE_STEPS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
export const TYPE_BASE = 16;
export const TYPE_RATIO = 1.25;
export const TYPE_STEPS = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
export const TYPE_INDICES = [-2, -1, 0, 1, 2, 3, 4, 5, 6];

/* Semantic chroma follows the climate as well as the hue: a strong warm or cool
   brand lifts the signal slightly, so no semantic token is ever static. */
function semanticChroma(role, climate) {
  return SEMANTIC_FIELDS[role].peakChromaFraction * (0.9 + 0.2 * Math.abs(climate));
}

function semanticRole(role, hues, climate) {
  return {
    hue: hues[role],
    peakChromaFraction: semanticChroma(role, climate),
    label: `${role[0].toUpperCase()}${role.slice(1)} (H=${hues[role].toFixed(1)})`,
  };
}

function buildRoles(primaryHue, accentHue, hues, climate) {
  return {
    primary:  { hue: primaryHue, peakChromaFraction: 0.65, forceWhiteText: true, label: `Primary (H=${primaryHue})` },
    accent:   { hue: accentHue,  peakChromaFraction: 0.95, label: `Accent (H=${accentHue})` },
    neutral:  { hue: primaryHue, peakChromaFraction: 0.09, label: 'Neutral (brand-tinted)' },
    error:    semanticRole('error', hues, climate),
    warning:  semanticRole('warning', hues, climate),
    success:  semanticRole('success', hues, climate),
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

function buildPrimitives(palettes, fonts, code, radius) {
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

  Object.assign(primitives, radiusVars(radius));

  const f = { ...DEFAULT_THEME.fonts, ...fonts };
  /* A changed code face collapses the Monaspace mix; an unchanged one keeps
     the metric-compatible voices. The store passes the resolved map. */
  const c = code ?? (f.code === DEFAULT_THEME.fonts.code ? DEFAULT_THEME.code : {});
  Object.assign(primitives, fontVars(f, c));

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

/* The hat's four inks are illustration roles, not UI roles. The contour is
   line art: it stays the darkest ink in both themes so folds read as ink, not
   as highlights. Dark lifts only the body and shadow fills to separate them
   from the dark plate; it never flips the contour. */
function brandInkRoles(primitives, bodyStep, shadowStep, accent) {
  return {
    '--brand-outline': primitives['--color-primary-950'],
    '--brand-body':    primitives[`--color-primary-${bodyStep}`],
    '--brand-shadow':  primitives[`--color-primary-${shadowStep}`],
    '--brand-accent':  accent,
  };
}

const COLOR_ROLES = ['primary', 'accent', 'error', 'warning', 'success'];

export function computeTheme({ primaryHue = DEFAULT_THEME.primaryHue, accentHue = DEFAULT_THEME.accentHue, fonts = {}, code, radius = DEFAULT_RADIUS_STYLE } = {}) {
  const { hues, climate, diagnostics } = resolveSemanticHues(primaryHue, accentHue);
  const ROLES = buildRoles(primaryHue, accentHue, hues, climate);
  const neutralScale = generateScale(primaryHue, 0.09);
  const darkBg = neutralScale.find(s => s.name === 800).hex;
  /* The light surface is a near-white tint of the brand, not #ffffff. Every
     surface and pair then re-solves against a moving background. */
  const surfaceC = Math.min(0.008, maxGamutChroma(0.985, primaryHue) * 0.9);
  const lightBg = oklchToHex(0.985, surfaceC, primaryHue);
  const palettes = buildPalettes(ROLES, lightBg, darkBg);
  const primitives = buildPrimitives(palettes, fonts, code, radius);

  const semanticLight = {
    '--bg-page':        primitives['--color-neutral-50'],
    '--bg-surface':     lightBg,
    '--bg-muted':       primitives['--color-neutral-100'],
    '--bg-subtle':      primitives['--color-neutral-200'],
    '--text-primary':   primitives['--color-neutral-900'],
    '--text-secondary': primitives['--color-neutral-600'],
    '--text-muted':     primitives['--color-neutral-500'],
    '--text-inverse':   primitives['--color-neutral-50'],
    ...Object.assign({}, ...COLOR_ROLES.map(r => resolveSemanticLight(r, palettes, primitives))),
    '--border-default': primitives['--color-neutral-500'],
    '--border-muted':   primitives['--color-neutral-300'],
    '--border-strong':  primitives['--color-neutral-600'],
    '--focus-ring':     primitives['--color-primary-600'],
    '--shadow-sm':      '0 1px 2px oklch(0 0 0 / .05)',
    '--shadow-md':      '0 2px 8px oklch(0 0 0 / .08), 0 1px 2px oklch(0 0 0 / .04)',
    '--shadow-lg':      '0 4px 16px oklch(0 0 0 / .10), 0 2px 4px oklch(0 0 0 / .04)',
  };
  Object.assign(
    semanticLight,
    brandInkRoles(primitives, 500, 700, semanticLight['--color-accent-fg'])
  );

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
  Object.assign(
    semanticDark,
    brandInkRoles(primitives, 400, 600, semanticDark['--color-accent-fg'])
  );

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

  return { palettes, primitives, ROLES, semanticLight, semanticDark, spacingSemantic, semanticDiagnostics: diagnostics, semanticClimate: climate };
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

// Header for the generated sheets. Lives here so the generator and the
// sync-check test cannot drift apart.
export const CSS_HEADER = '/* Generated by packages/theme/generate.js — do not edit manually */\n\n';

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
