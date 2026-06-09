/**
 * Renders store/screenshots/*.html at 1280×800 and writes PNGs alongside them.
 * Requires: npx playwright install chromium (one-time).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenesDir = join(__dirname, "../store/screenshots");

const scenes = [
  "01-panel-dark",
  "02-panel-light",
  "03-magnifier",
  "04-copied",
];

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "Playwright is required. Run:\n  npm install -D playwright\n  npx playwright install chromium"
  );
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});

for (const scene of scenes) {
  const htmlPath = join(scenesDir, `${scene}.html`);
  if (!existsSync(htmlPath)) {
    console.warn(`Skipping missing scene: ${scene}`);
    continue;
  }
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  const outPath = join(scenesDir, `${scene}.png`);
  await page.screenshot({ path: outPath, type: "png" });
  console.log(`Wrote ${outPath}`);
}

await browser.close();
console.log("Done.");
