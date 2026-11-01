// packages/theme/generate.js — regenerates semantic.css and properties.css from tokens.js
// Run: npm run generate
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { CSS_HEADER, computeTheme, generateCSS } from './tokens.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// semantic.css — full generated token CSS
const header = CSS_HEADER;
writeFileSync(join(__dirname, 'semantic.css'), header + generateCSS(), 'utf8');
console.log('Wrote packages/theme/semantic.css');

// properties.css — @property declarations for all color-typed semantic tokens
const { semanticLight } = computeTheme();
const shadowKeys = new Set(['--shadow-sm', '--shadow-md', '--shadow-lg']);
const declarations = Object.entries(semanticLight)
  .filter(([k]) => !shadowKeys.has(k))
  .map(([k, v]) => `@property ${k} { syntax: '<color>'; inherits: true; initial-value: ${v}; }`)
  .join('\n');
writeFileSync(join(__dirname, 'properties.css'), header + declarations + '\n', 'utf8');
console.log('Wrote packages/theme/properties.css');
