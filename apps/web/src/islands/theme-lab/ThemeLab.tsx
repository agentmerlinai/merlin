import { useEffect } from 'react';
import { ThemeControls } from './ThemeControls';
import { hydrateStore } from './store';

/* The design-system page keeps the full control set. The home kit section
   reads the same store, so the two surfaces cannot drift. */
export function ThemeLab() {
  useEffect(() => {
    hydrateStore();
  }, []);

  return <ThemeControls />;
}
