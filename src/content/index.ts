import pickerCss from "./picker.css?inline";
import { PanelController } from "./panel";
import { EyedropperOverlay } from "./picker";

const LOADED_FLAG = "__pickhueContentLoaded";
const PICKER_STYLE_ID = "pickhue-picker-styles";

function ensurePickerStyles(): void {
  // Always refresh — open tabs can keep a stale style tag after extension reload.
  let style = document.getElementById(PICKER_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = PICKER_STYLE_ID;
    (document.head ?? document.documentElement).append(style);
  }
  style.textContent = pickerCss;
}

// The eyedropper overlay / copy toast live in the page's light DOM, so styles
 // must be injected here (this bundle is self-contained — no manifest content CSS).
ensurePickerStyles();

if (!(globalThis as Record<string, unknown>)[LOADED_FLAG]) {
  (globalThis as Record<string, unknown>)[LOADED_FLAG] = true;

  // Wait for the browser to composite a frame. `captureVisibleTab` snapshots the
  // last painted frame, so after removing the panel we must let the page repaint
  // (panel-free) before the picker captures — otherwise the magnifier samples a
  // screenshot that still shows the panel.
  const waitForRepaint = (): Promise<void> =>
    new Promise((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setTimeout(resolve, 0))
      );
    });

  const picker = new EyedropperOverlay();
  let pendingPaletteId: string | null = null;

  const panel = new PanelController({
    onStartPicker: (options) => {
      pendingPaletteId = options?.paletteId ?? null;
      void launchPicker();
    },
  });

  async function launchPicker(): Promise<void> {
    panel.hideImmediate();
    await waitForRepaint();
    await picker.start();
  }

  picker.onClose = (result) => {
    if (result.reason === "pick" && result.hex) {
      if (pendingPaletteId) {
        const paletteId = pendingPaletteId;
        pendingPaletteId = null;
        void panel.handlePickedColorForPalette(result.hex, paletteId).then(() => {
          void panel.show();
        });
        return;
      }
      // Reopen so the freshly picked color is visible at the front of recents.
      void panel.show();
      return;
    }
    pendingPaletteId = null;
    // Esc dismisses the whole extension, not back to the panel.
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "PING") {
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "TOGGLE_PANEL") {
      void panel.toggle();
      sendResponse({ ok: true });
      return true;
    }

    return undefined;
  });
}
