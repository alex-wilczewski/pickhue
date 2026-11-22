import { describe, expect, it } from "vitest";
import {
  exportPalette,
  exportPalettes,
  parseHexInput,
  parseImportJson,
  parseImportText,
} from "./palette-io";
import { decodeAse, encodeAse, exportPalettesHexList } from "./palette-formats";
import type { ColorPalette } from "./types";

/**
 * Import/export is the only place in PickHue where a silent bug destroys work
 * the user cannot get back. Every format that can leave the app should be able
 * to come back in unchanged.
 */

function palette(name: string, colors: string[]): ColorPalette {
  return { id: `id-${name}`, name, colors, createdAt: 1, updatedAt: 2 };
}

const BRAND = palette("Brand", ["#87D624", "#010409", "#FFFFFF"]);
const UI = palette("UI", ["#1F6FEB", "#8957E5"]);

describe("JSON round-trip", () => {
  it("survives export → import with names and colors intact", () => {
    const envelope = parseImportJson(exportPalettes([BRAND, UI]));
    expect(envelope.palettes).toHaveLength(2);
    expect(envelope.palettes[0]!.name).toBe("Brand");
    expect(envelope.palettes[0]!.colors).toEqual(BRAND.colors);
    expect(envelope.palettes[1]!.colors).toEqual(UI.colors);
  });

  it("round-trips a single palette", () => {
    const envelope = parseImportJson(exportPalette(UI));
    expect(envelope.palettes).toHaveLength(1);
    expect(envelope.palettes[0]!.colors).toEqual(UI.colors);
  });

  it("preserves an empty palette rather than dropping it", () => {
    const envelope = parseImportJson(exportPalettes([palette("Empty", [])]));
    expect(envelope.palettes).toHaveLength(1);
    expect(envelope.palettes[0]!.colors).toEqual([]);
  });

  it("survives names with quotes, emoji and newlines", () => {
    const odd = palette('He said "hi" 🎨\nsecond line', ["#87D624"]);
    const envelope = parseImportJson(exportPalettes([odd]));
    expect(envelope.palettes[0]!.name).toBe(odd.name);
  });

  it("rejects json that is not a PickHue export", () => {
    expect(() => parseImportJson("{}")).toThrow();
    expect(() => parseImportJson("not json at all")).toThrow();
    expect(() => parseImportJson('{"palettes":"nope"}')).toThrow();
  });
});

describe("ASE round-trip", () => {
  it("survives encode → decode with names and colors intact", () => {
    const encoded = encodeAse([BRAND, UI]);
    const decoded = decodeAse(
      encoded.buffer.slice(
        encoded.byteOffset,
        encoded.byteOffset + encoded.byteLength
      ) as ArrayBuffer
    );
    expect(decoded).toHaveLength(2);
    expect(decoded[0]!.name).toBe("Brand");
    expect(decoded[0]!.colors).toEqual(BRAND.colors);
    expect(decoded[1]!.name).toBe("UI");
    expect(decoded[1]!.colors).toEqual(UI.colors);
  });

  it("round-trips the extremes of the range without drift", () => {
    const extremes = palette("Extremes", ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"]);
    const encoded = encodeAse([extremes]);
    const decoded = decodeAse(
      encoded.buffer.slice(
        encoded.byteOffset,
        encoded.byteOffset + encoded.byteLength
      ) as ArrayBuffer
    );
    expect(decoded[0]!.colors).toEqual(extremes.colors);
  });
});

describe("parseHexInput", () => {
  it("accepts the separators people actually paste", () => {
    expect(parseHexInput("#87D624, #1F6FEB")).toEqual(["#87D624", "#1F6FEB"]);
    expect(parseHexInput("#87D624 #1F6FEB")).toEqual(["#87D624", "#1F6FEB"]);
    expect(parseHexInput("#87D624;#1F6FEB")).toEqual(["#87D624", "#1F6FEB"]);
    expect(parseHexInput("#87D624\n#1F6FEB")).toEqual(["#87D624", "#1F6FEB"]);
  });

  it("expands shorthand hex", () => {
    expect(parseHexInput("#abc")).toEqual(["#AABBCC"]);
  });

  it("normalises case", () => {
    expect(parseHexInput("#87d624")).toEqual(["#87D624"]);
  });

  it("skips junk instead of throwing", () => {
    expect(parseHexInput("#87D624 banana #ZZZZZZ #1F6FEB")).toEqual([
      "#87D624",
      "#1F6FEB",
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(parseHexInput("")).toEqual([]);
    expect(parseHexInput("   \n  ")).toEqual([]);
  });
});

describe("hex-list export feeds back into text import", () => {
  it("round-trips through the plain hex list", () => {
    const text = exportPalettesHexList([BRAND]);
    const back = parseImportText(text);
    const colors = back.flatMap((p) => p.colors);
    for (const color of BRAND.colors) {
      expect(colors).toContain(color);
    }
  });
});
