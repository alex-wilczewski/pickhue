import { isGalleryUrl } from "../shared/gallery";
import { UNINSTALL_FEEDBACK_URL, WHATS_NEW_URL } from "../shared/site";
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
  // Without host_permissions, tab.url is only populated once activeTab has been
  // granted, so an undefined url is "unknown", not "restricted". Failing closed
  // here would make the extension silently do nothing on a perfectly ordinary
  // page. This check is only an optimisation that avoids a pointless injection
  // attempt — Chrome itself still refuses to inject into restricted pages, and
  // injectContentScript() swallows that rejection — so when the url is unknown
  // it is both safe and more useful to try.
  if (!url) {
    return false;
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

chrome.runtime.onInstalled.addListener((details) => {
  void chrome.runtime.setUninstallURL(UNINSTALL_FEEDBACK_URL);

  // Show the 3.0 redesign once to users crossing the major-version boundary.
  if (details.reason === "update") {
    const previousMajor = parseInt(
      details.previousVersion?.split(".")[0] ?? "0",
      10
    );
    const currentMajor = parseInt(
      chrome.runtime.getManifest().version.split(".")[0] ?? "0",
      10
    );
    if (previousMajor < 3 && currentMajor >= 3) {
      void chrome.tabs.create({ url: WHATS_NEW_URL });
    }
  }
});

// Keyboard shortcut (see manifest commands) starts the eyedropper directly.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "start-picker") {
    return;
  }
  void (async () => {
    let target = tab;
    if (!target?.id) {
      [target] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
    }
    if (!target?.id || isHardRestricted(target.url) || isGalleryUrl(target.url)) {
      return;
    }
    await sendToContent(target.id, "START_PICKER");
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

  if (message.type === "OPEN_SHORTCUTS") {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }

  if (message.type === "GET_PICKER_SHORTCUT") {
    void chrome.commands.getAll().then((commands) => {
      const command = commands.find((entry) => entry.name === "start-picker");
      sendResponse({ shortcut: command?.shortcut ?? "" });
    });
    return true;
  }

  return undefined;
});
