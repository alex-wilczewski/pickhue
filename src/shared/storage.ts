import { normalizeHex } from "./colors";
import {
  DEFAULT_SETTINGS,
  type ColorFormat,
  type ColorPalette,
  type LegacySettings,
  type PalettesStore,
  type Settings,
  type ThemeMode,
} from "./types";

const SETTINGS_KEY = "pickhue_settings";
const PALETTES_KEY = "pickhue_palettes";

export const PALETTE_LIMITS = {
  maxPalettes: 32,
  maxColorsPerPalette: 24,
  maxNameLength: 48,
} as const;

export class StorageQuotaError extends Error {
  constructor(message = "Storage quota exceeded") {
    super(message);
    this.name = "StorageQuotaError";
  }
}

const COLOR_FORMATS: ColorFormat[] = ["hex", "rgb", "hsl", "oklch"];

const DEFAULT_PALETTES_STORE: PalettesStore = {
  version: 1,
  palettes: [],
};

function normalizeThemeMode(stored: LegacySettings | undefined): ThemeMode {
  if (stored?.themeMode) {
    return stored.themeMode;
  }
  if (typeof stored?.lightMode === "boolean") {
    return stored.lightMode ? "light" : "dark";
  }
  return DEFAULT_SETTINGS.themeMode;
}

function normalizeColorFormat(stored: LegacySettings | undefined): ColorFormat {
  if (stored?.colorFormat && COLOR_FORMATS.includes(stored.colorFormat)) {
    return stored.colorFormat;
  }
  return DEFAULT_SETTINGS.colorFormat;
}

function normalizePaletteName(name: string): string {
  const trimmed = name.trim().slice(0, PALETTE_LIMITS.maxNameLength);
  return trimmed || "Untitled palette";
}

function normalizePaletteColors(colors: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const color of colors) {
    try {
      const hex = normalizeHex(color);
      if (!seen.has(hex)) {
        seen.add(hex);
        normalized.push(hex);
      }
    } catch {
      /* skip invalid */
    }
    if (normalized.length >= PALETTE_LIMITS.maxColorsPerPalette) {
      break;
    }
  }
  return normalized;
}

function normalizeRecentColors(colors: unknown): string[] {
  if (!Array.isArray(colors)) {
    return [];
  }
  return normalizePaletteColors(colors as string[]).slice(0, 24);
}

function normalizePalette(palette: ColorPalette): ColorPalette {
  return {
    ...palette,
    name: normalizePaletteName(palette.name),
    colors: normalizePaletteColors(palette.colors),
  };
}

async function syncSet(key: string, value: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        const message = chrome.runtime.lastError.message ?? "Storage error";
        if (/quota|QUOTA|bytes/i.test(message)) {
          reject(new StorageQuotaError(message));
          return;
        }
        reject(new Error(message));
        return;
      }
      resolve();
    });
  });
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as LegacySettings | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    themeMode: normalizeThemeMode(stored),
    colorFormat: normalizeColorFormat(stored),
    recentColors: normalizeRecentColors(stored?.recentColors),
  };
}

export async function saveSettings(
  partial: Partial<Settings>
): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await syncSet(SETTINGS_KEY, next);
  return next;
}

export async function addRecentColor(hex: string): Promise<Settings> {
  const settings = await getSettings();
  const normalized = hex.toUpperCase();
  const recentColors = [
    normalized,
    ...settings.recentColors.filter((color) => color !== normalized),
  ].slice(0, 24);
  return saveSettings({ recentColors });
}

export async function promoteRecentColor(hex: string): Promise<Settings> {
  return addRecentColor(hex);
}

export async function removeRecentColor(hex: string): Promise<Settings> {
  const settings = await getSettings();
  let normalized: string;
  try {
    normalized = normalizeHex(hex);
  } catch {
    return settings;
  }
  return saveSettings({
    recentColors: settings.recentColors.filter((color) => color !== normalized),
  });
}

export async function getPalettesStore(): Promise<PalettesStore> {
  const result = await chrome.storage.sync.get(PALETTES_KEY);
  const stored = result[PALETTES_KEY] as PalettesStore | undefined;
  if (!stored?.palettes) {
    return { ...DEFAULT_PALETTES_STORE };
  }
  return {
    version: 1,
    palettes: stored.palettes.map(normalizePalette),
  };
}

export async function savePalettesStore(
  store: PalettesStore
): Promise<PalettesStore> {
  const next: PalettesStore = {
    version: 1,
    palettes: store.palettes
      .map(normalizePalette)
      .slice(0, PALETTE_LIMITS.maxPalettes),
  };
  await syncSet(PALETTES_KEY, next);
  return next;
}

export async function getPalettes(): Promise<ColorPalette[]> {
  const store = await getPalettesStore();
  return store.palettes;
}

function createPaletteRecord(
  name: string,
  colors: string[] = []
): ColorPalette {
  const now = Date.now();
  return normalizePalette({
    id: crypto.randomUUID(),
    name: normalizePaletteName(name),
    colors,
    createdAt: now,
    updatedAt: now,
  });
}

export async function createPalette(
  name = "Untitled palette",
  colors: string[] = []
): Promise<ColorPalette> {
  const store = await getPalettesStore();
  if (store.palettes.length >= PALETTE_LIMITS.maxPalettes) {
    throw new Error("Maximum number of palettes reached");
  }
  const palette = createPaletteRecord(name, colors);
  await savePalettesStore({
    version: 1,
    palettes: [...store.palettes, palette],
  });
  return palette;
}

export async function updatePalette(
  id: string,
  patch: Partial<Pick<ColorPalette, "name" | "colors">>
): Promise<ColorPalette | null> {
  const store = await getPalettesStore();
  let updated: ColorPalette | null = null;
  const palettes = store.palettes.map((palette) => {
    if (palette.id !== id) {
      return palette;
    }
    updated = normalizePalette({
      ...palette,
      ...patch,
      name: patch.name !== undefined ? patch.name : palette.name,
      colors: patch.colors !== undefined ? patch.colors : palette.colors,
      updatedAt: Date.now(),
    });
    return updated;
  });
  if (!updated) {
    return null;
  }
  await savePalettesStore({ version: 1, palettes });
  return updated;
}

export async function deletePalette(id: string): Promise<boolean> {
  const store = await getPalettesStore();
  const next = store.palettes.filter((palette) => palette.id !== id);
  if (next.length === store.palettes.length) {
    return false;
  }
  await savePalettesStore({ version: 1, palettes: next });
  return true;
}

export async function getPalette(id: string): Promise<ColorPalette | null> {
  const store = await getPalettesStore();
  return store.palettes.find((palette) => palette.id === id) ?? null;
}

export async function addColorToPalette(
  paletteId: string,
  hex: string
): Promise<ColorPalette | null> {
  const palette = await getPalette(paletteId);
  if (!palette) {
    return null;
  }
  const normalized = normalizeHex(hex);
  if (palette.colors.includes(normalized)) {
    return palette;
  }
  if (palette.colors.length >= PALETTE_LIMITS.maxColorsPerPalette) {
    throw new Error("Palette is full");
  }
  return updatePalette(paletteId, {
    colors: [...palette.colors, normalized],
  });
}

export async function addColorsToPalette(
  paletteId: string,
  hexes: string[]
): Promise<ColorPalette | null> {
  const palette = await getPalette(paletteId);
  if (!palette) {
    return null;
  }
  const merged = normalizePaletteColors([...palette.colors, ...hexes]);
  return updatePalette(paletteId, { colors: merged });
}

export async function removeColorFromPalette(
  paletteId: string,
  hex: string
): Promise<ColorPalette | null> {
  const palette = await getPalette(paletteId);
  if (!palette) {
    return null;
  }
  const normalized = normalizeHex(hex);
  return updatePalette(paletteId, {
    colors: palette.colors.filter((color) => color !== normalized),
  });
}

export async function reorderPaletteColor(
  paletteId: string,
  fromIndex: number,
  toIndex: number
): Promise<ColorPalette | null> {
  const palette = await getPalette(paletteId);
  if (!palette) {
    return null;
  }
  const colors = [...palette.colors];
  if (
    fromIndex < 0 ||
    fromIndex >= colors.length ||
    toIndex < 0 ||
    toIndex >= colors.length ||
    fromIndex === toIndex
  ) {
    return palette;
  }
  const [item] = colors.splice(fromIndex, 1);
  colors.splice(toIndex, 0, item);
  return updatePalette(paletteId, { colors });
}

export async function reorderPalettes(
  fromIndex: number,
  toIndex: number
): Promise<ColorPalette[]> {
  const store = await getPalettesStore();
  const palettes = [...store.palettes];
  if (
    fromIndex < 0 ||
    fromIndex >= palettes.length ||
    toIndex < 0 ||
    toIndex >= palettes.length ||
    fromIndex === toIndex
  ) {
    return palettes;
  }
  const [item] = palettes.splice(fromIndex, 1);
  palettes.splice(toIndex, 0, item);
  const saved = await savePalettesStore({ version: 1, palettes });
  return saved.palettes;
}

export async function replaceAllPalettes(
  palettes: ColorPalette[]
): Promise<PalettesStore> {
  return savePalettesStore({
    version: 1,
    palettes: palettes.slice(0, PALETTE_LIMITS.maxPalettes),
  });
}
