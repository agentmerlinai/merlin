import type { CodeRole, FontFamily, FontRole } from './fonts';
import type { RadiusStyle } from './kits';

export type ThemeConfig = {
  primaryHue: number;
  accentHue: number;
  fonts?: Partial<Record<FontRole, FontFamily>>;
  code?: Partial<Record<CodeRole, FontFamily>>;
  radius?: RadiusStyle;
};

export type Shade = {
  name: string;
  hex: string;
  isCTA?: boolean;
  [key: string]: unknown;
};

export type SemanticViolation =
  | { type: 'brand-gap'; role: string; brand: string; gap: number }
  | { type: 'semantic-gap'; a: string; b: string; gap: number }
  | { type: 'window'; role: string }
  | { type: 'invalid-input' };

export type SemanticDiagnostics = {
  feasible: boolean;
  violations: SemanticViolation[];
};

export type Theme = {
  primitives: Record<string, string>;
  palettes: Record<string, Shade[]>;
  semanticLight: Record<string, string>;
  semanticDark: Record<string, string>;
  semanticDiagnostics: SemanticDiagnostics;
  [key: string]: unknown;
};

export const DEFAULT_THEME: ThemeConfig & {
  fonts: Record<FontRole, FontFamily>;
  code: Record<CodeRole, FontFamily>;
};

export function computeTheme(config?: Partial<ThemeConfig>): Theme;
export function generateCSS(config?: Partial<ThemeConfig>): string;
export function applyTheme(config?: Partial<ThemeConfig>): void;
export function snapTheme(
  primaryHue: number,
  accentHue: number,
  options?: { maxShift?: number; step?: number }
): ThemeConfig & { snapped: boolean; cost: number };

export const SPACE_BASE: number;
export const SPACE_STEPS: number[];
export const TYPE_BASE: number;
export const TYPE_RATIO: number;
export const TYPE_STEPS: string[];
export const TYPE_INDICES: number[];

export type { FontRole, CodeRole, FontFamily, FontCategory, TypePresetKey, TypeSelection, FontFace } from './fonts';
export {
  FONT_ROLES,
  CODE_ROLES,
  FONT_VAR_KEYS,
  FONT_FAMILIES,
  FONT_CATEGORIES,
  TYPE_PRESETS,
  DEFAULT_TYPE,
  isFontFamily,
  isTypePreset,
  resolveFonts,
  resolveCode,
  fontStack,
  fontVars,
} from './fonts';
