import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrandControl } from './theme-lab/BrandControl';
import { ThemeLab } from './theme-lab/ThemeLab';
import { ThemeToggle } from './theme-toggle/ThemeToggle';

const reactIslands = {
  brand: BrandControl,
  theme: ThemeToggle,
  lab: ThemeLab,
} as const;

/* React islands hydrate; the hero owns two scripts. Their order is a contract:
   the clock parks every scene at its first frame before the seam controller
   measures the boxes, so the morph reads the pose the seam expects. */
export async function hydrateIslands(): Promise<void> {
  for (const root of document.querySelectorAll<HTMLElement>('[data-island]')) {
    const name = root.dataset.island as keyof typeof reactIslands | 'hero' | 'pager' | 'brand-thread';
    if (name === 'hero') {
      const [{ initClocks }, { initHeroStory }] = await Promise.all([
        import('./hero-story/clocks'),
        import('./hero-story/controller'),
      ]);
      initClocks(root);
      initHeroStory(root);
      continue;
    }
    if (name === 'pager') {
      const { initPager } = await import('./pager/controller');
      initPager(root);
      continue;
    }
    if (name === 'brand-thread') {
      const { initBrandThread } = await import('./brand-thread/controller');
      initBrandThread(root);
      continue;
    }
    const Component = reactIslands[name as keyof typeof reactIslands];
    if (!Component) {
      console.error(`Unknown island "${name}"`);
      continue;
    }
    hydrateRoot(root, createElement(Component));
  }
}
