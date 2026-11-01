import { useEffect, useMemo, useRef, useState } from 'react';
import { computeTheme } from '@merlin/theme/tokens';
import { Icon } from '../../components/Icon';
import { ThemeControls } from './ThemeControls';
import { hydrateStore, useThemeStudio } from './store';

/* Brand is page chrome, not a station in the deck: the reader keeps it at
   every panel. Collapsed it states the current pair; expanded it is the
   studio. The platform draws the popover, so light dismiss, Escape, and focus
   return need no second controller. */
export function BrandControl() {
  const state = useThemeStudio();
  const theme = useMemo(
    () => computeTheme({ primaryHue: state.primaryHue, accentHue: state.accentHue }),
    [state.primaryHue, state.accentHue]
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hydrateStore();
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const sync = () => setOpen(panel.matches(':popover-open'));
    panel.addEventListener('toggle', sync);
    sync();
    return () => panel.removeEventListener('toggle', sync);
  }, []);

  /* `#your-brand` outlived its panel: old links still open the studio. */
  useEffect(() => {
    if (window.location.hash !== '#your-brand') return;
    const panel = panelRef.current;
    if (panel && !panel.matches(':popover-open')) panel.showPopover();
  }, []);

  return (
    <div className="brand-control" id="your-brand">
      <button
        className="brand-trigger"
        type="button"
        popoverTarget="brand-panel"
        aria-controls="brand-panel"
        aria-expanded={open}
        aria-label="Your brand"
      >
        <Icon name="icon-paint-brush" className="icon" />
        <span className="swatch-pair" aria-hidden="true">
          <span style={{ background: theme.primitives['--color-primary-cta-light'] }} />
          <span style={{ background: theme.primitives['--color-accent-cta-light'] }} />
        </span>
        <span className="brand-trigger-label">Your brand</span>
      </button>

      <div
        ref={panelRef}
        className="brand-panel surface-panel"
        id="brand-panel"
        popover="auto"
        role="group"
        aria-label="Your brand"
      >
        <ThemeControls layout="panel" designSystemLink />
      </div>
    </div>
  );
}
