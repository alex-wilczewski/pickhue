/*
 * Page palette extraction: walks the live DOM and collects the page's colors
 * grouped by role — backgrounds (weighted by painted area), text (weighted by
 * direct text length), and borders (weighted by perimeter). Near-duplicates
 * are clustered perceptually in OKLab so anti-aliased variants collapse into
 * one swatch, and each group returns its heaviest hitters first.
 */

import { rgbToHex, rgbToOklab, type Rgb } from "../shared/colors";

export interface ExtractedPalette {
  backgrounds: string[];
  text: string[];
  borders: string[];
}

const MAX_ELEMENTS = 2500;
const GROUP_CAP = 6;
/** OKLab distance under which two colors count as the same swatch. */
const CLUSTER_DISTANCE = 0.045;

/** Parses computed rgb()/rgba() strings; ignores transparent/translucent. */
function parseCssColor(value: string): Rgb | null {
  const match = value.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/
  );
  if (!match) {
    return null;
  }
  const alpha = match[4] === undefined ? 1 : parseFloat(match[4]);
  if (alpha < 0.5) {
    return null;
  }
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function hasDirectText(el: HTMLElement): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true;
    }
  }
  return false;
}

function addWeight(map: Map<string, number>, rgb: Rgb, weight: number): void {
  const hex = rgbToHex(rgb);
  map.set(hex, (map.get(hex) ?? 0) + weight);
}

/** Greedy perceptual clustering: heaviest colors absorb their near-neighbors. */
function cluster(map: Map<string, number>): string[] {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const kept: Array<{ hex: string; lab: { l: number; a: number; b: number } }> =
    [];
  for (const [hex] of entries) {
    if (kept.length >= GROUP_CAP) {
      break;
    }
    const lab = rgbToOklab({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    });
    const isNew = kept.every((existing) => {
      const dl = (existing.lab.l - lab.l) / 100;
      const da = existing.lab.a - lab.a;
      const db = existing.lab.b - lab.b;
      return Math.hypot(dl, da, db) > CLUSTER_DISTANCE;
    });
    if (isNew) {
      kept.push({ hex, lab });
    }
  }
  return kept.map((entry) => entry.hex);
}

export function extractPagePalette(): ExtractedPalette {
  const backgrounds = new Map<string, number>();
  const text = new Map<string, number>();
  const borders = new Map<string, number>();

  // PickHue's own UI mounts on documentElement, so `body *` never sees it.
  const elements = document.body?.querySelectorAll<HTMLElement>("*") ?? [];
  let visited = 0;

  for (const el of elements) {
    if (visited >= MAX_ELEMENTS) {
      break;
    }
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (!width || !height) {
      continue;
    }
    visited += 1;

    const style = getComputedStyle(el);

    const bg = parseCssColor(style.backgroundColor);
    if (bg) {
      addWeight(backgrounds, bg, Math.min(width * height, 500000));
    }

    if (hasDirectText(el)) {
      const fg = parseCssColor(style.color);
      if (fg) {
        addWeight(text, fg, Math.min(el.textContent?.length ?? 1, 400));
      }
    }

    if (parseFloat(style.borderTopWidth) > 0) {
      const border = parseCssColor(style.borderTopColor);
      if (border) {
        addWeight(borders, border, 2 * (width + height));
      }
    }
  }

  return {
    backgrounds: cluster(backgrounds),
    text: cluster(text),
    borders: cluster(borders),
  };
}
