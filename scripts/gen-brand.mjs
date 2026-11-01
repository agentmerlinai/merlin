#!/usr/bin/env node
/**
 * Generates brand SVG assets for Merlin.
 * Reads packages/theme/assets/logo.svg and Monaspace Xenon Var.woff2, writes
 * the brand assets to apps/web/public/assets/brand/.
 *
 * Colours resolve from packages/theme/tokens.js, the same computed theme that
 * the live page consumes. The logo's source inks are declared once in
 * scripts/brand-ink.mjs and mapped to the four --brand-* roles.
 *
 *   Light wordmark: transparent, light brand inks
 *   Dark wordmark + social preview: dark page, dark brand inks
 *   Avatar/favicons: dark brand inks (theme-neutral asset)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { computeTheme } from '../packages/theme/tokens.js';
import { brandInnerArt, tintBrandArt } from './brand-ink.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'apps/web/public/assets/brand');

const { semanticLight: light, semanticDark: dark } = computeTheme();
const inkOf = (semantic) => ({
  outline: semantic['--brand-outline'],
  body: semantic['--brand-body'],
  shadow: semantic['--brand-shadow'],
  accent: semantic['--brand-accent'],
});
const LIGHT_INK = inkOf(light);
const DARK_INK = inkOf(dark);

const WORDMARK_TAGLINE = 'A base for the air gap';
const SOCIAL_TAGLINE = 'One box. Every change signed.';

// --- Read source assets ---

const innerPaths = brandInnerArt(
  readFileSync(join(root, 'packages/theme/assets/logo.svg'), 'utf-8')
);

const tintArt = (ink, label) => tintBrandArt(innerPaths, (role) => ink[role], label);

const fontBase64 = readFileSync(join(root, 'packages/theme/fonts/Monaspace Xenon Var.woff2')).toString('base64');
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
function wordmark({ bg, title, tagline, ink }) {
  const bgRect = bg ? `<rect width="680" height="120" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 120">
  ${fontStyle}
  ${bgRect}
  <g transform="translate(156,10) scale(0.1348)">
    ${tintArt(ink, 'wordmark')}
  </g>
  <text x="288" y="74" font-family="MXenon" font-weight="700" font-size="66" fill="${title}">Merlin</text>
  <text x="288" y="97" font-family="MXenon" font-weight="400" font-size="18" fill="${tagline}">${WORDMARK_TAGLINE}</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });

// 1. merlin-wordmark-light.svg — transparent background
writeFileSync(join(outDir, 'merlin-wordmark-light.svg'),
  wordmark({
    bg: null,
    title: light['--color-primary-fg'],
    tagline: light['--text-muted'],
    ink: LIGHT_INK,
  }));

// 2. merlin-wordmark-dark.svg — opaque dark background
writeFileSync(join(outDir, 'merlin-wordmark-dark.svg'),
  wordmark({
    bg: dark['--bg-page'],
    title: dark['--color-primary-fg'],
    tagline: dark['--color-accent'],
    ink: DARK_INK,
  }));

// 3. merlin-avatar.svg + .png — mark centered on square canvas, transparent bg
// Source mark: 828×740 → square: 828×828, vertical offset: (828-740)/2=44
// The avatar is theme-neutral. The dark ink set keeps the lightest body and
// the vivid accent, so the mark reads on both light and dark browser chrome.
const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 828 828">
  <g transform="translate(0,44)">
    ${tintArt(DARK_INK, 'avatar')}
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
  <rect width="1200" height="630" fill="${dark['--bg-page']}"/>
  <g transform="translate(240,216) scale(0.2705)">
    ${tintArt(DARK_INK, 'social preview')}
  </g>
  <text x="528" y="336" font-family="MXenon" font-weight="700" font-size="120" fill="${dark['--color-primary-fg']}">Merlin</text>
  <text x="528" y="384" font-family="MXenon" font-weight="400" font-size="40" fill="${dark['--color-accent']}">${SOCIAL_TAGLINE}</text>
</svg>
`;
writeFileSync(join(outDir, 'merlin-social-preview.svg'), socialSvg);

// PNG at 2× for HiDPI; declare 1200×630 in HTML meta tags
const png = await sharp(Buffer.from(socialSvg))
  .resize(2400, 1260)
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(join(outDir, 'merlin-social-preview.png'), png);

console.log('Generated 8 brand assets in apps/web/public/assets/brand/ (4 SVG + 4 PNG)');
