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

export function formatColor(hex: string, format: ColorFormat): string {
  const normalized = normalizeHex(hex);
  const rgb = parseHex(normalized);

  switch (format) {
    case "hex":
      return normalized;
    case "rgb":
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    case "hsl": {
      const { h, s, l } = rgbToHsl(rgb);
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
  }
}
