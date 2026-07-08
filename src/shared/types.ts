export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch";
export type ThemeMode = "system" | "light" | "dark";

export interface Settings {
  themeMode: ThemeMode;
  colorFormat: ColorFormat;
  recentColors: string[];
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PalettesStore {
  version: 1;
  palettes: ColorPalette[];
}

export interface PaletteExportEnvelope {
  pickhue: 1;
  exportedAt: number;
  palettes: Array<{ name: string; colors: string[] }>;
}

export type PaletteImportMode = "merge" | "replace";

/** @deprecated Migrated to `themeMode` on read. */
export interface LegacySettings extends Partial<Settings> {
  lightMode?: boolean;
}

export type Message =
  | { type: "PING" }
  | { type: "TOGGLE_PANEL" }
  | { type: "START_PICKER" }
  | { type: "CAPTURE_TAB" }
  | { type: "COLOR_PICKED"; hex: string };

export const DEFAULT_SETTINGS: Settings = {
  themeMode: "system",
  colorFormat: "hex",
  recentColors: [],
};
