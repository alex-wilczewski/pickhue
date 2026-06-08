/**
 * Chrome Web Store pages cannot be scripted (see kCannotScriptGallery in Chromium).
 * Declarative content scripts run in an empty proxy document, so in-page UI never
 * appears. Use an extension popup on these URLs instead.
 */
export function isGalleryUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "chromewebstore.google.com") {
      return true;
    }
    return (
      parsed.hostname === "chrome.google.com" &&
      parsed.pathname.startsWith("/webstore")
    );
  } catch {
    return false;
  }
}
