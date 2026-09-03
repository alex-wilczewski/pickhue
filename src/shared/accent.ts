/*
 * Dynamic accent derivation — the 3.0 brand system. The UI derives its accent
 * from the user's most recent pick: the picked hue is kept, while lightness and
 * chroma are normalized in OKLCH so any pick yields a vibrant, legible accent.
 * Near-neutral picks (grays, white, black) fall back to the default coral so
 * the panel never tints itself gray.
 *
 * Everything here is pure math on hex strings; callers apply the results as
 * inline CSS custom properties over the static fallbacks in panel.css /
 * picker.css (which encode the no-picks defaults).
 */

export type ResolvedTheme = "light" | "dark";

export interface AccentTokens {
  accent: string;
  accentHover: string;
  accentText: string;
  accentLink: string;
  /** OKLCH hue the accent (and chrome tint) derived from. */
  hue: number;
}

/** Warm coral default — the brand accent before the first colorful pick. */
const DEFAULT_ACCENT_HUE = 25;
const DEFAULT_ACCENT_CHROMA = 0.155;
/** Picks with less OKLCH chroma than this keep the default accent. */
const NEUTRAL_CHROMA_CUTOFF = 0.035;

/* ---------- sRGB <-> OKLab (Björn Ottosson's reference constants) ---------- */

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToOklab(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb(
  L: number,
  a: number,
  b: number
): [number, number, number] {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function hexToOklch(hex: string): { L: number; C: number; h: number } {
  const [L, a, b] = rgbToOklab(...hexToRgb(hex));
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
}

function inGamut(r: number, g: number, b: number): boolean {
  return (
    r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && b >= -0.001 && b <= 1.001
  );
}

/** OKLCH -> hex, reducing chroma until inside the sRGB gamut. */
export function oklchToHex(L: number, C: number, h: number): string {
  const rad = (h * Math.PI) / 180;
  let lo = 0;
  let hi = C;
  let rgb = oklabToRgb(L, Math.cos(rad) * hi, Math.sin(rad) * hi);
  if (!inGamut(...rgb)) {
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) / 2;
      rgb = oklabToRgb(L, Math.cos(rad) * mid, Math.sin(rad) * mid);
      if (inGamut(...rgb)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    rgb = oklabToRgb(L, Math.cos(rad) * lo, Math.sin(rad) * lo);
  }
  return rgbToHex(...rgb);
}

/** Max chroma the sRGB gamut allows at a given OKLCH lightness/hue. */
export function maxChromaAt(L: number, h: number): number {
  const rad = (h * Math.PI) / 180;
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(...oklabToRgb(L, Math.cos(rad) * mid, Math.sin(rad) * mid))) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/*
 * Lightness nearest the theme target that can still hold a saturated accent.
 * A fixed lightness washes some hues out: blues/reds only hold chroma at lower
 * L, yellows/greens at higher L.
 */
function pickAccentL(h: number, theme: ResolvedTheme): number {
  const desiredC = 0.16;
  const dark = theme === "dark";
  const lo = dark ? 0.58 : 0.52;
  const hi = dark ? 0.8 : 0.7;
  const target = dark ? 0.76 : 0.63;
  let bestFeasible: number | null = null;
  let bestAny = lo;
  let bestAnyC = 0;
  for (let L = lo; L <= hi + 1e-9; L += 0.01) {
    const c = maxChromaAt(L, h);
    if (c > bestAnyC) {
      bestAnyC = c;
      bestAny = L;
    }
    if (
      c >= desiredC &&
      (bestFeasible === null ||
        Math.abs(L - target) < Math.abs(bestFeasible - target))
    ) {
      bestFeasible = L;
    }
  }
  return bestFeasible ?? bestAny;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [l1, l2] = la > lb ? [la, lb] : [lb, la];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Resolve the hue the accent system should use for a pick (or no pick). */
function resolveAccentSource(pick: string | null): { h: number; C: number } {
  if (!pick) {
    return { h: DEFAULT_ACCENT_HUE, C: DEFAULT_ACCENT_CHROMA };
  }
  const { C, h } = hexToOklch(pick);
  if (C < NEUTRAL_CHROMA_CUTOFF) {
    return { h: DEFAULT_ACCENT_HUE, C: DEFAULT_ACCENT_CHROMA };
  }
  return { h, C };
}

/** Accent token set for the given pick (null -> default coral) and theme. */
export function deriveAccentTokens(
  pick: string | null,
  theme: ResolvedTheme
): AccentTokens {
  const { h, C } = resolveAccentSource(pick);
  const dark = theme === "dark";
  const L = pickAccentL(h, theme);
  const chroma = Math.min(Math.max(C, 0.12), 0.185, maxChromaAt(L, h));
  const accent = oklchToHex(L, chroma, h);
  return {
    accent,
    accentHover: oklchToHex(L + (dark ? 0.05 : 0.045), chroma, h),
    accentText:
      contrastRatio(accent, "#141414") >= contrastRatio(accent, "#ffffff")
        ? "#141414"
        : "#ffffff",
    accentLink: dark
      ? oklchToHex(0.85, Math.min(maxChromaAt(0.85, h), 0.12), h)
      : oklchToHex(0.46, Math.min(maxChromaAt(0.46, h), 0.185), h),
    hue: h,
  };
}

export interface RampStep {
  hex: string;
  label: string;
  /** True for the step whose lightness sits closest to the source color. */
  isBase: boolean;
}

/*
 * Tailwind-style lightness scale. Chroma tapers toward the extremes so the
 * near-white / near-black steps stay clean instead of going neon.
 */
const RAMP_STEPS: Array<[string, number]> = [
  ["50", 0.97],
  ["100", 0.93],
  ["200", 0.86],
  ["300", 0.78],
  ["400", 0.7],
  ["500", 0.62],
  ["600", 0.53],
  ["700", 0.44],
  ["800", 0.35],
  ["900", 0.26],
];

/** Perceptually even shades & tints of a color (OKLCH: hue held constant). */
export function buildColorRamp(source: string): RampStep[] {
  const { L: baseL, C, h } = hexToOklch(source);
  const chroma = Math.max(C, 0.02);
  let baseIndex = 0;
  let baseDistance = Number.POSITIVE_INFINITY;
  for (const [index, [, L]] of RAMP_STEPS.entries()) {
    const distance = Math.abs(L - baseL);
    if (distance < baseDistance) {
      baseDistance = distance;
      baseIndex = index;
    }
  }
  return RAMP_STEPS.map(([label, L], index) => {
    const taper = L > 0.9 ? 0.55 : L > 0.84 ? 0.75 : L < 0.3 ? 0.8 : 1;
    return {
      label,
      hex: oklchToHex(L, Math.min(chroma * taper, maxChromaAt(L, h)), h).toUpperCase(),
      isBase: index === baseIndex,
    };
  });
}

/*
 * Variant B "tinted chrome": the panel's neutral surfaces carry a whisper of
 * the accent hue. Keys are the panel.css custom properties to override.
 */
export function chromeTintTokens(
  hue: number,
  theme: ResolvedTheme
): Record<string, string> {
  const t = (L: number, C: number): string => oklchToHex(L, C, hue);
  if (theme === "dark") {
    return {
      "--bg": t(0.315, 0.012),
      "--header-bg": `${t(0.315, 0.012)}33`,
      "--footer-bg": t(0.235, 0.014),
      "--menu-bg": t(0.265, 0.012),
      "--close-bg": t(0.4, 0.014),
      "--close-bg-hover": t(0.44, 0.014),
      "--control-border": t(0.4, 0.014),
      "--toggle-track": t(0.4, 0.014),
    };
  }
  return {
    "--bg": t(0.945, 0.008),
    "--header-bg": t(0.99, 0.004),
    "--footer-bg": t(0.915, 0.01),
    "--menu-bg": t(0.99, 0.004),
    "--close-bg": t(0.875, 0.012),
    "--close-bg-hover": t(0.83, 0.014),
    "--control-border": t(0.74, 0.016),
    "--toggle-track": t(0.82, 0.014),
  };
}

/*
 * Tinted translucent surface for overlay chrome (copy toast, save menu, picker
 * hint) — keeps the blur-backed look while carrying the accent hue.
 */
export function tintedOverlaySurface(
  pick: string | null,
  theme: ResolvedTheme
): string {
  const { h } = resolveAccentSource(pick);
  const hex =
    theme === "dark" ? oklchToHex(0.27, 0.018, h) : oklchToHex(0.975, 0.008, h);
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.94)`;
}
