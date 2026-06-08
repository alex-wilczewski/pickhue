export type ColorFormat = "hex" | "rgb" | "hsl";
export type ThemeMode = "system" | "light" | "dark";

export interface Settings {
  themeMode: ThemeMode;
  colorFormat: ColorFormat;
  recentColors: string[];
}

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
