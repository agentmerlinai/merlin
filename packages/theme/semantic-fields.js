/* Semantic hue fields.
   Meaning is a window, not a point. Each role moves inside its colour category
   as the brand climate changes, then repels away from the brand hues so the
   status signal stays separable. See semantic-color-adaptation notebook page. */

export const SEMANTIC_FIELDS = {
  error:   { window: [15, 35],  cool: 15,  warm: 35,  peakChromaFraction: 0.61 },
  warning: { window: [55, 88],  cool: 57,  warm: 87,  peakChromaFraction: 0.92 },
  success: { window: [135, 175], cool: 175, warm: 135, peakChromaFraction: 0.87 },
};

export const SEMANTIC_ROLES = ['error', 'warning', 'success'];
export const MIN_SEMANTIC_GAP = 35;
export const MIN_BRAND_GAP = 30;
const BRAND_SAFE_RADIUS = 40;
const BRAND_PUSH = 10;
const SEMANTIC_PUSH = 8;
const CLIMATE_WARM_POLE = 50;
const PRIMARY_WEIGHT = 0.65;

const toRad = (deg) => (deg * Math.PI) / 180;
const wrap = (hue) => ((hue % 360) + 360) % 360;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (x) => x * x * (3 - 2 * x);

function unit(hue) {
  return [Math.cos(toRad(hue)), Math.sin(toRad(hue))];
}

/* Signed shortest angle from `from` to `to`, in [-180, 180]. */
export function shortestDelta(from, to) {
  return ((to - from + 540) % 360 + 360) % 360 - 180;
}

export function angularDistance(a, b) {
  return Math.abs(shortestDelta(a, b));
}

/* Weighted mean direction of the two brand hues. A near-cancelling pair falls
   back to the primary, so the climate is never undefined. */
export function brandClimate(primaryHue, accentHue) {
  const p = unit(primaryHue);
  const a = unit(accentHue);
  let x = PRIMARY_WEIGHT * p[0] + (1 - PRIMARY_WEIGHT) * a[0];
  let y = PRIMARY_WEIGHT * p[1] + (1 - PRIMARY_WEIGHT) * a[1];
  if (Math.hypot(x, y) < 0.15) [x, y] = p;
  const angle = wrap((Math.atan2(y, x) * 180) / Math.PI);
  const climate = Math.cos(toRad(angle - CLIMATE_WARM_POLE));
  return { angle, climate };
}

function baseHues(climate) {
  const t = (climate + 1) / 2;
  return Object.fromEntries(
    SEMANTIC_ROLES.map((role) => [role, lerp(SEMANTIC_FIELDS[role].cool, SEMANTIC_FIELDS[role].warm, t)]),
  );
}

/* Push `hue` away from `target` when they are closer than `radius`.
   The push grows smoothly toward zero at the radius, so no hard snap. */
function repel(hue, target, radius, strength, [lo, hi]) {
  const delta = shortestDelta(hue, target);
  const distance = Math.abs(delta);
  if (distance >= radius) return 0;
  const weight = smoothstep(1 - distance / radius);
  const direction = distance < 1e-6 ? (hi - hue > hue - lo ? 1 : -1) : -Math.sign(delta);
  return direction * strength * weight;
}

function clampToWindow(hue, [lo, hi]) {
  return clamp(hue, lo, hi);
}

/* Move `hue` away from `target` until the gap reaches `minGap`, or the window
   runs out of room. `fraction` splits a pair move between both roles. */
function nudgeAway(hue, target, minGap, [lo, hi], fraction = 1) {
  const delta = shortestDelta(hue, target);
  const distance = Math.abs(delta);
  if (distance >= minGap) return hue;
  const roomUp = hi - hue;
  const roomDown = hue - lo;
  const direction = distance < 1e-9 ? (roomUp > roomDown ? 1 : -1) : -Math.sign(delta);
  const room = direction > 0 ? roomUp : roomDown;
  return clamp(hue + direction * Math.min((minGap - distance) * fraction, room), lo, hi);
}

/* Relaxation leaves a fixed point just inside a guard because the push fades to
   zero at the radius. This projection closes that gap exactly, or clamps at the
   role window and lets validation report the residual. */
function enforceGaps(hues, primaryHue, accentHue) {
  for (let pass = 0; pass < 4; pass++) {
    for (const role of SEMANTIC_ROLES) {
      const window = SEMANTIC_FIELDS[role].window;
      for (const brand of [primaryHue, accentHue]) hues[role] = nudgeAway(hues[role], brand, MIN_BRAND_GAP, window);
    }
    for (let i = 0; i < SEMANTIC_ROLES.length - 1; i++) {
      const lower = SEMANTIC_ROLES[i];
      const upper = SEMANTIC_ROLES[i + 1];
      if (hues[upper] - hues[lower] >= MIN_SEMANTIC_GAP) continue;
      const lowHue = hues[lower];
      const highHue = hues[upper];
      hues[lower] = nudgeAway(lowHue, highHue, MIN_SEMANTIC_GAP, SEMANTIC_FIELDS[lower].window, 0.5);
      hues[upper] = nudgeAway(highHue, lowHue, MIN_SEMANTIC_GAP, SEMANTIC_FIELDS[upper].window, 0.5);
    }
  }
}

/* One relaxation pass: brand repulsion first, then role-to-role separation.
   Windows make the order error < warning < success impossible to invert. */
function relaxPass(hues, primaryHue, accentHue) {
  for (const role of SEMANTIC_ROLES) {
    const window = SEMANTIC_FIELDS[role].window;
    let push = 0;
    for (const brand of [primaryHue, accentHue]) {
      push += repel(hues[role], brand, BRAND_SAFE_RADIUS, BRAND_PUSH, window);
    }
    for (const other of SEMANTIC_ROLES) {
      if (other === role) continue;
      push += repel(hues[role], hues[other], MIN_SEMANTIC_GAP, SEMANTIC_PUSH, window);
    }
    hues[role] = clampToWindow(hues[role] + push, window);
  }
}

function collectViolations(hues, primaryHue, accentHue) {
  const violations = [];
  for (const role of SEMANTIC_ROLES) {
    const [lo, hi] = SEMANTIC_FIELDS[role].window;
    if (hues[role] < lo - 1e-9 || hues[role] > hi + 1e-9) violations.push({ type: 'window', role });
  }
  for (let i = 0; i < SEMANTIC_ROLES.length - 1; i++) {
    const a = SEMANTIC_ROLES[i];
    const b = SEMANTIC_ROLES[i + 1];
    const gap = hues[b] - hues[a];
    if (gap < MIN_SEMANTIC_GAP - 1e-9) violations.push({ type: 'semantic-gap', a, b, gap });
  }
  for (const role of SEMANTIC_ROLES) {
    for (const [brand, hue] of [['primary', primaryHue], ['accent', accentHue]]) {
      const gap = angularDistance(hues[role], hue);
      if (gap < MIN_BRAND_GAP - 1e-9) violations.push({ type: 'brand-gap', role, brand, gap });
    }
  }
  return violations;
}

export function validateHues(hues, primaryHue, accentHue) {
  const finite = Number.isFinite(primaryHue) && Number.isFinite(accentHue)
    && SEMANTIC_ROLES.every((role) => Number.isFinite(hues[role]));
  if (!finite) {
    return { feasible: false, violations: [{ type: 'invalid-input' }], semanticGap: 0, brandGap: 0, hues: { ...hues } };
  }
  const violations = collectViolations(hues, primaryHue, accentHue);
  const semanticGap = Math.min(hues.warning - hues.error, hues.success - hues.warning);
  const brandGap = Math.min(
    ...SEMANTIC_ROLES.flatMap((role) => [
      angularDistance(hues[role], primaryHue),
      angularDistance(hues[role], accentHue),
    ]),
  );
  return { feasible: violations.length === 0, violations, semanticGap, brandGap, hues: { ...hues } };
}

/* Resolve the three semantic hues for a brand pair. Runs a handful of cheap
   relaxation passes, then reports whether the result satisfies every guard. */
export function resolveSemanticHues(primaryHue, accentHue) {
  if (!Number.isFinite(primaryHue) || !Number.isFinite(accentHue)) {
    const hues = baseHues(0);
    return { hues, climate: 0, brandAngle: 0, diagnostics: validateHues(hues, primaryHue, accentHue) };
  }
  const { angle, climate } = brandClimate(primaryHue, accentHue);
  const hues = baseHues(climate);
  for (let pass = 0; pass < 5; pass++) relaxPass(hues, primaryHue, accentHue);
  enforceGaps(hues, primaryHue, accentHue);
  const diagnostics = validateHues(hues, primaryHue, accentHue);
  return { hues, climate, brandAngle: angle, diagnostics };
}

/* Snap a preset to the nearest feasible brand pair. Single-knob moves win over
   two-knob moves; ties prefer the primary. If nothing is feasible in range,
   return the original pair and keep the diagnostics for the caller. */
export function snapTheme(primaryHue, accentHue, { maxShift = 30, step = 1 } = {}) {
  if (!Number.isFinite(primaryHue) || !Number.isFinite(accentHue)) {
    return { primaryHue, accentHue, snapped: false, cost: 0, ...resolveSemanticHues(primaryHue, accentHue) };
  }
  const initial = resolveSemanticHues(primaryHue, accentHue);
  if (initial.diagnostics.feasible) return { primaryHue, accentHue, snapped: false, cost: 0, ...initial };

  let best = null;
  const consider = (p, a, cost) => {
    const result = resolveSemanticHues(p, a);
    if (!result.diagnostics.feasible) return;
    if (!best || cost < best.cost) best = { primaryHue: p, accentHue: a, cost, snapped: true, ...result };
  };

  for (let d = -maxShift; d <= maxShift; d += step) consider(wrap(primaryHue + d), accentHue, Math.abs(d));
  for (let d = -maxShift; d <= maxShift; d += step) consider(primaryHue, wrap(accentHue + d), Math.abs(d));
  if (!best) {
    for (let dp = -maxShift; dp <= maxShift; dp += step) {
      for (let da = -maxShift; da <= maxShift; da += step) {
        consider(wrap(primaryHue + dp), wrap(accentHue + da), Math.abs(dp) + Math.abs(da));
      }
    }
  }

  return best ?? { primaryHue, accentHue, snapped: false, cost: 0, ...initial };
}
