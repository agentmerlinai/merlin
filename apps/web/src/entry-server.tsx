import { renderToString } from 'react-dom/server';
import DesignSystemPage from './pages/design-system/page';
import HomePage from './pages/home/page';

const pages = {
  home: HomePage,
  'design-system': DesignSystemPage,
} as const;

export function renderRoute(id: string): string {
  const Page = pages[id as keyof typeof pages];
  if (!Page) throw new Error(`Unknown route "${id}"`);
  return renderToString(<Page />);
}
