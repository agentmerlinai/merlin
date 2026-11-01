# Merlin Design System

## Architecture

Three-layer token system:

| Layer | Role | Source |
|---|---|---|
| Primitives | Raw scales (colors, spacing, type) | `packages/theme/tokens.js` |
| Semantics | Theme-aware mappings (bg, text, border) | `packages/theme/semantic.css` |
| Components | Scoped styles per UI element | `packages/ui/src/components/` |

- **Interactive preview**: `/design-system/` (hue sliders, theme toggle, contrast report, print-to-PDF)
- **Deep-dive guides**: `COLOR_GUIDE.md`, `SPATIAL_GUIDE.md`, `ILLUSTRATION_GUIDE.md`

## Color

### Semantic surface tokens

| Token | Light | Dark |
|---|---|---|
| `--bg-page` | `#f3f4ff` | `#292b34` |
| `--bg-surface` | `#f9faff` | `#3a3c49` |
| `--bg-muted` | `#e5e7f5` | `#4d4e5e` |
| `--bg-subtle` | `#d1d3e2` | `#636575` |

### Text tokens

| Token | Light | Dark |
|---|---|---|
| `--text-primary` | `#292b34` | `#f3f4ff` |
| `--text-secondary` | `#636575` | `#b4b6c7` |
| `--text-muted` | `#7d7f90` | `#989aab` |

### Brand tokens

Default theme values. Run `npm run generate` after changing the hue pair.

| Token | Light | Dark |
|---|---|---|
| `--color-primary` | `#5510fc` | `#5510fc` |
| `--color-accent` | `#f3c215` | `#fecb16` |
| `--color-success` | `#1aebac` | `#1dfeb9` |
| `--color-error` | `#fc0f44` | `#fb0f44` |

### Brand mark inks

The hat is an illustration, not a UI icon. Its four inks are explicit theme
roles: `--brand-outline`, `--brand-body`, `--brand-shadow`, and
`--brand-accent`. `packages/theme/tokens.js` computes them from the same
palette as the page. `scripts/brand-ink.mjs` owns the source-ink map; both the
live sprite and `scripts/gen-brand.mjs` resolve the same roles.

The contour is line art. It stays the darkest layer in both themes, so folds
read as ink, not as highlights. Dark lifts only the body and shadow fills to
separate them from the dark plate; it never flips the contour. Do not bind
brand inks to `--text-*` or `--bg-*` roles.

### Foreground tokens (text-safe contrast)

`--color-primary-fg`, `--color-accent-fg`, `--color-success-fg`, `--color-error-fg`, `--color-warning-fg`

Dark/light theme swap via `data-theme` attribute on `<html>`.

--> Full spec: `COLOR_GUIDE.md`

## Typography

The brand studio ships five type presets. Monaspace is the default; the other
presets trade voices without changing the token roles, so every surface
recomposes from the same six declarations.

| Preset | Interface | Heading | Reading | Code |
|---|---|---|---|---|
| Monaspace (default) | Monaspace Neon | Monaspace Xenon | Monaspace Radon | Monaspace Neon / Krypton / Xenon / Argon / Radon |
| Geist | Geist | Geist | Newsreader | Geist Mono |
| Plex | IBM Plex Sans | IBM Plex Serif | IBM Plex Serif | IBM Plex Mono |
| Source | Source Sans 3 | Source Serif 4 | Source Serif 4 | Source Code Pro |
| Hyperlegible | Atkinson Hyperlegible Next | Atkinson Hyperlegible Next | Newsreader | Atkinson Hyperlegible Mono |

The studio lives in the nav ("Your brand"). It chooses the hue pair, one
typeface, one icon kit, and one corner style. Every choice persists in
`merlin-brand` (version 3) and is restored before first paint, so the page
never flashes a default face or shape.

### Tokens

| Token | Role |
|---|---|
| `--font-body` | UI text, body |
| `--font-heading` | Headings, display |
| `--font-caption` | Captions, meta |
| `--font-code` | Code, base syntax |
| `--font-agent` | Agent voice, logs |
| `--font-prose` | Long-form reading |
| `--font-code-keyword` | Keywords, operators |
| `--font-code-string` | Strings and literals |
| `--font-code-fn` | Function names, call sites |
| `--font-code-comment` | Comments, narrative |
| `--tracking-display` | Display tracking; serif headings get less negative tracking |
| `--tracking-heading` | Section heading tracking |

Each value is a full fallback stack, not a bare family name. The registry in
`packages/theme/fonts.js` is the single source for family names, stacks,
weights, presets, and the code mix; the panel, the generator, and the boot
script all read it. Unknown families fail loudly.

In Monaspace the four code roles use different metric-compatible faces. Every
other preset collapses them to its code face: a proportional serif inside a
code block would break alignment.

### Code block semantics (default preset)

Monaspace works best when its metric-compatible families are mixed intentionally inside the same code sample rather than treating the whole block as a single monospace voice.

| Code role | Face | Why |
|---|---|---|
| Base syntax, punctuation, layout | `MNeon` | Neutral neo-grotesque default; keeps dense code readable |
| Keywords, operators, system language | `MKrypton` | Mechanical voice reinforces control flow and machine intent |
| Function names, call sites, API surfaces | `MXenon` | Slab serif adds structural emphasis without breaking alignment |
| Strings, labels, human-authored literals | `MArgon` | Humanist shapes soften content-bearing text and improve scan contrast |
| Comments, narrative explanation | `MRadon` | Handwriting-style voice clearly separates prose from executable syntax |

Recommended OpenType features for Monaspace code blocks:

- `calt` for Monaspace texture healing
- `liga` for repeated-character spacing
- `ss01`-`ss04` for common equality, comparison, arrow, and markup ligatures

Avoid enabling all stylistic sets by default in UI code samples. Prefer the broadly useful sets above and add language-specific sets only when a component is dedicated to that language. Other presets ignore these features; they keep `calt` and `liga` only.

### Size scale (Major Third 1.25x, base 16 px)

| Token | Value |
|---|---|
| `--font-size-xs` | 10.2 px |
| `--font-size-sm` | 12.8 px |
| `--font-size-base` | 16 px |
| `--font-size-md` | 20 px |
| `--font-size-lg` | 25 px |
| `--font-size-xl` | 31.3 px |
| `--font-size-2xl` | 39.1 px |
| `--font-size-3xl` | 48.8 px |
| `--font-size-4xl` | 61 px |

### Line-height and tracking

| Token | Value |
|---|---|
| `--leading-tight` | 1.25 |
| `--leading-normal` | 1.5 |
| `--leading-relaxed` | 1.75 |
| `--tracking-tight` | -0.01 em |
| `--tracking-normal` | 0 |
| `--tracking-wide` | 0.04 em |
| `--tracking-display` | -0.03 em (sans/mono) or -0.012 em (serif) |
| `--tracking-heading` | -0.02 em (sans/mono) or -0.005 em (serif) |

### Licensing and loading

All faces are OFL-1.1 and self-hosted under `packages/theme/fonts/`; there is no
font CDN. `fonts/sources.json` records the source package, version, and sha256
for every file, and `fonts/licenses/` holds the OFL texts. Monaspace, IBM Plex,
and Source carry Reserved Font Names: keep the vendored files unmodified. To
subset one of them later, rename the family and record the change.

Every preset is preloaded after first paint, so selecting a face is a relayout,
not a fallback swap. `font-display: swap` remains a safety net. The studio
waits for the selected preset's faces, then remeasures the hero seam boxes.

--> Full spec: `COLOR_GUIDE.md` Phase 3

## Spatial System

4 px base grid.

The hero miniature is a scaled surface, not a second system. It uses the small end of the scale: 2, 4, 6, 8, and 12 px. Components inside it consume those tokens. No literal spacing.

### Spacing scale

| Token | Value |
|---|---|
| `--space-0_5` | 2 px |
| `--space-1` | 4 px |
| `--space-1_5` | 6 px |
| `--space-2` | 8 px |
| `--space-3` | 12 px |
| `--space-4` | 16 px |
| `--space-5` | 20 px |
| `--space-6` | 24 px |
| `--space-8` | 32 px |
| `--space-10` | 40 px |
| `--space-12` | 48 px |
| `--space-16` | 64 px |
| `--space-20` | 80 px |
| `--space-24` | 96 px |

### Semantic aliases

- **Gap**: `--space-gap-sm` 8 px, `--space-gap-md` 12 px, `--space-gap-lg` 20 px
- **Stack**: `--space-stack-xs` 4 px, `--space-stack-sm` 8 px, `--space-stack-md` 16 px, `--space-stack-lg` 24 px, `--space-stack-xl` 40 px
- **Inset**: `--space-inset-sm` 8 px, `--space-inset-md` 16 px, `--space-inset-lg` 24 px

### Border radius

The studio ships three corner styles. Each keeps the nesting rule: panel
`xl` > well `lg` > plate `md`.

| Token | Soft (default) | Sharp | Round |
|---|---|---|---|
| `--radius-none` | 0 | 0 | 0 |
| `--radius-sm` | 4 px | 0 | 8 px |
| `--radius-md` | 8 px | 2 px | 14 px |
| `--radius-lg` | 12 px | 4 px | 20 px |
| `--radius-xl` | 16 px | 6 px | 28 px |
| `--radius-full` | pill (`9999px`) | 2 px | pill (`9999px`) |

`--radius-full` follows the style, so Sharp also squares pills and chips.
Illustration micro-radii (1–3 px, `50%`) are artwork and stay fixed.

**Key rule:** Gestalt proximity -- within-component spacing < between-group spacing x 0.5

--> Full spec: `SPATIAL_GUIDE.md`

## Elevation & surfaces

The page uses one depth language. Every surface takes one of three roles:

| Role | Fill | Radius | Shadow | Use |
|---|---|---|---|---|
| Panel | `--bg-surface` | `--radius-xl` | `--shadow-lg` | Card that lifts off the page |
| Well | `--bg-page` | `--radius-lg` | none | Region recessed into a panel |
| Plate | `--bg-surface` | `--radius-md` | none | Row or node raised inside a panel or well |

Recipe: `packages/theme/surfaces.css` (`.surface-panel`, `.surface-well`, `.surface-plate`). Components name the role in markup and keep layout only.

### Rules

- **Depth is a fill step plus one shadow.** Never add a per-component shadow, gradient, or hex fill.
- **Tint by overriding, not forking.** Set `--panel-fill` / `--panel-border` (or the well/plate pair) to keep a semantic color on the shared stack. The topology core and the GoatDB sink are violet plates and panels built this way.
- **Radius shrinks as the layer nests:** panel `xl` > well `lg` > plate `md`.
- **Static panels do not move on hover.** Only interactive panels lift 1 px and darken their border; the shadow token stays at the panel level.

### Shadow scale

| Token | Use |
|---|---|
| `--shadow-sm` | Contact depth for small controls |
| `--shadow-md` | Floating element inside a page region |
| `--shadow-lg` | Page-level panel (the only shadow the surface stack uses) |

Preview: `/design-system/` section 5 shows the stack next to the three shadow tokens.

## Icons

Three kits share one canonical glyph vocabulary. The studio chooses the kit;
markup names only the glyph, so a kit change never touches a component.

| Kit | Drawing | License | Source |
|---|---|---|---|
| **Phosphor** (default) | Filled duotone, rounded, 256 grid | MIT | `phosphoricons.com` |
| **Lucide** | Stroke 2 px, round caps, 24 grid | ISC | `lucide-static` 1.66.0 |
| **Pixelarticons** | Pixel-art blocks, 24 grid, no anti-aliasing | MIT | `pixelarticons` 2.4.2 |

### Source of truth

`scripts/icon-kits/manifest.mjs` holds the canonical names and the upstream
name for every kit. `scripts/icons.mjs` composes the flat sprite registry from
`scripts/icon-kits/{phosphor,lucide,pixel}.mjs`. Vendored paths are
regenerated with `node scripts/gen-icon-kits.mjs`; licenses and pinned versions
live in `scripts/icon-kits/`.

The build inlines every kit as one `<symbol>` sprite on every page. Source code
names a canonical id (`icon-chat-circle`); the `Icon` component emits one
`<use>` per kit and the root `data-icon-kit` attribute reveals exactly one.

- The sprite is the registry, never a page's rendered subset: the client can
  switch kits, so a page-derived sprite would paint empty boxes.
- Every kit must carry every canonical name; `tests/icons.test.mjs` enforces
  that and a 64 KiB sprite budget.
- `scripts/postbuild.mjs` fails on a document reference with no registry entry.
- `gh-logo` is a partner mark, not a UI glyph, and never swaps.

Add an icon by adding one row to the manifest, adding its upstream name to all
three kits, and using the canonical id in the same change.

### Weight conventions

| Kit | Default | State changes |
|---|---|---|
| Phosphor | `duotone` for decorative, `regular` inline | `fill` active, `bold` emphasis |
| Lucide | One stroke weight (2 px at 24) | Color and size only; no weight family |
| Pixelarticons | One block weight | Color and size only; no weight family |

Pixelart draws on a 24-unit grid, so it is crispest at 24/48 px. At the
component sizes below, the pixel kit alone snaps edges with
`shape-rendering: crispEdges`; partner marks stay smooth.

Do not mix kits inside one surface. The studio choice is global so the page
keeps one drawing hand.

### Sizing (grounded in spatial tokens)

| Class | Token | Value | Context |
|---|---|---|---|
| `.icon` | `--space-8` | 32 px | Feature cards, spacious layouts |
| `.icon-sm` | `--space-8` | 32 px | Level cards, compact layouts |
| `.icon-inline` | `1em` | text size | Inline with text |

### Color

Always inherit via `currentColor`. Never hardcode. Set color on the parent element using design tokens.

### Duotone behavior

Phosphor only. Single-color inheritance; the secondary layer renders at 20%
opacity. Lucide and Pixelarticons are single-layer drawings.

### Accessibility

- **Decorative icons**: `aria-hidden="true"`
- **Icon-only buttons**: `aria-label` on the button, not the icon
- **Kit choice**: visual only; it changes no label, role, or reading order

## Illustrations

Shape system grounded in superellipse math, Gestalt grouping, and PAD emotional mapping.

--> Full spec: `ILLUSTRATION_GUIDE.md`

## Components

### Landing page card pattern

`display: flex; flex-direction: column; align-items: flex-start; gap: <token>`

| Card type | Gap token | Padding | Radius |
|---|---|---|---|
| Feature card | `--space-gap-md` (12 px) | `--space-6` | `--radius-xl` |
| Level card | `--space-gap-sm` (8 px) | `--space-5` / `--space-4` | `--radius-lg` |

### UI library

`packages/ui/src/components/` -- Button, Badge, Input, AgentCard. See `/design-system/` for interactive showcase.

## Interactive Preview

Open `/design-system/` in a browser for the full interactive reference:

- Real-time hue sliders for primary and accent colors
- Icon kit and corner-style choosers, shared with the nav studio
- Dark/light theme toggle
- WCAG contrast validation report
- Optimized for print-to-PDF (Chrome recommended)
