import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "PickHue",
  version: "3.0.0",
  description: "An elegant color picker for your browser.",
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  action: {
    default_title: "PickHue",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
    },
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  // Keyboard shortcut straight into the eyedropper — no toolbar detour.
  // Commands count as invoking the extension, so activeTab is granted.
  commands: {
    "start-picker": {
      suggested_key: { default: "Alt+Shift+P" },
      description: "Pick a color from the page",
    },
  },
  // The content script is built separately into a self-contained IIFE
  // (dist/content.js) and injected on demand via chrome.scripting. It is not
  // declared here so we never ship the @crxjs dynamic-import loader, which
  // strict page CSPs reject.
  //
  // Do not request the broad "tabs" permission — chrome.tabs.sendMessage and
  // chrome.tabs.captureVisibleTab work with activeTab + host access alone
  // (Chrome Web Store: Purple Potassium).
  permissions: ["storage", "activeTab", "scripting"],
  host_permissions: ["<all_urls>"],
});
