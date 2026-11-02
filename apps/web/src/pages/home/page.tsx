import { SiteLayout } from '../../components/SiteLayout';
import { EndingSection } from './sections/EndingSection';
import { HeroSection } from './sections/HeroSection';
import { KitSection } from './sections/KitSection';

export default function HomePage() {
  return (
    <SiteLayout current="home">
      {/* The deck slides over one desk. This layer owns the surface the opening
          used to own alone: the grid and the lights move with the reader, not
          with a section, so no panel owns its own wallpaper. */}
      <div className="page-bg" aria-hidden="true">
        <div className="page-bg__glow page-bg__glow--story">
          <div className="page-bg__story-light" />
        </div>
        <div className="page-bg__glow page-bg__glow--close" />
        <div className="page-bg__field">
          <div className="page-bg__grid" />
        </div>
      </div>
      <HeroSection />
      <KitSection />
      <EndingSection />
    </SiteLayout>
  );
}
