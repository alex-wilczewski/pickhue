import { PanelController } from "./panel";
import { EyedropperOverlay } from "./picker";

const picker = new EyedropperOverlay();
const panel = new PanelController({
  onStartPicker: () => {
    panel.hide();
    void picker.start();
  },
});

// When the eyedropper closes (pick, Esc, or cancel) bring the panel back so the
// freshly picked color is visible at the front of Recent Colors.
picker.onClose = () => {
  void panel.show();
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
