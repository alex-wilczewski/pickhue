import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Dedicated build for the content script. Outputs a single self-contained IIFE
 * (no runtime `import()`, no web-accessible-resource module loading), so it can
 * be injected into any page regardless of the host's Content Security Policy.
 *
 * This sidesteps the @crxjs content-script loader, whose dynamic import is
 * refused by strict page CSPs (notably in Brave). Runs as a post-build step and
 * writes into the existing dist/ without clearing it.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    cssCodeSplit: false,
    target: "chrome110",
    lib: {
      entry: resolve(__dirname, "src/content/index.ts"),
      formats: ["iife"],
      name: "PickHueContent",
      fileName: () => "content.js",
    },
  },
});
