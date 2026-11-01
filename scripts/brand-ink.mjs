/* The hat's source inks and their semantic roles. Both brand build paths read
   this module: the live sprite maps each role to a CSS var, while the static
   assets resolve the same roles to concrete theme colors. */

export const BRAND_SOURCE_INKS = {
  '#202149': 'outline',
  '#5f61b2': 'shadow',
  '#7174d0': 'body',
  '#f4c423': 'accent',
};

export const brandCssVar = (role) => `var(--brand-${role})`;

export function brandInnerArt(svg) {
  return svg
    .replace(/<\?xml[^?]*\?>\s*/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>\s*/, '')
    .replace(/\s*<\/svg>\s*$/, '')
    .trim();
}

/* A new source ink fails the build instead of shipping unthemed. */
export function tintBrandArt(art, resolve, label) {
  return art.replace(/fill="(#[0-9a-f]{6})"/gi, (match, hex) => {
    const role = BRAND_SOURCE_INKS[hex.toLowerCase()];
    if (!role) throw new Error(`${label}: unmapped fill ${hex}`);
    return `fill="${resolve(role)}"`;
  });
}
