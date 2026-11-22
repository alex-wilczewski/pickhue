// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { colorDistanceSq, probeDomColor } from "./dom-color";

/**
 * jsdom does no layout, so document.elementsFromPoint() cannot hit-test. That
 * is fine here: the bug these tests exist for was never in hit-testing, it was
 * in what the probe DOES with the stack it is handed. So we build real elements
 * with real computed styles and feed the stack in directly, topmost-first —
 * exactly the order the browser returns.
 *
 * Regression context: the probe used to `continue` past any element whose
 * background it could not parse, climbing to an ancestor's background-color.
 * Because the stack is topmost-first, that ancestor is painted UNDERNEATH what
 * the user is pointing at, so gradients, images, canvases and SVG all reported
 * the page background instead of their own pixels.
 */

function el(tag: string, css: Record<string, string>): HTMLElement {
  const node = document.createElement(tag);
  for (const [prop, value] of Object.entries(css)) {
    node.style.setProperty(prop, value);
  }
  document.body.append(node);
  return node;
}

function svg(): SVGElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  document.body.append(node);
  return node;
}

/**
 * Point the probe at this exact stack, topmost-first. jsdom does not implement
 * elementsFromPoint at all, so this defines it rather than spying on it.
 */
function stack(...elements: Element[]): void {
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    writable: true,
    value: () => elements,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  // caretRangeFromPoint is absent in jsdom; the probe already guards on it,
  // which keeps these cases on the background path rather than the text path.
  expect(typeof (document as Document).caretRangeFromPoint).not.toBe("function");
});

describe("probeDomColor — reports only what is actually on screen", () => {
  it("reads a plain solid fill exactly (DevTools parity)", () => {
    stack(el("div", { "background-color": "rgb(31, 111, 235)" }));
    expect(probeDomColor(10, 10)).toBe("#1F6FEB");
  });

  it("walks through a transparent child to the parent's fill", () => {
    const parent = el("div", { "background-color": "rgb(137, 87, 229)" });
    const child = el("div", { "background-color": "transparent" });
    stack(child, parent);
    expect(probeDomColor(10, 10)).toBe("#8957E5");
  });

  it("defers on a gradient — the GitHub grid-panel case", () => {
    // The panel paints a gradient over a dark canvas. Reporting the canvas
    // colour (#010409) is what the bug did.
    const page = el("div", { "background-color": "rgb(1, 4, 9)" });
    const grid = el("div", {
      "background-color": "rgb(1, 4, 9)",
      "background-image": "linear-gradient(to right, rgba(46,160,67,0.4) 1px, transparent 1px)",
    });
    stack(grid, page);
    expect(probeDomColor(10, 10)).toBeNull();
  });

  it("defers on a background image", () => {
    const page = el("div", { "background-color": "rgb(1, 4, 9)" });
    const hero = el("div", { "background-image": 'url("photo.jpg")' });
    stack(hero, page);
    expect(probeDomColor(10, 10)).toBeNull();
  });

  for (const tag of ["img", "canvas", "video", "picture", "object", "embed", "iframe"]) {
    it(`defers on <${tag}>, which paints its own pixels`, () => {
      const page = el("div", { "background-color": "rgb(1, 4, 9)" });
      stack(el(tag, {}), page);
      expect(probeDomColor(10, 10)).toBeNull();
    });
  }

  it("defers on SVG content", () => {
    const page = el("div", { "background-color": "rgb(1, 4, 9)" });
    stack(svg(), page);
    expect(probeDomColor(10, 10)).toBeNull();
  });

  it("defers on a partially transparent overlay, which blends", () => {
    const page = el("div", { "background-color": "rgb(1, 4, 9)" });
    const veil = el("div", { "background-color": "rgb(210, 153, 34)", opacity: "0.5" });
    stack(veil, page);
    expect(probeDomColor(10, 10)).toBeNull();
  });

  it("defers when nothing in the stack has an opaque background", () => {
    stack(el("div", { "background-color": "transparent" }));
    expect(probeDomColor(10, 10)).toBeNull();
  });

  it("ignores PickHue's own overlay and reads the page beneath it", () => {
    const page = el("div", { "background-color": "rgb(31, 111, 235)" });
    const ours = el("div", { "background-color": "rgb(20, 20, 20)" });
    ours.id = "pickhue-copy-toast";
    stack(ours, page);
    expect(probeDomColor(10, 10)).toBe("#1F6FEB");
  });

  it("treats a nearly-opaque background as opaque, but not a translucent one", () => {
    stack(el("div", { "background-color": "rgba(31, 111, 235, 0.5)" }));
    expect(probeDomColor(10, 10)).toBeNull();

    stack(el("div", { "background-color": "rgba(31, 111, 235, 1)" }));
    expect(probeDomColor(10, 10)).toBe("#1F6FEB");
  });
});

describe("colorDistanceSq", () => {
  it("is zero for identical colours", () => {
    expect(colorDistanceSq("#1F6FEB", "#1F6FEB")).toBe(0);
  });

  it("grows with visible difference", () => {
    const near = colorDistanceSq("#010409", "#04070C");
    const far = colorDistanceSq("#010409", "#2EA043");
    expect(near).toBeLessThan(far);
  });

  it("is symmetric", () => {
    expect(colorDistanceSq("#010409", "#2EA043")).toBe(
      colorDistanceSq("#2EA043", "#010409")
    );
  });
});
