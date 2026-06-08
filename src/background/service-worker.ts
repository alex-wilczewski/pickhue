import { isGalleryUrl } from "../shared/gallery";
import { addRecentColor } from "../shared/storage";

const CONTENT_SCRIPT = "content.js";

/** Browser-internal pages where scripting is never allowed. */
const HARD_RESTRICTED_PREFIXES = [
  "chrome://",
  "brave://",
  "edge://",
  "about:",
  "chrome-extension://",
  "devtools://",
];

function isHardRestricted(url: string | undefined): boolean {
  if (!url) {
    return true;
  }
  return HARD_RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT],
    });
    return true;
  } catch {
    return false;
  }
}

async function pingContentScript(tabId: number): Promise<boolean> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: "PING",
    })) as { ok?: boolean } | undefined;
    return response?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Send a message to the content script, injecting it first if needed. Retries a
 * few times so the very first click after install/navigation is reliable.
 */
async function sendToContent(
  tabId: number,
  type: "TOGGLE_PANEL" | "START_PICKER"
): Promise<boolean> {
  let injected = false;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await pingContentScript(tabId)) {
      try {
        await chrome.tabs.sendMessage(tabId, { type });
        return true;
      } catch {
        /* listener not ready yet — fall through to retry */
      }
    }

    if (!injected) {
      injected = await injectContentScript(tabId);
      if (!injected) {
        return false;
      }
    }

    await sleep(30 + attempt * 25);
  }

  return false;
}

// Clicking the toolbar icon toggles the in-page panel. On pages the picker can't
// run on (browser-internal pages and the Chrome Web Store, which forbid
// scripting) we simply do nothing.
chrome.action.onClicked.addListener((tab) => {
  void (async () => {
    if (!tab.id || isHardRestricted(tab.url) || isGalleryUrl(tab.url)) {
      return;
    }
    await sendToContent(tab.id, "TOGGLE_PANEL");
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_TAB") {
    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;

    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({
          dataUrl: undefined,
          error: chrome.runtime.lastError?.message,
        });
        return;
      }
      sendResponse({ dataUrl });
    });
    return true;
  }

  if (message.type === "COLOR_PICKED") {
    void addRecentColor(message.hex);
  }

  return undefined;
});
