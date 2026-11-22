/**
 * Verifies the built dist/manifest.json before it can be packaged or released.
 *
 * Requesting no site access is PickHue's central promise: installing it shows
 * no "read and change all your data on all websites" warning. That promise is
 * one line away from being undone by accident, so it is enforced by the build
 * rather than by a review checklist. Run from CI and from `npm run package`,
 * so a zip that breaks it cannot be produced by hand either.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "dist", "manifest.json");

if (!existsSync(manifestPath)) {
  console.error("dist/manifest.json not found — run `npm run build` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const EXPECTED = ["activeTab", "scripting", "storage"];

const actual = [...(manifest.permissions ?? [])].sort();
const problems = [];

if (JSON.stringify(actual) !== JSON.stringify(EXPECTED)) {
  problems.push(
    `permissions are ${JSON.stringify(actual)}, expected ${JSON.stringify(EXPECTED)}`
  );
}
if (manifest.host_permissions) {
  problems.push(
    "host_permissions is present — it must stay absent so installing shows no site-access warning"
  );
}
if (manifest.optional_host_permissions) {
  problems.push("optional_host_permissions is present");
}

if (problems.length > 0) {
  console.error("Manifest permission check failed:");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error("\nSee store/PERMISSIONS.md for why this set is fixed.");
  process.exit(1);
}

console.log(
  `Permissions OK: ${JSON.stringify(actual)} · no host permissions · v${manifest.version}`
);
