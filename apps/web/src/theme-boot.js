/* One source for the pre-paint theme decision. The inline boot script is
   generated from these function bodies, so the server page and the island
   cannot drift. */

import { BRAND_VAR_KEYS } from '@merlin/theme/brand';
import { ICON_KIT_KEYS } from '@merlin/theme/kits';

export const THEME_LABELS = {
  auto: 'Switch to light theme',
  light: 'Switch to dark theme',
  dark: 'Switch to auto theme',
};

export const THEME_ICONS = {
  auto: 'icon-monitor',
  light: 'icon-sun',
  dark: 'icon-moon',
};

export const THEME_NEXT = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};

export function resolveTheme(pref, systemDark) {
  return pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;
}

export function readThemePref() {
  const pref = document.documentElement.dataset.themePref;
  return pref === 'light' || pref === 'dark' ? pref : 'auto';
}

export function writeThemePref(pref) {
  const root = document.documentElement;
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  root.dataset.themePref = pref;
  root.dataset.theme = resolveTheme(pref, systemDark);
  try {
    localStorage.setItem('merlin-theme', pref);
  } catch {
    /* Private mode: the theme still applies for this page. */
  }
}

function bootTheme() {
  var root = document.documentElement;
  var pref = 'auto';
  try { pref = localStorage.getItem('merlin-theme') || 'auto'; } catch (e) {}
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.setAttribute('data-theme', resolveTheme(pref, dark));
  root.setAttribute('data-theme-pref', pref);
}

/* The brand layer is restored before first paint from the stored copy of the
   generated declarations. The copy is derived state: the store rewrites it on
   hydration when the registry has moved. Values are allowlisted because
   localStorage is not trusted input. Version two predates kits and radii, so
   its vars still apply and the new choices stay at their defaults. */
function readStoredBrand() {
  var raw = null;
  try { raw = localStorage.getItem('merlin-brand'); } catch (e) { return null; }
  if (!raw || raw.charAt(0) !== '{') return null;
  var data;
  try { data = JSON.parse(raw); } catch (e) { return null; }
  if (!data || (data.v !== 2 && data.v !== 3) || !data.vars || typeof data.vars !== 'object') return null;
  return data;
}

function bootBrand() {
  var data = readStoredBrand();
  if (!data) return;
  var valueOk = /^[A-Za-z0-9 ,'"\-_.]+$/;
  var root = document.documentElement;
  for (var i = 0; i < BRAND_KEYS.length; i++) {
    var key = BRAND_KEYS[i];
    if (!Object.prototype.hasOwnProperty.call(data.vars, key)) continue;
    var value = data.vars[key];
    if (typeof value !== 'string' || !valueOk.test(value)) continue;
    root.style.setProperty(key, value);
  }
  if (data.v === 3 && ICON_KITS.indexOf(data.iconKit) !== -1) {
    root.setAttribute('data-icon-kit', data.iconKit);
  }
}

/* Both functions are serialized into the shell. resolveTheme is defined first,
   then the boot functions call it; the island imports the same resolveTheme. */
export const BOOT_SCRIPT = `(function(){var BRAND_KEYS=${JSON.stringify(BRAND_VAR_KEYS)};var ICON_KITS=${JSON.stringify(ICON_KIT_KEYS)};${resolveTheme.toString()}${bootTheme.toString()}${readStoredBrand.toString()}${bootBrand.toString()}bootTheme();bootBrand();})();`;
