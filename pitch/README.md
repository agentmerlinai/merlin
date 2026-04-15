# Merlin 🔥 Pitch Deck

Reveal.js presentation bundled into a single self-contained HTML file.

## Source of Truth

- `../Merlin-Pitch.md` — canonical content source (full citations, speaker notes)
- `ui/slides.md` — presentation-formatted version (Reveal.js layout, inline citations)

When updating pitch content: edit `Merlin-Pitch.md` first, then propagate to `slides.md`.
These files serve different audiences and are intentionally not identical, but content must remain in sync.

## Edit

Edit `ui/slides.md` — standard markdown with `---` as slide separators. Speaker notes start with `> *Speaker note:`.

## Build

```bash
deno run --allow-read --allow-write bundle.ts
```

Output: `dist/merlin-pitch.html` (~1.2 MB). Double-click to open in any browser.

## Present

Open `dist/merlin-pitch.html` and press **F** for fullscreen. Arrow keys navigate. Press **S** to open the speaker notes window.

## Structure

```
pitch/
├── bundle.ts        # bundles slides + reveal.js into one HTML file
├── ui/
│   ├── slides.md    # presentation content (source of truth)
│   ├── dist/        # reveal.js core (CSS, JS)
│   └── plugin/      # reveal.js plugins (markdown, highlight, notes)
└── dist/
    └── merlin-pitch.html  # generated output
```
