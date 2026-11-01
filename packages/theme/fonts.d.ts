export type FontRole = 'body' | 'heading' | 'caption' | 'code' | 'agent' | 'prose';
export type CodeRole = 'keyword' | 'string' | 'fn' | 'comment';
export type FontCategory = 'sans' | 'serif' | 'mono';
/* Family keys are validated at runtime by isFontFamily. The registry is JS, so
   a string keeps this declaration from becoming a second source of names. */
export type FontFamily = string;
export type TypePresetKey = string;

export type TypeSelection = {
  preset: TypePresetKey;
  overrides?: Partial<Record<FontRole, FontFamily>>;
};

export type FontFace = {
  label: string;
  category: FontCategory;
  stack: string;
  weights: [number, number];
  license: string;
  reserved: boolean;
};

export const FONT_ROLES: FontRole[];
export const FONT_VAR_KEYS: string[];
export const CODE_ROLES: CodeRole[];
export const FONT_FAMILIES: Record<FontFamily, FontFace>;
export const FONT_CATEGORIES: Record<FontCategory, string>;
export const TYPE_PRESETS: Record<
  TypePresetKey,
  { label: string; note: string; fonts: Record<FontRole, FontFamily>; code: Record<CodeRole, FontFamily> }
>;
export const DEFAULT_TYPE: TypeSelection;

export function isFontFamily(value: unknown): value is FontFamily;
export function isTypePreset(value: unknown): value is TypePresetKey;
export function resolveFonts(selection?: TypeSelection): Record<FontRole, FontFamily>;
export function resolveCode(selection?: TypeSelection): Record<CodeRole, FontFamily>;
export function presetFamilies(preset: TypePresetKey): FontFamily[];
export function allFamilies(): FontFamily[];
export function preloadTypefaces(): Promise<void>;
export function loadPreset(preset: TypePresetKey): Promise<void>;
export function fontStack(family: FontFamily): string;
export function fontVars(
  fonts: Record<FontRole, FontFamily>,
  code?: Partial<Record<CodeRole, FontFamily>>
): Record<string, string>;
