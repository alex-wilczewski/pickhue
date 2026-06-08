import { addRecentColor } from "../shared/storage";

const RESTRICTED_PREFIXES = [
  "chrome://",
  "brave://",
  "edge://",
  "about:",
  "chrome-extension://",
  "https://chrome.google.com/webstore",
  "https://chromewebstore.google.com",
];

function isRestricted(url: string | undefined): boolean {
  if (!url) {
    return true;
  }
  return RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Make sure the content script is running in the tab. It's declared in the
 * manifest so it auto-injects on normal navigations, but on pages that were
 * already open when the extension loaded/updated we re-inject on demand.
 */
async function ensureContentReady(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch {
    const entry = chrome.runtime.getManifest().content_scripts?.[0];
    if (!entry) {
      return false;
    }

    try {
      if (entry.css) {
        for (const file of entry.css) {
          await chrome.scripting.insertCSS({ target: { tabId }, files: [file] });
        }
      }
      if (entry.js) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: entry.js,
        });
      }
      return true;
    } catch {
      return false;
    }
  }
}

async function flashBadge(tabId: number, text: string): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#464646" });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => {
    void chrome.action.setBadgeText({ tabId, text: "" });
  }, 1600);
}

chrome.action.onClicked.addListener((tab) => {
  void (async () => {
    if (!tab.id || isRestricted(tab.url)) {
      if (tab.id) {
        await flashBadge(tab.id, "n/a");
      }
      return;
    }

    const ready = await ensureContentReady(tab.id);
    if (!ready) {
      await flashBadge(tab.id, "n/a");
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
    } catch {
      await flashBadge(tab.id, "n/a");
    }
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
