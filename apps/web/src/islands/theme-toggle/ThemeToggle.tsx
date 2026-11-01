import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import {
  THEME_ICONS,
  THEME_LABELS,
  THEME_NEXT,
  readThemePref,
  resolveTheme,
  writeThemePref,
  type ThemePref,
} from '../../theme-boot.js';

/* The boot script owns the first paint. This island owns later changes.
   Its initial state is always 'auto', which is also the server markup, so
   hydration cannot disagree with a stored preference. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>('auto');

  useEffect(() => {
    setPref(readThemePref());
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media?.addEventListener) return;
    const sync = () => {
      if (readThemePref() !== 'auto') return;
      document.documentElement.dataset.theme = resolveTheme('auto', media.matches);
    };
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const next = () => {
    const value = THEME_NEXT[pref];
    writeThemePref(value);
    setPref(value);
  };

  return (
    <button
      className="icon-btn"
      id="themeToggle"
      aria-label={THEME_LABELS[pref]}
      type="button"
      onClick={next}
    >
      <Icon name={THEME_ICONS[pref]} />
    </button>
  );
}
