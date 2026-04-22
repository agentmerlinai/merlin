import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { icons } from './icons.mjs';

function validateSpriteReferences() {
  const htmlFiles = readdirSync('docs').filter((name) => name.endsWith('.html'));
  const referencedIds = new Set();

  for (const fileName of htmlFiles) {
    const html = readFileSync(`docs/${fileName}`, 'utf8');
    const matches = html.matchAll(/assets\/icons\/sprite\.svg#([A-Za-z0-9-]+)/g);
    for (const [, id] of matches) {
      referencedIds.add(id);
    }
  }

  const missingIds = [...referencedIds].filter((id) => !(id in icons));
  if (missingIds.length > 0) {
    throw new Error(`Missing sprite symbols: ${missingIds.join(', ')}`);
  }
}

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
validateSpriteReferences();
console.log('docs/assets/icons/sprite.svg generated');

mkdirSync('docs/assets/theme', { recursive: true });
copyFileSync('theme/properties.css', 'docs/assets/theme/properties.css');
copyFileSync('theme/semantic.css',   'docs/assets/theme/semantic.css');
console.log('docs/assets/theme/ updated');
