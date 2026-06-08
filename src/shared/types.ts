export type ColorFormat = "hex" | "rgb" | "hsl";

export interface Settings {
  lightMode: boolean;
  colorFormat: ColorFormat;
  recentColors: string[];
}

export type Message =
  | { type: "PING" }
  | { type: "TOGGLE_PANEL" }
  | { type: "CAPTURE_TAB" }
  | { type: "COLOR_PICKED"; hex: string };

export const DEFAULT_SETTINGS: Settings = {
  lightMode: false,
  colorFormat: "hex",
  recentColors: [],
};
