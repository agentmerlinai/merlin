import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEMANTIC_FIELDS, SEMANTIC_ROLES, MIN_BRAND_GAP, MIN_SEMANTIC_GAP,
  brandClimate, resolveSemanticHues, snapTheme, shortestDelta,
} from './semantic-fields.js';
import { computeTheme } from './tokens.js';
import { contrastRatio } from './oklch.js';

const PRESETS = {
  arcane: [280, 90],
  meridian: [235, 160],
  bloom: [135, 330],
  ember: [12, 45],
};

const snappedTheme = (primaryHue, accentHue) => {
  const snapped = snapTheme(primaryHue, accentHue);
  return { snapped, theme: computeTheme({ primaryHue: snapped.primaryHue, accentHue: snapped.accentHue }) };
};

const wrap = (hue) => ((hue % 360) + 360) % 360;

describe('semantic hue fields', () => {
  it('moves the climate from warm to cool', () => {
    assert.ok(brandClimate(50, 50).climate > 0.99);
    assert.ok(brandClimate(230, 230).climate < -0.99);
  });

  it('keeps every role inside its colour-category window for every brand pair', () => {
    for (let primaryHue = 0; primaryHue < 360; primaryHue += 5) {
      for (let accentHue = 0; accentHue < 360; accentHue += 5) {
        const { hues } = resolveSemanticHues(primaryHue, accentHue);
        for (const role of SEMANTIC_ROLES) {
          const [lo, hi] = SEMANTIC_FIELDS[role].window;
          assert.ok(hues[role] >= lo - 1e-9 && hues[role] <= hi + 1e-9,
            `${role} ${hues[role]} outside [${lo}, ${hi}] at ${primaryHue}/${accentHue}`);
        }
        assert.ok(hues.error < hues.warning && hues.warning < hues.success,
          `order broken at ${primaryHue}/${accentHue}`);
      }
    }
  });

  it('moves every semantic hue when the brand pair changes', () => {
    const a = resolveSemanticHues(280, 90).hues;
    const snapped = snapTheme(235, 160);
    const b = resolveSemanticHues(snapped.primaryHue, snapped.accentHue).hues;
    for (const role of SEMANTIC_ROLES) assert.notEqual(a[role], b[role], role);
  });

  it('rejects non-finite input instead of failing open', () => {
    assert.equal(resolveSemanticHues(NaN, 90).diagnostics.feasible, false);
    assert.equal(snapTheme(NaN, 90).diagnostics.feasible, false);
  });

  it('is deterministic', () => {
    assert.deepEqual(resolveSemanticHues(200, 45), resolveSemanticHues(200, 45));
  });

  it('snaps every preset to a feasible pair within the movement budget', () => {
    for (const [name, [primaryHue, accentHue]] of Object.entries(PRESETS)) {
      const snapped = snapTheme(primaryHue, accentHue);
      assert.equal(snapped.diagnostics.feasible, true, `${name} is still infeasible`);
      assert.ok(Math.abs(shortestDelta(primaryHue, snapped.primaryHue)) <= 30, `${name} primary moved too far`);
      assert.ok(Math.abs(shortestDelta(accentHue, snapped.accentHue)) <= 30, `${name} accent moved too far`);
      assert.equal(snapTheme(snapped.primaryHue, snapped.accentHue).snapped, false, `${name} is not stable`);
    }
  });

  it('chooses the smallest single-knob snap', () => {
    for (const [name, [primaryHue, accentHue]] of Object.entries(PRESETS)) {
      const snapped = snapTheme(primaryHue, accentHue);
      for (let shift = -30; shift <= 30; shift++) {
        const candidates = [[wrap(primaryHue + shift), accentHue], [primaryHue, wrap(accentHue + shift)]];
        for (const [p, a] of candidates) {
          if (!resolveSemanticHues(p, a).diagnostics.feasible) continue;
          assert.ok(Math.abs(shift) >= snapped.cost, `${name}: cheaper feasible move at ${p}/${a}`);
        }
      }
    }
  });
});

describe('dynamic semantic tokens', () => {
  it('changes every semantic token family between two themes', () => {
    const a = computeTheme({ primaryHue: 280, accentHue: 90 });
    const snapped = snapTheme(235, 160);
    const b = computeTheme({ primaryHue: snapped.primaryHue, accentHue: snapped.accentHue });
    for (const mode of ['semanticLight', 'semanticDark']) {
      for (const role of SEMANTIC_ROLES) {
        for (const suffix of ['', '-fg', '-subtle', '-hover']) {
          const key = `--color-${role}${suffix}`;
          assert.notEqual(a[mode][key], b[mode][key], `${mode} ${key} did not move`);
        }
      }
    }
    assert.notEqual(a.semanticLight['--bg-page'], b.semanticLight['--bg-page']);
    assert.notEqual(a.semanticLight['--bg-surface'], b.semanticLight['--bg-surface']);
    assert.notEqual(a.semanticLight['--bg-surface'], '#ffffff');
  });

  it('keeps the working status pairs above 4.5:1 on every snapped preset', () => {
    for (const [name, [primaryHue, accentHue]] of Object.entries(PRESETS)) {
      const { theme } = snappedTheme(primaryHue, accentHue);
      const light = theme.semanticLight;
      const panel = light['--color-primary-subtle'];
      for (const role of SEMANTIC_ROLES) {
        const fg = light[`--color-${role}-fg`];
        assert.ok(contrastRatio(fg, light['--bg-surface']) >= 4.5, `${name}/${role} fg on surface`);
        assert.ok(contrastRatio(fg, light[`--color-${role}-subtle`]) >= 4.5, `${name}/${role} fg on subtle`);
        assert.ok(contrastRatio(fg, panel) >= 4.5, `${name}/${role} fg on primary panel`);
        assert.ok(contrastRatio(light[`--color-${role}`], light[`--on-${role}`]) >= 4.5, `${name}/${role} cta`);
      }
    }
  });

  it('keeps the snapped presets separated and ordered', () => {
    for (const [name, [primaryHue, accentHue]] of Object.entries(PRESETS)) {
      const { theme } = snappedTheme(primaryHue, accentHue);
      const { semanticDiagnostics: d } = theme;
      assert.ok(d.feasible, name);
      assert.ok(d.semanticGap >= MIN_SEMANTIC_GAP, `${name} semantic gap ${d.semanticGap}`);
      assert.ok(d.brandGap >= MIN_BRAND_GAP, `${name} brand gap ${d.brandGap}`);
    }
  });
});
