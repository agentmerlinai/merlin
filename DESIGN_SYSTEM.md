# Merlin Design System

## Architecture

Three-layer token system:

| Layer | Role | Source |
|---|---|---|
| Primitives | Raw scales (colors, spacing, type) | `theme/tokens.js` |
| Semantics | Theme-aware mappings (bg, text, border) | `theme/semantic.css` |
| Components | Scoped styles per UI element | `ui/src/components/` |

- **Interactive preview**: `design-system.html` (hue sliders, theme toggle, contrast report, print-to-PDF)
- **Deep-dive guides**: `COLOR_GUIDE.md`, `SPATIAL_GUIDE.md`, `ILLUSTRATION_GUIDE.md`

## Color

### Semantic surface tokens

| Token | Light | Dark |
|---|---|---|
| `--bg-page` | `#f3f4ff` | `#292b34` |
| `--bg-surface` | `#ffffff` | `#3a3c49` |
| `--bg-muted` | `#e5e7f5` | `#4d4e5e` |
| `--bg-subtle` | `#d1d3e2` | `#636575` |

### Text tokens

| Token | Light | Dark |
|---|---|---|
| `--text-primary` | `#292b34` | `#f3f4ff` |
| `--text-secondary` | `#636575` | `#b4b6c7` |
| `--text-muted` | `#7d7f90` | `#989aab` |

### Brand tokens

| Token | Light | Dark |
|---|---|---|
| `--color-primary` | `#6d65fd` | `#7069fd` |
| `--color-accent` | `#f7c615` | `#fecb16` |
| `--color-success` | `#1af28e` | `#1dfe96` |
| `--color-error` | `#fd112e` | `#fd0f2e` |

### Foreground tokens (text-safe contrast)

`--color-primary-fg`, `--color-accent-fg`, `--color-success-fg`, `--color-error-fg`, `--color-warning-fg`

Dark/light theme swap via `data-theme` attribute on `<html>`.

--> Full spec: `COLOR_GUIDE.md`

## Typography

Font families from the Monaspace superfamily:

| Token | Face | Use |
|---|---|---|
| `--font-body` | MNeon | UI text, body |
| `--font-heading` | MXenon | Headings, display |
| `--font-caption` | MArgon | Captions, meta |
| `--font-code` | MNeon | Code |
| `--font-agent` | MKrypton | Agent voice, logs |
| `--font-prose` | MRadon | Long-form reading |

### Code block semantics

Monaspace works best when its metric-compatible families are mixed intentionally inside the same code sample rather than treating the whole block as a single monospace voice.

| Code role | Face | Why |
|---|---|---|
| Base syntax, punctuation, layout | `MNeon` | Neutral neo-grotesque default; keeps dense code readable |
| Keywords, operators, system language | `MKrypton` | Mechanical voice reinforces control flow and machine intent |
| Function names, call sites, API surfaces | `MXenon` | Slab serif adds structural emphasis without breaking alignment |
| Strings, labels, human-authored literals | `MArgon` | Humanist shapes soften content-bearing text and improve scan contrast |
| Comments, narrative explanation | `MRadon` | Handwriting-style voice clearly separates prose from executable syntax |

Recommended OpenType features for code blocks:

- `calt` for Monaspace texture healing
- `liga` for repeated-character spacing
- `ss01`-`ss04` for common equality, comparison, arrow, and markup ligatures

Avoid enabling all stylistic sets by default in UI code samples. Prefer the broadly useful sets above and add language-specific sets only when a component is dedicated to that language.

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

--> Full spec: `COLOR_GUIDE.md` Phase 3

## Spatial System

4 px base grid.

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

| Token | Value |
|---|---|
| `--radius-sm` | 4 px |
| `--radius-md` | 8 px |
| `--radius-lg` | 12 px |
| `--radius-xl` | 16 px |
| `--radius-full` | pill (`9999px`) |

**Key rule:** Gestalt proximity -- within-component spacing < between-group spacing x 0.5

--> Full spec: `SPATIAL_GUIDE.md`

## Icons

Library: **Phosphor Icons** (MIT license) -- https://phosphoricons.com
Packages: `@phosphor-icons/react` for React UI, inline SVG for static pages.

### Weight conventions

| Weight | Use case |
|---|---|
| `duotone` | Decorative / card icons (default) |
| `regular` | Inline with text, compact contexts |
| `fill` | Active / selected states |
| `bold` | Emphasis |

### Sizing (grounded in spatial tokens)

| Class | Token | Value | Context |
|---|---|---|---|
| `.icon` | `--space-8` | 32 px | Feature cards, spacious layouts |
| `.icon-sm` | `--space-8` | 32 px | Level cards, compact layouts |
| `.icon-inline` | `1em` | text size | Inline with text |

### Color

Always inherit via `currentColor`. Never hardcode. Set color on the parent element using design tokens.

### Duotone behavior

Single-color inheritance. Secondary layer renders at 20% opacity (Phosphor default). No two-color overrides.

### Accessibility

- **Decorative icons**: `aria-hidden="true"`
- **Icon-only buttons**: `aria-label` on the button, not the icon

### Landing page

Inline SVG (no CDN dependency, no FOUC, instant render).

### React apps

Import from `@phosphor-icons/react` (peer dependency in `@merlin/ui`):

```tsx
import { Monitor } from "@phosphor-icons/react";
<Monitor weight="duotone" size={32} />
```

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

`ui/src/components/` -- Button, Badge, Input, AgentCard. See `design-system.html` for interactive showcase.

## Interactive Preview

Open `design-system.html` in a browser for the full interactive reference:

- Real-time hue sliders for primary and accent colors
- Dark/light theme toggle
- WCAG contrast validation report
- Optimized for print-to-PDF (Chrome recommended)
