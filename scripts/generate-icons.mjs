import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
const logoSvgPath = join(outDir, "logo-mark.svg");
mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 128];
const background = { r: 20, g: 20, b: 20, alpha: 1 };
const logoSvg = readFileSync(logoSvgPath);

// Geometry mirrors the Figma "Extension Icon / Filled" variant (node 2:81):
// 36x36 container, #141414 fill, 12px radius, logo mark inset 12/8/14/21 (l/t/w/h).
const BASE = 36;
const RADIUS_RATIO = 12 / BASE;
const LOGO_W_RATIO = 14 / BASE;
const LOGO_H_RATIO = 21 / BASE;
const LOGO_LEFT_RATIO = 12 / BASE;
const LOGO_TOP_RATIO = 8 / BASE;

async function createIcon(size) {
  const radius = Math.round(size * RADIUS_RATIO);
  const logoWidth = Math.max(1, Math.round(size * LOGO_W_RATIO));
  const logoHeight = Math.max(1, Math.round(size * LOGO_H_RATIO));
  const logoLeft = Math.round(size * LOGO_LEFT_RATIO);
  const logoTop = Math.round(size * LOGO_TOP_RATIO);

  const logoRaster = await sharp(logoSvg)
    .resize(logoWidth, logoHeight, { fit: "fill" })
    .png()
    .toBuffer();

  const backgroundLayer = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .png()
    .toBuffer();

  const roundedMask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );

  // A single composite call with ordered inputs: sharp applies them in array
  // order, so the logo lands on the background first, then the rounded mask
  // (dest-in) clips the corners. Chaining separate .composite() calls would
  // make the last one win and silently drop the logo.
  const icon = await sharp(backgroundLayer)
    .composite([
      { input: logoRaster, left: logoLeft, top: logoTop },
      { input: roundedMask, blend: "dest-in" },
    ])
    .png()
    .toBuffer();

  await sharp(icon).toFile(join(outDir, `icon-${size}.png`));
}

for (const size of sizes) {
  await createIcon(size);
}

console.log("Generated PickHue icons from logo-mark.svg.");
