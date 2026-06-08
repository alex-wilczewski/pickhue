import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "PickHue",
  version: "0.1.0",
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
  // The content script is built separately into a self-contained IIFE
  // (dist/content.js) and injected on demand via chrome.scripting. It is not
  // declared here so we never ship the @crxjs dynamic-import loader, which
  // strict page CSPs reject.
  permissions: ["storage", "activeTab", "scripting", "tabs"],
  host_permissions: ["<all_urls>"],
});
