import type { ColorFormat } from "./types";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

export function normalizeHex(input: string): string {
  const match = input.trim().match(HEX_PATTERN);
  if (!match) {
    throw new Error(`Invalid hex color: ${input}`);
  }
  return `#${match[1].toUpperCase()}`;
}

export function parseHex(hex: string): Rgb {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toByte = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (max === rn) {
    h = ((gn - bn) / delta) % 6;
  } else if (max === gn) {
    h = (bn - rn) / delta + 2;
  } else {
    h = (rn - gn) / delta + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) {
    h += 360;
  }

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function srgbToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const okL = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const okA = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const okB = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const chroma = Math.sqrt(okA * okA + okB * okB);
  let hue = (Math.atan2(okB, okA) * 180) / Math.PI;
  if (hue < 0) {
    hue += 360;
  }

  // Achromatic colors have undefined hue in CSS; use 0 for a stable string.
  const h = chroma < 0.0001 ? 0 : hue;

  return {
    l: okL * 100,
    c: chroma,
    h,
  };
}

export interface Oklab {
  l: number;
  a: number;
  b: number;
}

export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    l: (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * 100,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** CIELAB (D65) — the classic Lab behind CSS lch(). */
export function rgbToLch({ r, g, b }: Rgb): { l: number; c: number; h: number } {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;
  const f = (t: number): number =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);
  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) {
    h += 360;
  }
  return { l: L, c, h: c < 0.01 ? 0 : h };
}

export function rgbToHwb(rgb: Rgb): { h: number; w: number; b: number } {
  const { h } = rgbToHsl(rgb);
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return {
    h,
    w: Math.round((min / 255) * 100),
    b: Math.round((1 - max / 255) * 100),
  };
}

/** UI list for the format dropdown and copy-as menus. */
export const COLOR_FORMATS: { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
  { value: "oklch", label: "OKLCH" },
  { value: "lch", label: "LCH" },
  { value: "oklab", label: "OKLAB" },
  { value: "hwb", label: "HWB" },
];

export function formatColor(hex: string, format: ColorFormat): string {
  const normalized = normalizeHex(hex);
  const rgb = parseHex(normalized);

  switch (format) {
    case "hex":
      return normalized;
    case "rgb":
      return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    case "hsl": {
      const { h, s, l } = rgbToHsl(rgb);
      return `${h}, ${s}%, ${l}%`;
    }
    case "oklch": {
      const { l, c, h } = rgbToOklch(rgb);
      return `${l.toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)}`;
    }
    case "lch": {
      const { l, c, h } = rgbToLch(rgb);
      return `${l.toFixed(1)}% ${c.toFixed(1)} ${h.toFixed(1)}`;
    }
    case "oklab": {
      const { l, a, b } = rgbToOklab(rgb);
      return `${l.toFixed(1)}% ${a.toFixed(3)} ${b.toFixed(3)}`;
    }
    case "hwb": {
      const { h, w, b } = rgbToHwb(rgb);
      return `${h} ${w}% ${b}%`;
    }
  }
}
