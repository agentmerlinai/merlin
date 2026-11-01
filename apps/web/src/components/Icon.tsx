import { ICON_KITS, type IconKit } from '@merlin/theme/kits';

const KIT_KEYS = Object.keys(ICON_KITS) as IconKit[];

/* One glyph, one symbol per kit. The root `data-icon-kit` reveals exactly one,
   so switching kits is a paint change with no client rewrite of the markup.
   Pass `kit` only for a fixed preview and give it a class other than `icon`
   (the gate keys off `.icon`). */
export function Icon({
  name,
  className = 'icon',
  kit,
}: {
  name: string;
  className?: string;
  kit?: IconKit;
}) {
  const bare = name.replace(/^icon-/, '');
  const kits = kit ? [kit] : KIT_KEYS;
  return (
    <svg className={className} fill="currentColor" aria-hidden="true">
      {kits.map((key) => (
        <use key={key} data-kit={key} href={`#${ICON_KITS[key].sprite}-${bare}`} />
      ))}
    </svg>
  );
}
