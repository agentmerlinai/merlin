import { useSyncExternalStore } from 'react';
import { applyTheme } from '@merlin/theme/tokens';
import {
  BRAND_STORAGE_KEY,
  BRAND_VAR_KEYS,
  DEFAULT_BRAND,
  readBrand,
  toThemeConfig,
  writeBrand,
  type BrandState,
} from '@merlin/theme/brand';
import { preloadTypefaces } from '@merlin/theme/fonts';
import type { IconKit, RadiusStyle } from '@merlin/theme/kits';

export type Hues = Pick<BrandState, 'primaryHue' | 'accentHue'>;

/* The reader's brand outlives the page they met it on. The home kit section
   and the design-system lab share this store, so one token layer has one
   writer. */
let current: BrandState = DEFAULT_BRAND;
let restored = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function sameBrand(a: BrandState, b: BrandState) {
  return (
    a.primaryHue === b.primaryHue &&
    a.accentHue === b.accentHue &&
    a.type.preset === b.type.preset &&
    a.iconKit === b.iconKit &&
    a.radius === b.radius
  );
}

function persist(state: BrandState) {
  try {
    localStorage.setItem(BRAND_STORAGE_KEY, writeBrand(state));
  } catch {
    /* Private mode: the live page still follows, only memory is lost. */
  }
}

/* The boot layer paints the stored declarations as inline properties, which
   outrank the generated sheet. Hand the layer back before the sheet takes
   over. */
function clearBootVars() {
  const root = document.documentElement;
  for (const key of BRAND_VAR_KEYS) root.style.removeProperty(key);
}

function write(next: BrandState) {
  const fontsChanged = next.type.preset !== current.type.preset;
  current = next;
  clearBootVars();
  document.documentElement.dataset.iconKit = next.iconKit;
  applyTheme(toThemeConfig(next));
  persist(next);
  emit();
  if (fontsChanged) {
    document.dispatchEvent(new CustomEvent('merlin:theme-change', {
      detail: { fonts: true, preset: next.type.preset },
    }));
  }
}

/* Islands mount in any order. The first one restores the stored brand; later
   ones see the flag and leave the store untouched. Legacy values are migrated
   on the spot, so the next read is already version three. */
export function hydrateStore() {
  if (restored) return;
  restored = true;
  schedulePreload();
  clearBootVars();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(BRAND_STORAGE_KEY);
  } catch {
    return;
  }
  const parsed = readBrand(raw);
  if (!parsed) return;
  const { state, migrated } = parsed;
  document.documentElement.dataset.iconKit = state.iconKit;
  if (!sameBrand(state, current)) {
    current = state;
    applyTheme(toThemeConfig(state));
    emit();
  }
  if (migrated) persist(state);
}

/* Every bundled face loads after first paint. A switch then applies a face
   that is already in memory, so the page relayouts once and no fallback swap
   follows the reader's choice. */
function schedulePreload() {
  const run = function () { void preloadTypefaces(); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 0);
}

export function setHues(hues: Hues) {
  write({ ...current, primaryHue: hues.primaryHue, accentHue: hues.accentHue });
}

export function selectPreset(preset: string) {
  /* A very fast reader can select before the idle preload starts; start it now
     so the face is in flight. The hero waits for `document.fonts` to settle
     before it measures the new boxes. */
  void preloadTypefaces();
  write({ ...current, type: { preset } });
}

export function selectIconKit(iconKit: IconKit) {
  write({ ...current, iconKit });
}

export function selectRadius(radius: RadiusStyle) {
  write({ ...current, radius });
}

export function resetTheme() {
  write(DEFAULT_BRAND);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => DEFAULT_BRAND;

export function useThemeStudio(): BrandState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
