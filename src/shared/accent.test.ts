import { describe, expect, it } from "vitest";
import {
  chromeTintTokens,
  contrastRatio,
  deriveAccentTokens,
  hexToOklch,
  tintedOverlaySurface,
  type ResolvedTheme,
} from "./accent";
import { parseHex } from "./colors";

/**
 * The accent system has one job: whatever the user picks, the UI stays
 * legible. These are the invariants — they are what makes a pick "safe",
 * independent of which colour it happens to produce.
 */

/** Panel background per theme (see panel.css `.panel` / `[data-theme="light"]`). */
const PANEL_BG: Record<ResolvedTheme, string> = {
  dark: "#313131",
  light: "#EDEDED",
};

const THEMES: ResolvedTheme[] = ["dark", "light"];

/** A spread of picks covering every region of the space the UI has to survive. */
const PICKS: { label: string; hex: string }[] = [
  { label: "pure white", hex: "#FFFFFF" },
  { label: "near-white", hex: "#F7F7F8" },
  { label: "warm off-white", hex: "#F5F0E8" },
  { label: "pure black", hex: "#000000" },
  { label: "near-black", hex: "#111113" },
  { label: "mid gray", hex: "#808080" },
  { label: "saturated red", hex: "#E23A3A" },
  { label: "saturated blue", hex: "#2D6CDF" },
  { label: "saturated green", hex: "#2EA043" },
  { label: "saturated yellow", hex: "#F1E05A" },
  { label: "saturated magenta", hex: "#D633B0" },
  { label: "deep navy", hex: "#0B1C3F" },
  { label: "pale mint", hex: "#D6F5E3" },
];

/** Largest difference between any two RGB channels — 0 means a true gray. */
function channelSpread(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

describe("deriveAccentTokens — legibility invariants", () => {
  for (const theme of THEMES) {
    for (const { label, hex } of PICKS) {
      it(`${theme}: "${label}" keeps CTA text readable`, () => {
        const { accent, accentText } = deriveAccentTokens(hex, theme);
        // The CTA paints accentText on accent; AA body text is 4.5:1.
        expect(contrastRatio(accent, accentText)).toBeGreaterThanOrEqual(4.5);
      });

      it(`${theme}: "${label}" keeps link text readable on the panel`, () => {
        const { accentLink } = deriveAccentTokens(hex, theme);
        expect(contrastRatio(accentLink, PANEL_BG[theme])).toBeGreaterThanOrEqual(4.5);
      });

      it(`${theme}: "${label}" keeps the CTA distinguishable from the panel`, () => {
        const { accent } = deriveAccentTokens(hex, theme);
        // Not a text ratio — a filled surface just has to not dissolve into
        // the panel behind it.
        expect(contrastRatio(accent, PANEL_BG[theme])).toBeGreaterThan(1.25);
      });
    }
  }

  it("never returns a malformed hex", () => {
    for (const theme of THEMES) {
      for (const { hex } of [...PICKS, { hex: "#010409" }]) {
        const t = deriveAccentTokens(hex, theme);
        for (const value of [t.accent, t.accentHover, t.accentText, t.accentLink]) {
          expect(value).toMatch(/^#[0-9A-F]{6}$/i);
        }
      }
    }
  });
});

/**
 * Regression: through 3.1.x any pick with chroma under the neutral cutoff was
 * discarded and replaced with the brand default. Picking white therefore left
 * the UI sitting on the previous colour, which read as the app ignoring you.
 */
describe("near-neutral picks drive an achromatic accent", () => {
  const NEUTRALS = ["#FFFFFF", "#F7F7F8", "#F5F0E8", "#808080", "#111113", "#000000"];

  for (const theme of THEMES) {
    for (const hex of NEUTRALS) {
      it(`${theme}: ${hex} yields a gray accent, not the brand default`, () => {
        const t = deriveAccentTokens(hex, theme);
        expect(t.neutral).toBe(true);
        // "Achromatic" in the only sense that matters on screen.
        expect(channelSpread(t.accent)).toBeLessThanOrEqual(2);
      });
    }

    it(`${theme}: lightness tracks the pick — white reads lighter than black`, () => {
      const white = deriveAccentTokens("#FFFFFF", theme);
      const black = deriveAccentTokens("#000000", theme);
      expect(hexToOklch(white.accent).L).toBeGreaterThan(hexToOklch(black.accent).L);
    });

    it(`${theme}: chrome tint drops its hue entirely`, () => {
      const t = deriveAccentTokens("#FFFFFF", theme);
      const tint = chromeTintTokens(t.hue, theme, t.neutral);
      for (const [prop, value] of Object.entries(tint)) {
        // --header-bg carries an 8-digit alpha suffix; compare the rgb part.
        expect(channelSpread(value.slice(0, 7)), prop).toBeLessThanOrEqual(2);
      }
    });
  }

  it("a colourful pick is NOT treated as neutral", () => {
    for (const theme of THEMES) {
      for (const hex of ["#E23A3A", "#2D6CDF", "#2EA043"]) {
        expect(deriveAccentTokens(hex, theme).neutral).toBe(false);
      }
    }
  });
});

describe("the default accent is the original PickHue green", () => {
  for (const theme of THEMES) {
    it(`${theme}: no pick derives from hue ~132`, () => {
      const t = deriveAccentTokens(null, theme);
      expect(t.neutral).toBe(false);
      // #87d624, the 1.x/2.x accent, sits at OKLCH hue 131.9.
      expect(t.hue).toBeCloseTo(132, 0);
      // Green: more green than red or blue.
      const { r, g, b } = parseHex(t.accent);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    });
  }
});

describe("hue is carried through for colourful picks", () => {
  it("keeps the picked hue within a few degrees", () => {
    for (const theme of THEMES) {
      for (const hex of ["#E23A3A", "#2D6CDF", "#2EA043", "#D633B0"]) {
        const pickHue = hexToOklch(hex).h;
        const accentHue = hexToOklch(deriveAccentTokens(hex, theme).accent).h;
        // Shortest distance around the hue circle.
        let delta = Math.abs(accentHue - pickHue) % 360;
        if (delta > 180) {
          delta = 360 - delta;
        }
        expect(delta, `${hex} @ ${theme}`).toBeLessThan(8);
      }
    }
  });
});

describe("tintedOverlaySurface", () => {
  it("returns a parseable rgba string", () => {
    for (const theme of THEMES) {
      expect(tintedOverlaySurface("#E23A3A", theme)).toMatch(
        /^rgba\(\d+, \d+, \d+, [\d.]+\)$/
      );
    }
  });

  it("goes colourless for a neutral pick", () => {
    for (const theme of THEMES) {
      const [r, g, b] = tintedOverlaySurface("#FFFFFF", theme)
        .match(/\d+/g)!
        .slice(0, 3)
        .map(Number);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
    }
  });
});
