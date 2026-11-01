/* The persisted brand is hue pair, typeface, icon kit, and corner style. This
   module owns the schema and its migration; the store owns the live page. A
   version-1 value was the bare pair "primary,accent", and version two added the
   typeface, so old readers keep what they chose.

   `vars` is a derived copy of the declarations the brand can move (fonts and
   radii). The pre-paint boot script replays it before the app loads, so the
   first paint never flashes a default then a swap. It is never read back as
   state: the selections are the source, and a stale `vars` is rewritten on
   hydration. */

import { DEFAULT_THEME } from './tokens.js';
import { DEFAULT_TYPE, FONT_VAR_KEYS, isTypePreset, resolveCode, resolveFonts, fontVars } from './fonts.js';
import {
  DEFAULT_ICON_KIT,
  DEFAULT_RADIUS_STYLE,
  RADIUS_VAR_KEYS,
  isIconKit,
  isRadiusStyle,
  radiusVars,
} from './kits.js';

export const BRAND_STORAGE_KEY = 'merlin-brand';
export const BRAND_VERSION = 3;
export const BRAND_VAR_KEYS = [...FONT_VAR_KEYS, ...RADIUS_VAR_KEYS];

export const DEFAULT_BRAND = {
  primaryHue: DEFAULT_THEME.primaryHue,
  accentHue: DEFAULT_THEME.accentHue,
  type: DEFAULT_TYPE,
  iconKit: DEFAULT_ICON_KIT,
  radius: DEFAULT_RADIUS_STYLE,
};

const clampHue = (value) =>
  Number.isInteger(value) && value >= 0 && value <= 360 ? value : null;

function readHues(raw) {
  if (typeof raw === 'string') {
    const parts = raw.split(',');
    if (parts.length !== 2) return null;
    const [primary, accent] = parts.map(Number);
    const p = clampHue(primary);
    const a = clampHue(accent);
    return p === null || a === null ? null : { primaryHue: p, accentHue: a, migrated: true };
  }
  if (!raw || typeof raw !== 'object') return null;
  const p = clampHue(raw.primaryHue);
  const a = clampHue(raw.accentHue);
  if (p === null || a === null) return null;
  return { primaryHue: p, accentHue: a, migrated: raw.v !== BRAND_VERSION };
}

/* Role overrides left the brand: one typeface sets every role. Stored values
   that still carry them are accepted and rewritten to the preset on the next
   write, so old readers keep their colour and face. */
function readType(raw) {
  let preset = DEFAULT_TYPE.preset;
  let migrated = false;
  if (isTypePreset(raw?.preset)) preset = raw.preset;
  else if (raw !== undefined) migrated = true;

  const overrides = raw?.overrides;
  if (overrides && Object.keys(overrides).length > 0) migrated = true;
  return { type: { preset }, migrated };
}

/* Reader input is not code: an unknown stored choice degrades to the default
   and is rewritten. The generator itself throws on unknown values. */
function readChoice(raw, is, fallback) {
  if (raw === undefined) return { value: fallback, migrated: false };
  if (is(raw)) return { value: raw, migrated: false };
  return { value: fallback, migrated: true };
}

function varsFor(state) {
  return {
    ...fontVars(resolveFonts(state.type), resolveCode(state.type)),
    ...radiusVars(state.radius),
  };
}

function parseBrand(raw) {
  const hues = readHues(raw);
  if (!hues) return null;
  const type = readType(raw.type);
  const iconKit = readChoice(raw.iconKit, isIconKit, DEFAULT_ICON_KIT);
  const radius = readChoice(raw.radius, isRadiusStyle, DEFAULT_RADIUS_STYLE);
  const state = {
    primaryHue: hues.primaryHue,
    accentHue: hues.accentHue,
    type: type.type,
    iconKit: iconKit.value,
    radius: radius.value,
  };
  const storedVars = raw.vars && typeof raw.vars === 'object' ? raw.vars : null;
  const stale = !storedVars || JSON.stringify(storedVars) !== JSON.stringify(varsFor(state));
  return {
    state,
    migrated: hues.migrated || type.migrated || iconKit.migrated || radius.migrated || stale,
    stale,
  };
}

/* `raw` is the localStorage string. A legacy pair and a malformed value are
   different outcomes: the pair is migrated, the malformed value is ignored. */
export function readBrand(raw) {
  if (!raw) return null;
  if (raw.trim().startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    return parseBrand(parsed);
  }
  const hues = readHues(raw);
  if (!hues) return null;
  return { state: { ...DEFAULT_BRAND, primaryHue: hues.primaryHue, accentHue: hues.accentHue }, migrated: true, stale: true };
}

export function writeBrand(state) {
  return JSON.stringify({
    v: BRAND_VERSION,
    primaryHue: state.primaryHue,
    accentHue: state.accentHue,
    type: state.type,
    iconKit: state.iconKit,
    radius: state.radius,
    vars: varsFor(state),
  });
}

export function brandVars(state) {
  return varsFor(state);
}

export function toThemeConfig(state) {
  return {
    primaryHue: state.primaryHue,
    accentHue: state.accentHue,
    fonts: resolveFonts(state.type),
    code: resolveCode(state.type),
    radius: state.radius,
  };
}
