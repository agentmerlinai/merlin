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
  titleDark:    '#898dfd',  // --color-primary-fg (dark)    primary-400

  taglineLight: '#7d7f90',  // --text-secondary (light)     neutral-500
  taglineDark:  '#989aab',  // --text-secondary (dark)      neutral-400
};

const TAGLINE = 'Expertise as code';

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

// 3. merlin-avatar.svg — mark only, verbatim, transparent bg
writeFileSync(join(outDir, 'merlin-avatar.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 828 740">
  ${innerPaths}
</svg>
`);

// 4. merlin-social-preview.svg + .png — 1200×630 (canonical OG dimensions)
// Side-by-side layout, whole composition centered:
//   scale=0.2705 → mark 224×200px
//   content: mark(224) + gap(80) + text(≈432) = 736px → pad=(1200-736)/2=232 (4×58)
//   translate(232,216): mark centered vertically on canvas (216=4×54, mark_cy=316≈315)
//   text x=536 (4×134), baselines vertically centered on mark_cy=316
//   title baseline=332 (4×83), tagline baseline=384 (4×96)
const socialSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  ${fontStyle}
  <rect width="1200" height="630" fill="${TOKEN.bgDark}"/>
  <g transform="translate(232,216) scale(0.2705)">
    ${innerPaths}
  </g>
  <text x="536" y="332" font-family="MXenon" font-weight="700" font-size="120" fill="${TOKEN.titleDark}">Merlin</text>
  <text x="536" y="384" font-family="MXenon" font-weight="400" font-size="40" fill="${TOKEN.taglineDark}">${TAGLINE}</text>
</svg>
`;
writeFileSync(join(outDir, 'merlin-social-preview.svg'), socialSvg);

// PNG at 2× for HiDPI; declare 1200×630 in HTML meta tags
const png = await sharp(Buffer.from(socialSvg))
  .resize(2400, 1260)
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(join(outDir, 'merlin-social-preview.png'), png);

console.log('Generated 5 brand assets in docs/assets/brand/ (4 SVG + 1 PNG)');
