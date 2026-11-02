/* One registry for every face the brand studio can apply. The registry is the
   single source for the CSS family names, fallback stacks, role and preset
   maps, and the tracking each heading category needs. The generator, the store,
   the panel and the boot script all read from here.

   Licensing: Monaspace, IBM Plex and Source carry Reserved Font Names. Their
   files are vendored unmodified from the distributor; do not subset or rename
   them locally. See ./fonts/licenses and ./fonts/sources.json. */

export const FONT_ROLES = ['body', 'heading', 'caption', 'code', 'agent', 'prose'];
export const CODE_ROLES = ['keyword', 'string', 'fn', 'comment'];

/* The complete CSS surface the brand can move. The boot script and the store
   clear the same list; a role added here cannot be forgotten by one side. */
export const FONT_VAR_KEYS = [
  ...FONT_ROLES.map((role) => `--font-${role}`),
  ...CODE_ROLES.map((role) => `--font-code-${role}`),
  '--tracking-display',
  '--tracking-heading',
];

export const FONT_CATEGORIES = { sans: 'Sans', serif: 'Serif', mono: 'Mono' };

const MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const SANS_FALLBACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF_FALLBACK = "Georgia, 'Times New Roman', serif";

const mono = (name) => `'${name}', ${MONO_FALLBACK}`;
const sans = (name) => `'${name}', ${SANS_FALLBACK}`;
const serif = (name) => `'${name}', ${SERIF_FALLBACK}`;

/* `weights` is the variable range declared in @font-face. `reserved` records
   the OFL Reserved Font Name constraint so a future subsetting change cannot
   ignore it silently. */
export const FONT_FAMILIES = {
  MNeon:    { label: 'Monaspace Neon',    category: 'mono',  stack: mono('MNeon'),    weights: [200, 800], license: 'OFL-1.1', reserved: true },
  MXenon:   { label: 'Monaspace Xenon',   category: 'mono',  stack: mono('MXenon'),   weights: [200, 800], license: 'OFL-1.1', reserved: true },
  MArgon:   { label: 'Monaspace Argon',   category: 'mono',  stack: mono('MArgon'),   weights: [200, 800], license: 'OFL-1.1', reserved: true },
  MKrypton: { label: 'Monaspace Krypton', category: 'mono',  stack: mono('MKrypton'), weights: [200, 800], license: 'OFL-1.1', reserved: true },
  MRadon:   { label: 'Monaspace Radon',   category: 'mono',  stack: mono('MRadon'),   weights: [200, 800], license: 'OFL-1.1', reserved: true },

  Geist:            { label: 'Geist',            category: 'sans',  stack: sans('Geist'),            weights: [100, 900], license: 'OFL-1.1', reserved: false },
  'Geist Mono':     { label: 'Geist Mono',       category: 'mono',  stack: mono('Geist Mono'),       weights: [100, 900], license: 'OFL-1.1', reserved: false },
  Newsreader:       { label: 'Newsreader',       category: 'serif', stack: serif('Newsreader'),      weights: [200, 800], license: 'OFL-1.1', reserved: false },

  'IBM Plex Sans':  { label: 'IBM Plex Sans',    category: 'sans',  stack: sans('IBM Plex Sans'),    weights: [100, 700], license: 'OFL-1.1', reserved: true },
  'IBM Plex Serif': { label: 'IBM Plex Serif',   category: 'serif', stack: serif('IBM Plex Serif'),  weights: [100, 700], license: 'OFL-1.1', reserved: true },
  'IBM Plex Mono':  { label: 'IBM Plex Mono',    category: 'mono',  stack: mono('IBM Plex Mono'),    weights: [100, 700], license: 'OFL-1.1', reserved: true },

  'Source Sans 3':   { label: 'Source Sans 3',   category: 'sans',  stack: sans('Source Sans 3'),   weights: [200, 900], license: 'OFL-1.1', reserved: true },
  'Source Serif 4':  { label: 'Source Serif 4',  category: 'serif', stack: serif('Source Serif 4'),  weights: [200, 900], license: 'OFL-1.1', reserved: true },
  'Source Code Pro': { label: 'Source Code Pro', category: 'mono',  stack: mono('Source Code Pro'), weights: [200, 900], license: 'OFL-1.1', reserved: true },

  'Atkinson Hyperlegible Next': { label: 'Atkinson Hyperlegible Next', category: 'sans',  stack: sans('Atkinson Hyperlegible Next'), weights: [200, 800], license: 'OFL-1.1', reserved: false },
  'Atkinson Hyperlegible Mono': { label: 'Atkinson Hyperlegible Mono', category: 'mono',  stack: mono('Atkinson Hyperlegible Mono'), weights: [200, 800], license: 'OFL-1.1', reserved: false },
};

const codeAll = (family) => ({ keyword: family, string: family, fn: family, comment: family });

/* A preset names all six roles plus the four code sub-roles. Monaspace is the
   only preset that mixes faces inside a code block: its families are metric-
   compatible, so syntax keeps alignment while the voice changes. Every other
   preset collapses the code sub-roles to its code face; a proportional serif
   in a code block would break the grid. Labels are display copy: the two
   compound names carry soft hyphens so the five-up phone tile can wrap them
   instead of painting over its neighbour. Selects and the summary ignore the
   hint because the character only renders at a line break. */
export const TYPE_PRESETS = {
  monaspace: {
    label: 'Mono\u00ADspace',
    note: 'Technical',
    fonts: { body: 'MNeon', heading: 'MXenon', caption: 'MArgon', code: 'MNeon', agent: 'MKrypton', prose: 'MRadon' },
    code: { keyword: 'MKrypton', string: 'MArgon', fn: 'MXenon', comment: 'MRadon' },
  },
  geist: {
    label: 'Geist',
    note: 'Product',
    fonts: { body: 'Geist', heading: 'Geist', caption: 'Geist Mono', code: 'Geist Mono', agent: 'Geist Mono', prose: 'Newsreader' },
    code: codeAll('Geist Mono'),
  },
  plex: {
    label: 'Plex',
    note: 'Engineered',
    fonts: { body: 'IBM Plex Sans', heading: 'IBM Plex Serif', caption: 'IBM Plex Mono', code: 'IBM Plex Mono', agent: 'IBM Plex Mono', prose: 'IBM Plex Serif' },
    code: codeAll('IBM Plex Mono'),
  },
  source: {
    label: 'Source',
    note: 'Editorial',
    fonts: { body: 'Source Sans 3', heading: 'Source Serif 4', caption: 'Source Code Pro', code: 'Source Code Pro', agent: 'Source Code Pro', prose: 'Source Serif 4' },
    code: codeAll('Source Code Pro'),
  },
  hyperlegible: {
    label: 'Hyper\u00ADlegible',
    note: 'Accessible',
    fonts: { body: 'Atkinson Hyperlegible Next', heading: 'Atkinson Hyperlegible Next', caption: 'Atkinson Hyperlegible Mono', code: 'Atkinson Hyperlegible Mono', agent: 'Atkinson Hyperlegible Mono', prose: 'Newsreader' },
    code: codeAll('Atkinson Hyperlegible Mono'),
  },
};

export const DEFAULT_TYPE = { preset: 'monaspace' };

export function isFontFamily(value) {
  return typeof value === 'string' && Object.hasOwn(FONT_FAMILIES, value);
}

export function isTypePreset(value) {
  return typeof value === 'string' && Object.hasOwn(TYPE_PRESETS, value);
}

function requirePreset(selection) {
  const preset = TYPE_PRESETS[selection?.preset];
  if (!preset) throw new Error(`Unknown type preset "${selection?.preset}"`);
  return preset;
}

function requireFamily(family) {
  const face = FONT_FAMILIES[family];
  if (!face) throw new Error(`Unknown font family "${family}"`);
  return face;
}

/* Resolve a selection to the six role families. Overrides are per role so a
   preset stays a starting point, not a lock. */
export function resolveFonts(selection = DEFAULT_TYPE) {
  const preset = requirePreset(selection);
  const fonts = { ...preset.fonts };
  const overrides = selection.overrides ?? {};
  for (const role of FONT_ROLES) {
    if (overrides[role] !== undefined) fonts[role] = overrides[role];
  }
  for (const role of FONT_ROLES) requireFamily(fonts[role]);
  return fonts;
}

/* The code mix survives only while the preset owns the code role. Picking a
   different code face collapses the mix, because the metric contract is gone. */
export function resolveCode(selection = DEFAULT_TYPE) {
  const preset = requirePreset(selection);
  const fonts = resolveFonts(selection);
  const overrides = selection.overrides ?? {};
  if (selection.preset === 'monaspace' && overrides.code === undefined) return { ...preset.code };
  return codeAll(fonts.code);
}

/* Every face a preset can show, deduped. The preload reads the same registry as
   the resolver, so a new preset or role cannot be forgotten. */
export function presetFamilies(preset) {
  const p = requirePreset({ preset });
  return [...new Set([...Object.values(p.fonts), ...Object.values(p.code)])];
}

export function allFamilies() {
  return [...new Set(Object.keys(TYPE_PRESETS).flatMap(function (preset) {
    return presetFamilies(preset);
  }))];
}

/* Start every bundled face after first paint. A switch then never swaps a
   fallback in; the registry stays the only list of what to load. */
let preloadStarted = false;
function loadFamilies(families) {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return Promise.all(families.map(function (family) {
    return document.fonts.load(`16px "${family}"`);
  }));
}

export function preloadTypefaces() {
  if (preloadStarted) return Promise.resolve();
  preloadStarted = true;
  return loadFamilies(allFamilies()).then(function () {}, function (error) {
    /* A failed face must not latch the preload off: the next selection retries. */
    preloadStarted = false;
    console.error('fonts: typeface preload failed', error);
  });
}

/* The faces one preset needs. `selectPreset` applies the family immediately;
   the hero waits only for these faces before it measures the new boxes. */
export function loadPreset(preset) {
  return loadFamilies(presetFamilies(preset)).then(function () {}, function (error) {
    console.error('fonts: typeface load failed', error);
  });
}

export function fontStack(family) {
  return requireFamily(family).stack;
}

/* The single writer for the CSS font layer. `body` and `code` are the two
   groups the UI edits; `code` may be partial (missing sub-roles fall back to
   the code face). */
export function fontVars(fonts, code) {
  const vars = {};
  for (const role of FONT_ROLES) vars[`--font-${role}`] = fontStack(fonts[role]);
  const codeMap = { ...codeAll(fonts.code), ...code };
  for (const role of CODE_ROLES) vars[`--font-code-${role}`] = fontStack(codeMap[role]);
  const heading = requireFamily(fonts.heading);
  const serif = heading.category === 'serif';
  vars['--tracking-display'] = serif ? '-0.012em' : '-0.03em';
  vars['--tracking-heading'] = serif ? '-0.005em' : '-0.02em';
  return vars;
}
