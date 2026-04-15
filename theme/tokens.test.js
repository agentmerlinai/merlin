import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeTheme, generateCSS } from './tokens.js';
import { computeOptimalShade, maxGamutChroma, contrastRatio, oklchToHex } from './oklch.js';

describe('computeTheme()', () => {
  it('does not throw for default args', () => {
    assert.doesNotThrow(() => computeTheme());
  });

  it('does not throw for boundary hues', () => {
    assert.doesNotThrow(() => computeTheme({ primaryHue: 0, accentHue: 0 }));
    assert.doesNotThrow(() => computeTheme({ primaryHue: 360, accentHue: 360 }));
  });

  it('returns required top-level keys', () => {
    const result = computeTheme();
    assert.ok('palettes' in result);
    assert.ok('primitives' in result);
    assert.ok('semanticLight' in result);
    assert.ok('semanticDark' in result);
  });

  it('primary palette has exactly 11 steps (50–950)', () => {
    const { palettes } = computeTheme();
    const steps = palettes.primary.filter(s => !s.isCTA);
    assert.equal(steps.length, 11);
  });

  it('semanticDark differs from semanticLight', () => {
    const { semanticLight, semanticDark } = computeTheme();
    const differs = Object.keys(semanticLight).some(k => semanticLight[k] !== semanticDark[k]);
    assert.ok(differs, 'semanticDark and semanticLight must not be identical');
  });

  it('is deterministic', () => {
    const args = { primaryHue: 200, accentHue: 45 };
    const a = computeTheme(args);
    const b = computeTheme(args);
    assert.deepEqual(a.semanticLight, b.semanticLight);
    assert.deepEqual(a.semanticDark, b.semanticDark);
    assert.deepEqual(a.primitives, b.primitives);
  });

  it('accent vibrancy: key shades use ≥95% of hue gamut (bell-center regression)', () => {
    // H90: gamut peaks at L≈0.86 → shade-200 was ~79% with fixed bell at L=0.6
    const { palettes: p90 } = computeTheme({ accentHue: 90 });
    const s200 = p90.accent.find(s => s.name === 200);
    const g200 = maxGamutChroma(s200.L, s200.hue);
    assert.ok(s200.C / g200 >= 0.95,
      `accent H90/200: ${(s200.C/g200*100).toFixed(1)}% gamut — expected ≥95%`);

    // H90 shade-400 (existing check, keep it)
    const s400 = p90.accent.find(s => s.name === 400);
    const g400 = maxGamutChroma(s400.L, s400.hue);
    assert.ok(s400.C / g400 >= 0.95,
      `accent H90/400: ${(s400.C/g400*100).toFixed(1)}% gamut — expected ≥95%`);

    // H280: gamut peaks at L≈0.49 → shade-600 still checked (was already passing)
    const { palettes: p280 } = computeTheme({ accentHue: 280 });
    const s600 = p280.accent.find(s => s.name === 600);
    const g600 = maxGamutChroma(s600.L, s600.hue);
    assert.ok(s600.C / g600 >= 0.95,
      `accent H280/600: ${(s600.C/g600*100).toFixed(1)}% gamut — expected ≥95%`);
  });

  it('no scale shade exceeds its hue gamut boundary', () => {
    const { palettes } = computeTheme();
    for (const [role, scale] of Object.entries(palettes)) {
      for (const s of scale) {
        if (s.isCTA) continue;
        const gamut = maxGamutChroma(s.L, s.hue);
        assert.ok(s.C <= gamut + 0.001,
          `${role}/${s.name}: C=${s.C.toFixed(4)} exceeds gamut=${gamut.toFixed(4)}`);
      }
    }
  });
});

describe('oklch.js', () => {
  it('maxGamutChroma returns value in [0, 0.4]', () => {
    const c = maxGamutChroma(0.6, 280);
    assert.ok(c >= 0 && c <= 0.4);
  });

  it('computeOptimalShade returns non-null for any hue against white bg', () => {
    const result = computeOptimalShade(90, '#ffffff');
    assert.ok(result !== null);
    assert.ok(result.hex.startsWith('#'));
  });

  it('computeOptimalShade result passes WCAG AA with its text color', () => {
    const result = computeOptimalShade(90, '#ffffff');
    const cr = contrastRatio(result.hex, result.textColor);
    assert.ok(cr >= 4.5, `contrast ${cr.toFixed(2)} below 4.5:1`);
  });

  it('dark-mode lifts low-L-peak hues (violet) to be lighter than light-mode', () => {
    // Violet peaks at L≈0.50, below the dark-surface floor (bgL+0.18≈0.54).
    // Light mode finds the true peak; dark mode is forced to a lighter shade.
    const { palettes } = computeTheme({ accentHue: 280 });
    const light = palettes.accent.ctaLight;
    const dark  = palettes.accent.ctaDark;
    assert.ok(dark.L > light.L,
      `dark L=${dark.L.toFixed(2)} should exceed light L=${light.L.toFixed(2)} for violet`);
    assert.notEqual(light.hex, dark.hex, 'light and dark must produce different shades for violet');
  });

  it('oklchToHex produces valid hex for in-gamut values', () => {
    const hex = oklchToHex(0.6, 0.1, 280);
    assert.match(hex, /^#[0-9a-f]{6}$/);
  });
});

describe('generated file sync-check', () => {
  const __dir = dirname(fileURLToPath(import.meta.url));

  it('semantic.css matches generateCSS() output', () => {
    const onDisk = readFileSync(join(__dir, 'semantic.css'), 'utf8');
    const expected = '/* Generated by theme/generate.js — do not edit manually */\n\n' + generateCSS();
    assert.strictEqual(onDisk, expected, 'semantic.css is stale — run npm run generate');
  });

  it('properties.css initial-values match default theme semanticLight', () => {
    const onDisk = readFileSync(join(__dir, 'properties.css'), 'utf8');
    const { semanticLight } = computeTheme();
    const shadowKeys = new Set(['--shadow-sm', '--shadow-md', '--shadow-lg']);
    for (const [k, v] of Object.entries(semanticLight)) {
      if (shadowKeys.has(k)) continue;
      assert.ok(
        onDisk.includes(`initial-value: ${v}`),
        `properties.css stale: missing initial-value: ${v} for ${k} — run npm run generate`
      );
    }
  });
});
