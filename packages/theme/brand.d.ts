import type { CodeRole, FontFamily, FontRole, TypeSelection } from './fonts';
import type { IconKit, RadiusStyle } from './kits';

export type BrandState = {
  primaryHue: number;
  accentHue: number;
  type: TypeSelection;
  iconKit: IconKit;
  radius: RadiusStyle;
};

export const BRAND_STORAGE_KEY: string;
export const BRAND_VERSION: number;
export const BRAND_VAR_KEYS: string[];
export const DEFAULT_BRAND: BrandState;

export function readBrand(raw: string | null): { state: BrandState; migrated: boolean; stale: boolean } | null;
export function writeBrand(state: BrandState): string;
export function brandVars(state: BrandState): Record<string, string>;
export function toThemeConfig(state: BrandState): {
  primaryHue: number;
  accentHue: number;
  fonts: Record<FontRole, FontFamily>;
  code: Record<CodeRole, FontFamily>;
  radius: RadiusStyle;
};
