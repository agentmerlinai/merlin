export type ThemePref = 'auto' | 'light' | 'dark';

export const THEME_LABELS: Record<ThemePref, string>;
export const THEME_ICONS: Record<ThemePref, string>;
export const THEME_NEXT: Record<ThemePref, ThemePref>;

export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark';
export function readThemePref(): ThemePref;
export function writeThemePref(pref: ThemePref): void;

export const BOOT_SCRIPT: string;
