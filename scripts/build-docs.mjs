import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { icons } from './icons.mjs';

// Generate sprite
mkdirSync('docs/assets/icons', { recursive: true });
const symbols = Object.entries(icons)
  .map(([id, { viewBox, content }]) =>
    `  <symbol id="${id}" viewBox="${viewBox}">${content}</symbol>`)
  .join('\n');
writeFileSync(
  'docs/assets/icons/sprite.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n<defs>\n${symbols}\n</defs>\n</svg>\n`
);
console.log('docs/assets/icons/sprite.svg generated');

mkdirSync('docs/assets/theme', { recursive: true });
copyFileSync('theme/properties.css', 'docs/assets/theme/properties.css');
copyFileSync('theme/semantic.css',   'docs/assets/theme/semantic.css');
console.log('docs/assets/theme/ updated');
