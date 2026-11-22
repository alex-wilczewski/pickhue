import { normalizeHex, parseHex, rgbToHex } from "./colors";

const EXTENSION_UI = "#pickhue-picker-root, #pickhue-copy-toast";

function isExtensionElement(element: Element): boolean {
  return element.closest(EXTENSION_UI) !== null;
}

function parseOpaqueCssColor(css: string): string | null {
  if (!css || css === "transparent") {
    return null;
  }

  const rgba =
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(
      css.trim()
    );

  if (rgba) {
    const alpha = rgba[4] !== undefined ? Number.parseFloat(rgba[4]) : 1;
    if (alpha < 0.995) {
      return null;
    }
    return rgbToHex({
      r: Number.parseInt(rgba[1], 10),
      g: Number.parseInt(rgba[2], 10),
      b: Number.parseInt(rgba[3], 10),
    });
  }

  if (css.startsWith("#")) {
    try {
      return normalizeHex(css);
    } catch {
      return null;
    }
  }

  return null;
}

function hasNonSolidBackground(style: CSSStyleDeclaration): boolean {
  const image = style.backgroundImage;
  return !!image && image !== "none";
}

/** Replaced elements paint pixels of their own; nothing behind them shows. */
const SELF_PAINTING_TAGS = new Set([
  "IMG",
  "CANVAS",
  "VIDEO",
  "PICTURE",
  "OBJECT",
  "EMBED",
  "IFRAME",
]);

/**
 * True when this element puts its own pixels on screen at the probe point, so
 * no computed `background-color` found further down the stack is what the user
 * is actually looking at. Covers replaced elements, any SVG content, CSS
 * background images (gradients and sprites included), and partial opacity,
 * which blends whatever is behind it.
 */
function paintsOwnContent(element: Element, style: CSSStyleDeclaration): boolean {
  if (element instanceof SVGElement) {
    return true;
  }
  if (SELF_PAINTING_TAGS.has(element.tagName)) {
    return true;
  }
  if (hasNonSolidBackground(style)) {
    return true;
  }
  const opacity = Number.parseFloat(style.opacity);
  return Number.isFinite(opacity) && opacity < 0.995;
}

function colorFromTextAtPoint(x: number, y: number): string | null {
  if (typeof document.caretRangeFromPoint !== "function") {
    return null;
  }

  const range = document.caretRangeFromPoint(x, y);
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  if (!range.startContainer.textContent?.trim()) {
    return null;
  }

  let element = range.startContainer.parentElement;
  while (element) {
    if (isExtensionElement(element)) {
      return null;
    }
    const color = parseOpaqueCssColor(getComputedStyle(element).color);
    if (color) {
      return color;
    }
    element = element.parentElement;
  }

  return null;
}

/**
 * Read the CSS color DevTools would show for the element under the cursor.
 * Matches computed `background-color` on solid fills and `color` on text.
 * Returns null for gradients, images, video, and transparent stacks.
 */
export function probeDomColor(x: number, y: number): string | null {
  const textColor = colorFromTextAtPoint(x, y);
  if (textColor) {
    return textColor;
  }

  // elementsFromPoint is ordered topmost-first. The first element that paints
  // anything of its own occludes everything beneath it, so the search has to
  // STOP there rather than keep walking up to an ancestor's background-color —
  // that ancestor's color is not what is on screen at this pixel. Falling
  // through to null hands the decision to the captured bitmap, which is ground
  // truth. (Walking past these was why a gradient or canvas — GitHub's grid
  // panels, any photo, any SVG icon — reported the page background instead.)
  const elements = document.elementsFromPoint(x, y);
  for (const element of elements) {
    if (isExtensionElement(element)) {
      continue;
    }

    const style = getComputedStyle(element);
    if (paintsOwnContent(element, style)) {
      return null;
    }

    const background = parseOpaqueCssColor(style.backgroundColor);
    if (background) {
      return background;
    }
  }

  return null;
}

/** Squared RGB distance — quick sanity check between DOM and bitmap samples. */
export function colorDistanceSq(hexA: string, hexB: string): number {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}
