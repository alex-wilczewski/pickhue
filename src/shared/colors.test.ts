import { describe, expect, it } from "vitest";
import {
  COLOR_FORMATS,
  formatColor,
  normalizeHex,
  parseHex,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
} from "./colors";
import type { ColorFormat } from "./types";

/**
 * These are the values the user copies to their clipboard. If a conversion
 * drifts, the colour they paste is not the colour they picked.
 */

const SAMPLES = [
  "#000000",
  "#FFFFFF",
  "#87D624",
  "#1F6FEB",
  "#E23A3A",
  "#010409",
  "#808080",
  "#F1E05A",
];

describe("hex parsing", () => {
  it("round-trips hex → rgb → hex exactly", () => {
    for (const hex of SAMPLES) {
      expect(rgbToHex(parseHex(hex))).toBe(hex);
    }
  });

  it("normalises case and the leading hash to one canonical form", () => {
    expect(normalizeHex("#87d624")).toBe("#87D624");
    expect(normalizeHex("87D624")).toBe("#87D624");
    expect(normalizeHex("  #87d624  ")).toBe("#87D624");
  });

  it("rejects values that are not colours", () => {
    for (const bad of ["", "#", "#12345", "#GGGGGG", "nope"]) {
      expect(() => normalizeHex(bad), bad).toThrow();
    }
  });

  it("requires full six-digit hex — shorthand is parseHexInput's job", () => {
    // Deliberate split: normalizeHex is the strict canonical form, while
    // parseHexInput is the lenient front door for pasted text.
    expect(() => normalizeHex("#abc")).toThrow();
  });

  it("parses channels in the right order", () => {
    expect(parseHex("#FF0000")).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(parseHex("#00FF00")).toMatchObject({ r: 0, g: 255, b: 0 });
    expect(parseHex("#0000FF")).toMatchObject({ r: 0, g: 0, b: 255 });
  });
});

describe("formatColor", () => {
  const formats = COLOR_FORMATS.map((f) => f.value);

  it("covers every format the UI offers", () => {
    // Guards against adding a format to the dropdown but not the formatter.
    const expected: ColorFormat[] = ["hex", "rgb", "hsl", "oklch", "lch", "oklab", "hwb"];
    expect(new Set(formats)).toEqual(new Set(expected));
  });

  for (const format of ["hex", "rgb", "hsl", "oklch", "lch", "oklab", "hwb"] as ColorFormat[]) {
    it(`produces a non-empty, finite string for every sample as ${format}`, () => {
      for (const hex of SAMPLES) {
        const out = formatColor(hex, format);
        expect(out, `${hex} as ${format}`).toBeTruthy();
        expect(out).not.toMatch(/NaN|Infinity|undefined/);
      }
    });
  }

  it("returns hex unchanged in hex format", () => {
    for (const hex of SAMPLES) {
      expect(formatColor(hex, "hex")).toBe(hex);
    }
  });

  /**
   * PickHue copies bare component values, not wrapped css functions — the
   * string is meant to drop into a design tool's fields or inside a css
   * function the user already typed. Locking the shapes down so the clipboard
   * contract cannot drift unnoticed.
   */
  it("emits bare component values in the documented shape", () => {
    expect(formatColor("#1F6FEB", "hex")).toMatch(/^#[0-9A-F]{6}$/);
    expect(formatColor("#1F6FEB", "rgb")).toMatch(/^\d+, \d+, \d+$/);
    expect(formatColor("#1F6FEB", "hsl")).toMatch(/^-?\d+, \d+%, \d+%$/);
    expect(formatColor("#1F6FEB", "oklch")).toMatch(/^[\d.]+% [\d.]+ -?[\d.]+$/);
    expect(formatColor("#1F6FEB", "lch")).toMatch(/^[\d.]+% [\d.]+ -?[\d.]+$/);
    expect(formatColor("#1F6FEB", "oklab")).toMatch(/^[\d.]+% -?[\d.]+ -?[\d.]+$/);
    expect(formatColor("#1F6FEB", "hwb")).toMatch(/^-?\d+ \d+% \d+%$/);
  });
});

describe("conversions behave at the edges", () => {
  it("maps pure black and white to the right lightness extremes", () => {
    expect(rgbToHsl(parseHex("#000000")).l).toBeCloseTo(0, 2);
    expect(rgbToHsl(parseHex("#FFFFFF")).l).toBeCloseTo(100, 0);
    expect(rgbToOklch(parseHex("#000000")).l).toBeCloseTo(0, 2);
  });

  it("reports no saturation for grays", () => {
    for (const gray of ["#000000", "#808080", "#FFFFFF"]) {
      expect(rgbToHsl(parseHex(gray)).s, gray).toBeCloseTo(0, 2);
    }
  });

  it("keeps primaries on their expected hues", () => {
    expect(rgbToHsl(parseHex("#FF0000")).h).toBeCloseTo(0, 0);
    expect(rgbToHsl(parseHex("#00FF00")).h).toBeCloseTo(120, 0);
    expect(rgbToHsl(parseHex("#0000FF")).h).toBeCloseTo(240, 0);
  });
});
