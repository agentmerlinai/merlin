export type IconKit = 'phosphor' | 'lucide' | 'pixel';
export type RadiusStyle = 'soft' | 'sharp' | 'round';
export type RadiusKey = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const ICON_KITS: Record<IconKit, { label: string; sprite: string }>;
export const ICON_KIT_KEYS: IconKit[];
export const DEFAULT_ICON_KIT: IconKit;
export function isIconKit(value: unknown): value is IconKit;

export const RADIUS_KEYS: RadiusKey[];
export const RADIUS_VAR_KEYS: string[];
export const RADIUS_STYLES: Record<RadiusStyle, { label: string; scale: Record<RadiusKey, string> }>;
export const RADIUS_STYLE_KEYS: RadiusStyle[];
export const DEFAULT_RADIUS_STYLE: RadiusStyle;
export function isRadiusStyle(value: unknown): value is RadiusStyle;
export function radiusVars(style?: RadiusStyle): Record<string, string>;
