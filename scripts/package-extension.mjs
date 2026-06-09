/**
 * Builds the extension and zips dist/ for Chrome Web Store upload.
 * manifest.json must be at the root of the zip.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distDir = join(root, "dist");
const version = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
).version;
const zipName = `pickhue-${version}.zip`;
const zipPath = join(root, zipName);

console.log("Building extension…");
execSync("npm run build", { cwd: root, stdio: "inherit" });

const required = ["manifest.json", "content.js", "service-worker-loader.js"];
for (const file of required) {
  if (!existsSync(join(distDir, file))) {
    console.error(`Missing dist/${file} — build may have failed.`);
    process.exit(1);
  }
}

if (existsSync(zipPath)) {
  rmSync(zipPath);
}

const ps = `Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force`;
execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "inherit" });

console.log(`\nReady to upload: ${zipPath}`);
