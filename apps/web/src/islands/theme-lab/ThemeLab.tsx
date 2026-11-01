import { useEffect } from 'react';
import { ThemeControls } from './ThemeControls';
import { hydrateStore } from './store';

/* The design-system page keeps the inline controls; both surfaces read the
   same store, so the nav studio and this panel cannot drift. */
export function ThemeLab() {
  useEffect(() => {
    hydrateStore();
  }, []);

  return <ThemeControls layout="section" />;
}
