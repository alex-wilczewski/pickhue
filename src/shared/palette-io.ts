import { normalizeHex } from "./colors";
import { decodeAse } from "./palette-formats";
import { getPalettesStore, replaceAllPalettes } from "./storage";
import type {
  ColorPalette,
  PaletteExportEnvelope,
  PaletteImportMode,
} from "./types";

const SHORT_HEX = /^#?([0-9a-f]{3})$/i;
const LONG_HEX = /^#?([0-9a-f]{6})$/i;
const CSS_VAR =
  /--([a-zA-Z0-9_-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g;

export function parseHexInput(input: string): string[] {
  const parts = input
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const colors: string[] = [];
  for (const part of parts) {
    const short = part.match(SHORT_HEX);
    if (short) {
      const expanded = short[1]
        .split("")
        .map((ch) => ch + ch)
        .join("");
      colors.push(normalizeHex(`#${expanded}`));
      continue;
    }
    const long = part.match(LONG_HEX);
    if (long) {
      colors.push(normalizeHex(`#${long[1]}`));
    }
  }
  return colors;
}

export function exportPalettes(palettes: ColorPalette[]): string {
  const envelope: PaletteExportEnvelope = {
    pickhue: 1,
    exportedAt: Date.now(),
    palettes: palettes.map((palette) => ({
      name: palette.name,
      colors: [...palette.colors],
    })),
  };
  return JSON.stringify(envelope, null, 2);
}

export function exportPalette(palette: ColorPalette): string {
  return exportPalettes([palette]);
}

function isExportEnvelope(value: unknown): value is PaletteExportEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as PaletteExportEnvelope;
  return (
    record.pickhue === 1 &&
    Array.isArray(record.palettes) &&
    record.palettes.every(
      (palette) =>
        typeof palette.name === "string" && Array.isArray(palette.colors)
    )
  );
}

function mergePaletteColors(
  existing: string[],
  incoming: string[]
): string[] {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const color of incoming) {
    try {
      const hex = normalizeHex(color);
      if (!seen.has(hex)) {
        seen.add(hex);
        merged.push(hex);
      }
    } catch {
      /* skip invalid */
    }
  }
  return merged;
}

function createImportedPalette(
  name: string,
  colors: string[]
): ColorPalette {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled palette",
    colors: mergePaletteColors([], colors),
    createdAt: now,
    updatedAt: now,
  };
}

function parseCssColor(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) {
    try {
      return normalizeHex(trimmed);
    } catch {
      return null;
    }
  }
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
  );
  if (!rgbMatch) {
    return null;
  }
  const toHex = (channel: string) =>
    Number(channel).toString(16).padStart(2, "0");
  return normalizeHex(
    `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`
  );
}

function parseCssPalettes(input: string): ColorPalette[] {
  const palettes: ColorPalette[] = [];
  const blocks = input.split(/(?=\/\*|\n\s*\.[a-zA-Z])/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }

    const commentMatch = trimmed.match(/\/\*\s*([^*]+)\s*\*\//);
    const classMatch = trimmed.match(/\.([a-zA-Z0-9_-]+)/);
    const name =
      commentMatch?.[1]?.trim() ||
      classMatch?.[1]?.replace(/-/g, " ") ||
      "Imported palette";

    const colors: string[] = [];
    for (const match of trimmed.matchAll(CSS_VAR)) {
      const hex = parseCssColor(match[2]);
      if (hex) {
        colors.push(hex);
      }
    }

    if (colors.length > 0) {
      palettes.push(createImportedPalette(name, colors));
    }
  }

  if (palettes.length > 0) {
    return palettes;
  }

  const colors: string[] = [];
  for (const match of input.matchAll(CSS_VAR)) {
    const hex = parseCssColor(match[2]);
    if (hex) {
      colors.push(hex);
    }
  }
  if (colors.length > 0) {
    return [createImportedPalette("Imported palette", colors)];
  }

  throw new Error("No CSS color variables found");
}

function parseHexListPalettes(input: string): ColorPalette[] {
  const sections = input
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    throw new Error("No colors found");
  }

  return sections.map((section, index) => {
    const lines = section.split("\n").map((line) => line.trim());
    const titleLine = lines[0]?.startsWith("#")
      ? lines[0].replace(/^#\s*/, "")
      : null;
    const colorSource = titleLine ? lines.slice(1).join("\n") : section;
    const colors = parseHexInput(colorSource);
    if (colors.length === 0) {
      throw new Error("No valid colors found");
    }
    return createImportedPalette(
      titleLine || `Imported palette ${index + 1}`,
      colors
    );
  });
}

export interface ImportPalettesResult {
  added: number;
  updated: number;
  palettes: ColorPalette[];
}

export function parseImportJson(json: string): PaletteExportEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!isExportEnvelope(parsed)) {
    throw new Error("Unrecognized palette export format");
  }
  return parsed;
}

export function parseImportText(text: string): ColorPalette[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Paste palette data or choose a file");
  }

  if (trimmed.startsWith("{")) {
    const envelope = parseImportJson(trimmed);
    return envelope.palettes.map((palette) =>
      createImportedPalette(palette.name, palette.colors)
    );
  }

  if (trimmed.includes("--") && trimmed.includes(":")) {
    return parseCssPalettes(trimmed);
  }

  const colors = parseHexInput(trimmed);
  if (colors.length > 0) {
    if (trimmed.includes("\n")) {
      return parseHexListPalettes(trimmed);
    }
    return [createImportedPalette("Imported palette", colors)];
  }

  throw new Error("Unrecognized palette format");
}

export function parseImportAse(buffer: ArrayBuffer): ColorPalette[] {
  return decodeAse(buffer);
}

async function applyImportedPalettes(
  incoming: ColorPalette[],
  mode: PaletteImportMode
): Promise<ImportPalettesResult> {
  if (mode === "replace") {
    const palettes = await replaceAllPalettes(incoming);
    return {
      added: palettes.palettes.length,
      updated: 0,
      palettes: palettes.palettes,
    };
  }

  const store = await getPalettesStore();
  const byName = new Map(
    store.palettes.map((palette) => [palette.name.toLowerCase(), palette])
  );

  let added = 0;
  let updated = 0;
  const nextPalettes = [...store.palettes];

  for (const incomingPalette of incoming) {
    const key = incomingPalette.name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      const mergedColors = mergePaletteColors(
        existing.colors,
        incomingPalette.colors
      );
      if (mergedColors.length !== existing.colors.length) {
        existing.colors = mergedColors;
        existing.updatedAt = Date.now();
        updated += 1;
      }
      continue;
    }

    nextPalettes.push(incomingPalette);
    byName.set(key, incomingPalette);
    added += 1;
  }

  const saved = await replaceAllPalettes(nextPalettes);
  return {
    added,
    updated,
    palettes: saved.palettes,
  };
}

export async function importPalettes(
  text: string,
  mode: PaletteImportMode
): Promise<ImportPalettesResult> {
  const incoming = parseImportText(text);
  return applyImportedPalettes(incoming, mode);
}

export async function importPalettesFromAse(
  buffer: ArrayBuffer,
  mode: PaletteImportMode
): Promise<ImportPalettesResult> {
  const incoming = parseImportAse(buffer);
  return applyImportedPalettes(incoming, mode);
}

export async function importPalettesFromClipboard(
  mode: PaletteImportMode
): Promise<ImportPalettesResult> {
  const text = await navigator.clipboard.readText();
  return importPalettes(text, mode);
}
