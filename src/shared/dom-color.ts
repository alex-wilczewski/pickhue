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

  const elements = document.elementsFromPoint(x, y);
  for (const element of elements) {
    if (isExtensionElement(element)) {
      continue;
    }

    const style = getComputedStyle(element);
    if (hasNonSolidBackground(style)) {
      continue;
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
