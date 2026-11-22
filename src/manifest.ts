import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "PickHue",
  version: "3.2.0",
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
  // No "tabs" permission and no host_permissions. activeTab is an ALTERNATIVE
  // to host access, not a companion to it:
  //
  //   - captureVisibleTab: "the extension must have either the <all_urls>
  //     permission or the activeTab permission"
  //   - scripting.executeScript on the active tab: allowed under activeTab so
  //     long as "scripting" is also declared
  //   - tabs.sendMessage: only ever reaches a content script we already
  //     injected ourselves under that same grant
  //
  // Both entry points — the toolbar action and the start-picker command — are
  // listed activeTab invocation triggers, so each one re-grants access to the
  // current tab. The payoff is the install prompt: activeTab "displays no
  // warning message during installation", where <all_urls> asks the user to
  // allow reading and changing their data on every site they visit.
  //
  // Trade-off: an activeTab grant is revoked when the tab navigates away, so a
  // panel left open across a navigation needs re-invoking. See store/PERMISSIONS.md.
  permissions: ["storage", "activeTab", "scripting"],
});
