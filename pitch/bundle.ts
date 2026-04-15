#!/usr/bin/env -S deno run --allow-read --allow-write
// Merlin
// Bundles the presentation into a single self-contained HTML file.
// All CSS, JS, and markdown are inlined. Output: dist/merlin-pitch.html

// One-time setup — populate pitch/ui/dist/ from a Reveal.js 5.x release.
// Required files: dist/reset.css, dist/reveal.css, dist/theme/black.css, dist/reveal.js
//
//   REVEAL=5.2.1
//   curl -L https://github.com/hakimel/reveal.js/archive/refs/tags/${REVEAL}.tar.gz | \
//     tar -xz -C /tmp reveal.js-${REVEAL}/dist/
//   mkdir -p pitch/ui/dist/theme
//   cp /tmp/reveal.js-${REVEAL}/dist/{reset.css,reveal.css,reveal.js} pitch/ui/dist/
//   cp /tmp/reveal.js-${REVEAL}/dist/theme/black.css pitch/ui/dist/theme/
//   rm -rf /tmp/reveal.js-${REVEAL}
//
// Plugin files in pitch/ui/plugin/ are already committed.

const dir = import.meta.dirname + "/ui";

const read = (path: string) => Deno.readTextFileSync(dir + path);

const resetCss = read("/dist/reset.css");
const revealCss = read("/dist/reveal.css");
const themeCss = read("/dist/theme/black.css");
const highlightCss = read("/plugin/highlight/monokai.css");

const revealJs = read("/dist/reveal.js");
const markdownJs = read("/plugin/markdown/markdown.js");
const highlightJs = read("/plugin/highlight/highlight.js");
const notesJs = read("/plugin/notes/notes.js");

// Inline SVG images: ![alt](name.svg) → raw SVG contents
const slidesMd = read("/slides.md").replace(
  /!\[[^\]]*\]\((\S+?\.svg)\)/g,
  (_, name: string) => read("/" + name),
);

// The markdown plugin's external file loading won't work in a single file,
// so we inline the markdown into a <script type="text/template"> block.
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Merlin 🔥 — Pitch</title>
    <style>${resetCss}</style>
    <style>${revealCss}</style>
    <style>${themeCss}</style>
    <style>${highlightCss}</style>
    <style>
      .reveal h2 { font-size: 1.4em; margin-bottom: 0.5em; }
      .reveal h3 { font-size: 1em; margin-bottom: 0.3em; }
      .reveal table { font-size: 0.7em; }
      .reveal pre { font-size: 0.48em; width: 100%; margin: 0.4em 0; }
      .reveal pre code { max-height: none; padding: 0.8em; }
      .reveal blockquote { font-size: 0.85em; font-style: italic; background: rgba(255,255,255,0.05); border-left: 4px solid #58a6ff; padding: 0.6em 1em; }
      .reveal .slides section {
        text-align: left;
        padding: 40px 60px;
        box-sizing: border-box;
      }
      .reveal ul, .reveal ol { font-size: 0.8em; line-height: 1.5; }
      .reveal p { font-size: 0.8em; line-height: 1.4; }
      .reveal li { margin-bottom: 0.2em; }
      .reveal section p:has(> em:only-child) {
        font-size: 0.4em;
        opacity: 0.5;
      }
      .reveal section blockquote p:has(> em:only-child) {
        font-size: inherit;
        opacity: 1;
      }
      .split {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 2em;
        align-items: start;
      }
      .reveal section svg {
        width: 100%;
        max-height: 55vh;
      }
      .reveal section p:has(> em:only-child) a {
        color: inherit;
        text-decoration: underline;
        text-decoration-style: dotted;
      }
    </style>
  </head>
  <body>
    <div class="reveal">
      <div class="slides">
        <section
          data-markdown
          data-separator="^\\n---\\n"
          data-separator-vertical="^\\n----\\n"
          data-separator-notes="^> \\*Speaker note:">
          <script type="text/template">
${slidesMd}
          </script>
        </section>
      </div>
    </div>
    <script>${revealJs}<\/script>
    <script>${markdownJs}<\/script>
    <script>${highlightJs}<\/script>
    <script>${notesJs}<\/script>
    <script>
      Reveal.initialize({
        hash: true,
        width: "100%",
        height: "100%",
        margin: 0.05,
        center: false,
        minScale: 1,
        maxScale: 1,
        plugins: [RevealMarkdown, RevealHighlight, RevealNotes],
      });
    <\/script>
  </body>
</html>`;

await Deno.mkdir(import.meta.dirname + "/dist", { recursive: true });
await Deno.writeTextFile(import.meta.dirname + "/dist/merlin-pitch.html", html);

const size = (await Deno.stat(import.meta.dirname + "/dist/merlin-pitch.html")).size;
console.log(`Bundled: dist/merlin-pitch.html (${(size / 1024).toFixed(0)} KB)`);
