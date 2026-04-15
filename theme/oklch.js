export const SHADE_NAMES = [50,100,200,300,400,500,600,700,800,900,950];
export const LIGHTNESS =  [0.97,0.93,0.87,0.78,0.69,0.60,0.51,0.43,0.36,0.29,0.25];

export function chromaCurve(L, peakChroma, peakL) {
  const spreadL = (0.97 - peakL) / 0.5692;
  const spreadD = (peakL - 0.25) / 0.7000;
  const spread = L >= peakL ? spreadL : spreadD;
  return peakChroma * Math.max(0, 1 - ((L - peakL) / spread) ** 2);
}

/**
 * Convert OKLCH to sRGB hex. Out-of-gamut values are silently clamped to [0,1].
 * Use `maxGamutChroma()` to find the gamut boundary before calling this if precision matters.
 */
export function oklchToHex(L, C, H) {
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const lp = L + 0.3963377774 * a + 0.2158037573 * b;
  const mp = L - 0.1055613458 * a - 0.0638541728 * b;
  const sp = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = lp ** 3, m = mp ** 3, s = sp ** 3;
  let R = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const gamma = x => x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1/2.4) - 0.055;
  const clamp = x => Math.max(0, Math.min(1, x));
  const toHex = x => Math.round(clamp(gamma(clamp(x))) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(R) + toHex(G) + toHex(B);
}

export function oklchStr(L, C, H) {
  return `oklch(${L.toFixed(2)} ${C.toFixed(3)} ${H})`;
}

export function relativeLuminance(hex) {
  const r = parseInt(hex.slice(1,3), 16) / 255;
  const g = parseInt(hex.slice(3,5), 16) / 255;
  const b = parseInt(hex.slice(5,7), 16) / 255;
  const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(hex1, hex2) {
  const Y1 = relativeLuminance(hex1);
  const Y2 = relativeLuminance(hex2);
  return (Math.max(Y1, Y2) + 0.05) / (Math.min(Y1, Y2) + 0.05);
}

export function bestTextColor(bgHex) {
  const Y = relativeLuminance(bgHex);
  return (1.05 / (Y + 0.05)) >= ((Y + 0.05) / 0.05) ? '#ffffff' : '#000000';
}

export function maxGamutChroma(L, hue) {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const hRad = hue * Math.PI / 180;
    const a = mid * Math.cos(hRad), b = mid * Math.sin(hRad);
    const lp = L + 0.3963377774*a + 0.2158037573*b;
    const mp = L - 0.1055613458*a - 0.0638541728*b;
    const sp = L - 0.0894841775*a - 1.2914855480*b;
    const l = lp**3, m = mp**3, s = sp**3;
    const R = +4.0767416621*l - 3.3077115913*m + 0.2309699292*s;
    const G = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s;
    const B = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s;
    (R >= -0.001 && R <= 1.001 && G >= -0.001 && G <= 1.001 && B >= -0.001 && B <= 1.001) ? lo = mid : hi = mid;
  }
  return lo;
}

export function trueMaxGamutChroma(hue) {
  let max = 0;
  for (let L = 0.05; L <= 0.99; L += 0.01) max = Math.max(max, maxGamutChroma(L, hue));
  return max;
}

export function generateScale(hue, peakChromaFraction) {
  let peakGamut = 0, peakL = 0.6;
  for (let L = 0.05; L <= 0.99; L += 0.01) {
    const c = maxGamutChroma(L, hue);
    if (c > peakGamut) { peakGamut = c; peakL = L; }
  }
  return SHADE_NAMES.map((name, i) => {
    const L = LIGHTNESS[i];
    const shadeGamut = maxGamutChroma(L, hue);
    const C = Math.min(chromaCurve(L, peakGamut * peakChromaFraction, peakL), shadeGamut * 0.98);
    const hex = oklchToHex(L, C, hue);
    return { name, L, C, hue, hex, oklch: oklchStr(L, C, hue) };
  });
}

/**
 * Find the most chromatic shade for `hue` where the best text color
 * (black or white) achieves WCAG AA (4.5:1). Parameterized by surface background:
 *
 * - Light surfaces: search full L range — no upper cap, vibrancy first.
 * - Dark surfaces: floor the search at bgL + 0.18 so the shade is
 *   distinguishably lighter than the surface (prevents dark-on-dark invisibility).
 *
 * Luminous hues (yellow, green) peak at high L and are vibrant on both surfaces.
 * Low-peak hues (violet, blue) are naturally lifted in dark mode by the floor.
 * Returns {L, C, hex, textColor, textCR, score} or null.
 */
export function computeOptimalShade(hue, bgHex) {
  const bgL = Math.cbrt(relativeLuminance(bgHex)); // OKLCH L ≈ ∛Y (achromatic approx)
  // Both modes use a comfort band that avoids peak-chroma extremes:
  //   Light: [0.60, bgL-0.15] — no near-black over-saturated shades, no near-white washed-out shades
  //   Dark:  [bgL+0.25, 0.97] — floor above surface so shade stands out; no upper cap
  const lFloor = bgL < 0.5 ? bgL + 0.25 : 0.60;
  const lMax   = bgL > 0.5 ? bgL - 0.15 : 0.97;

  let best = null;
  for (let L = lFloor; L <= lMax; L += 0.005) {
    const C = maxGamutChroma(L, hue) * 0.98;
    const hex = oklchToHex(L, C, hue);
    const textColor = bestTextColor(hex);
    const textCR = contrastRatio(hex, textColor);
    if (textCR < 4.5) continue;
    if (!best || C > best.score) best = { L, C, hex, textColor, textCR, score: C };
  }
  return best;
}
