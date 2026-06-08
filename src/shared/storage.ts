import {
  DEFAULT_SETTINGS,
  type LegacySettings,
  type Settings,
  type ThemeMode,
} from "./types";

const STORAGE_KEY = "pickhue_settings";

function normalizeThemeMode(stored: LegacySettings | undefined): ThemeMode {
  if (stored?.themeMode) {
    return stored.themeMode;
  }
  if (typeof stored?.lightMode === "boolean") {
    return stored.lightMode ? "light" : "dark";
  }
  return DEFAULT_SETTINGS.themeMode;
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as LegacySettings | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    themeMode: normalizeThemeMode(stored),
    recentColors: stored?.recentColors ?? DEFAULT_SETTINGS.recentColors,
  };
}

export async function saveSettings(
  partial: Partial<Settings>
): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
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
