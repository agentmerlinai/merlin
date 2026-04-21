#!/usr/bin/env node
/**
 * Generates brand SVG assets for Merlin.
 * Reads logo.svg and Monaspace Xenon Var.woff2, writes 4 SVGs to docs/assets/brand/.
 * No external dependencies — pure Node built-ins.
 *
 * Design tokens (from theme/semantic.css):
 *
 *   Light mode (transparent background)
 *     --color-primary-fg:  #574ecf  (primary-600)   → title
 *     --text-secondary:    #7d7f90  (neutral-500)   → tagline
 *
 *   Dark mode
 *     --bg-page:           #292b34  (neutral-900)
 *     --color-primary-fg:  #898dfd  (primary-400)   → title
 *     --text-secondary:    #989aab  (neutral-400)   → tagline
 *
 * Social preview reuses dark mode palette.
 * Logo mark is embedded verbatim — no color modifications.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'docs/assets/brand');

// Design tokens
const TOKEN = {
  bgDark:       '#292b34',  // --bg-page (dark)             neutral-900

  titleLight:   '#574ecf',  // --color-primary-fg (light)   primary-600
  titleDark:    '#a9affe',  // --color-primary-fg (dark)    primary-300

  taglineLight: '#7d7f90',  // --text-secondary (light)     neutral-500
  taglineDark:  '#fecb16',  // --color-accent (dark)        accent (vivid gold)
};

const TAGLINE = 'Expertise as Code';

// --- Read source assets ---

// Extract inner paths verbatim — logo used exactly as authored, no color changes
const logoSvg = readFileSync(join(root, 'logo.svg'), 'utf-8');
const innerPaths = logoSvg
  .replace(/<\?xml[^?]*\?>\s*/g, '')
  .replace(/^[\s\S]*?<svg[^>]*>\s*/, '')
  .replace(/\s*<\/svg>\s*$/, '')
  .trim();

const fontBase64 = readFileSync(join(root, 'fonts/Monaspace Xenon Var.woff2')).toString('base64');
const fontStyle = `<style>@font-face {
    font-family: 'MXenon';
    src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
    font-weight: 200 800;
  }</style>`;

// Wordmark layout (680×120) — mark+text group horizontally centered:
//   content: mark(112) + gap(20) + text(≈238) = 370px → pad=(680-370)/2=155 → 156 (4×39)
//   mark   → translate(156,10) scale(0.1348) → 112×100px, center-y = 60
//   title  → x=288 y=74 font-size=66        → cap-top ≈ 26, baseline 74
//   tagline→ x=288 y=97 font-size=18        → cap-top ≈ 84, baseline 97
//   text center-y ≈ (26+97)/2 = 61 ≈ mark center 60 ✓
function wordmark(bg, titleColor, taglineColor) {
  const bgRect = bg ? `<rect width="680" height="120" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 120">
  ${fontStyle}
  ${bgRect}
  <g transform="translate(156,10) scale(0.1348)">
    ${innerPaths}
  </g>
  <text x="288" y="74" font-family="MXenon" font-weight="700" font-size="66" fill="${titleColor}">Merlin</text>
  <text x="288" y="97" font-family="MXenon" font-weight="400" font-size="18" fill="${taglineColor}">${TAGLINE}</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });

// 1. merlin-wordmark-light.svg — transparent background
writeFileSync(join(outDir, 'merlin-wordmark-light.svg'),
  wordmark(null, TOKEN.titleLight, TOKEN.taglineLight));

// 2. merlin-wordmark-dark.svg — opaque dark background
writeFileSync(join(outDir, 'merlin-wordmark-dark.svg'),
  wordmark(TOKEN.bgDark, TOKEN.titleDark, TOKEN.taglineDark));

// 3. merlin-avatar.svg + .png — mark centered on square canvas, transparent bg
// Source mark: 828×740 → square: 828×828, vertical offset: (828-740)/2=44
const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 828 828">
  <g transform="translate(0,44)">
    ${innerPaths}
  </g>
</svg>
`;
writeFileSync(join(outDir, 'merlin-avatar.svg'), avatarSvg);
const avatarPng = await sharp(Buffer.from(avatarSvg))
  .resize(828, 828)
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(join(outDir, 'merlin-avatar.png'), avatarPng);

// favicon-32x32.png
const fav32 = await sharp(Buffer.from(avatarSvg)).resize(32, 32).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(join(outDir, 'favicon-32x32.png'), fav32);

// apple-touch-icon.png (180×180)
const touchIcon = await sharp(Buffer.from(avatarSvg)).resize(180, 180).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(join(outDir, 'apple-touch-icon.png'), touchIcon);

// 4. merlin-social-preview.svg + .png — 1200×630 (canonical OG dimensions)
// Side-by-side [mark | text] layout, all values on 4pt grid:
//   scale=0.2705 → mark 224×200px
//   gap = 64px (space-16); composition 224+64+≈432 = 720 → pad=(1200−720)/2 = 240 (60×4)
//   mark: translate(240,216) → center (352,316)  [240=60×4, 216=54×4]
//   text x=528 (132×4)
//   MXenon caps: 120px→88 (22×4), 40px→32 (8×4), gap 16 (space-4)
//   cap-stack 88+16+32=136 → cap-top=316−68=248 (62×4)
//   "Merlin" baseline 248+88=336 (84×4), tagline baseline 352+32=384 (96×4)
const socialSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  ${fontStyle}
  <rect width="1200" height="630" fill="${TOKEN.bgDark}"/>
  <g transform="translate(240,216) scale(0.2705)">
    ${innerPaths}
  </g>
  <text x="528" y="336" font-family="MXenon" font-weight="700" font-size="120" fill="${TOKEN.titleDark}">Merlin</text>
  <text x="528" y="384" font-family="MXenon" font-weight="400" font-size="40" fill="${TOKEN.taglineDark}">${TAGLINE}</text>
</svg>
`;
writeFileSync(join(outDir, 'merlin-social-preview.svg'), socialSvg);

// PNG at 2× for HiDPI; declare 1200×630 in HTML meta tags
const png = await sharp(Buffer.from(socialSvg))
  .resize(2400, 1260)
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(join(outDir, 'merlin-social-preview.png'), png);

console.log('Generated 8 brand assets in docs/assets/brand/ (4 SVG + 4 PNG)');
