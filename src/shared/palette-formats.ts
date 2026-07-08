import { parseHex } from "./colors";
import type { ColorPalette } from "./types";

const ASE_SIGNATURE = 0x41455346; // "ASEF"

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function writeUtf16BeString(str: string): Uint8Array {
  const safe = str.slice(0, 200) || "Color";
  const buffer = new ArrayBuffer(2 + safe.length * 2);
  const view = new DataView(buffer);
  view.setUint16(0, safe.length, false);
  for (let i = 0; i < safe.length; i++) {
    view.setUint16(2 + i * 2, safe.charCodeAt(i), false);
  }
  return new Uint8Array(buffer);
}

function readUtf16BeString(
  view: DataView,
  offset: number
): { value: string; offset: number } {
  const length = view.getUint16(offset, false);
  offset += 2;
  let value = "";
  for (let i = 0; i < length; i++) {
    value += String.fromCharCode(view.getUint16(offset, false));
    offset += 2;
  }
  return { value, offset };
}

function encodeBlock(type: number, data: Uint8Array): Uint8Array {
  const buffer = new ArrayBuffer(6 + data.length);
  const view = new DataView(buffer);
  view.setUint16(0, type, false);
  view.setUint32(2, data.length, false);
  new Uint8Array(buffer, 6).set(data);
  return new Uint8Array(buffer);
}

function encodeColorBlock(hex: string, name: string): Uint8Array {
  const { r, g, b } = parseHex(hex);
  const nameBytes = writeUtf16BeString(name);
  const buffer = new ArrayBuffer(nameBytes.length + 4 + 12 + 2);
  const view = new DataView(buffer);
  let offset = 0;
  new Uint8Array(buffer).set(nameBytes, offset);
  offset += nameBytes.length;
  view.setUint8(offset++, 0x52);
  view.setUint8(offset++, 0x47);
  view.setUint8(offset++, 0x42);
  view.setUint8(offset++, 0x20);
  view.setFloat32(offset, r / 255, false);
  offset += 4;
  view.setFloat32(offset, g / 255, false);
  offset += 4;
  view.setFloat32(offset, b / 255, false);
  offset += 4;
  view.setUint16(offset, 2, false);
  return encodeBlock(0x0001, new Uint8Array(buffer));
}

function encodeGroupStart(name: string): Uint8Array {
  return encodeBlock(0xc001, writeUtf16BeString(name));
}

function encodeGroupEnd(): Uint8Array {
  return encodeBlock(0xc002, new Uint8Array(0));
}

function slugifyPaletteName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "palette";
}

export function encodeAse(palettes: ColorPalette[]): Uint8Array {
  const header = new ArrayBuffer(10);
  const headerView = new DataView(header);
  headerView.setUint32(0, ASE_SIGNATURE, false);
  headerView.setUint16(4, 1, false);
  headerView.setUint16(6, 0, false);

  const chunks: Uint8Array[] = [new Uint8Array(header)];

  for (const palette of palettes) {
    chunks.push(encodeGroupStart(palette.name));
    palette.colors.forEach((hex, index) => {
      const name = hex.replace("#", "").toUpperCase();
      chunks.push(encodeColorBlock(hex, name || `Color ${index + 1}`));
    });
    chunks.push(encodeGroupEnd());
  }

  return concatChunks(chunks);
}

export function decodeAse(buffer: ArrayBuffer): ColorPalette[] {
  const view = new DataView(buffer);
  if (buffer.byteLength < 10) {
    throw new Error("Invalid ASE file");
  }
  if (view.getUint32(0, false) !== ASE_SIGNATURE) {
    throw new Error("Not an ASE file");
  }

  let offset = 10;
  const palettes: ColorPalette[] = [];
  let currentName = "Imported palette";
  let currentColors: string[] = [];
  const now = Date.now();

  const flushPalette = (): void => {
    if (currentColors.length === 0) {
      return;
    }
    palettes.push({
      id: crypto.randomUUID(),
      name: currentName,
      colors: [...currentColors],
      createdAt: now,
      updatedAt: now,
    });
    currentColors = [];
  };

  while (offset + 6 <= buffer.byteLength) {
    const type = view.getUint16(offset, false);
    offset += 2;
    const length = view.getUint32(offset, false);
    offset += 4;
    const end = offset + length;
    if (end > buffer.byteLength) {
      break;
    }

    if (type === 0xc001) {
      flushPalette();
      const name = readUtf16BeString(view, offset);
      currentName = name.value.trim() || "Imported palette";
      offset = end;
      continue;
    }

    if (type === 0xc002) {
      flushPalette();
      offset = end;
      continue;
    }

    if (type === 0x0001) {
      const name = readUtf16BeString(view, offset);
      let colorOffset = name.offset;
      const model = String.fromCharCode(
        view.getUint8(colorOffset),
        view.getUint8(colorOffset + 1),
        view.getUint8(colorOffset + 2),
        view.getUint8(colorOffset + 3)
      );
      colorOffset += 4;

      if (model === "RGB ") {
        const r = Math.round(view.getFloat32(colorOffset, false) * 255);
        const g = Math.round(view.getFloat32(colorOffset + 4, false) * 255);
        const b = Math.round(view.getFloat32(colorOffset + 8, false) * 255);
        const toHex = (value: number) =>
          Math.min(255, Math.max(0, value)).toString(16).padStart(2, "0");
        currentColors.push(
          `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
        );
      }

      offset = end;
      continue;
    }

    offset = end;
  }

  flushPalette();

  if (palettes.length === 0) {
    throw new Error("No colors found in ASE file");
  }

  return palettes;
}

export function exportPalettesHexList(palettes: ColorPalette[]): string {
  return palettes
    .map((palette) => {
      const header = `# ${palette.name}`;
      const colors = palette.colors.join("\n");
      return `${header}\n${colors}`;
    })
    .join("\n\n");
}

export function exportPalettesCss(palettes: ColorPalette[]): string {
  return palettes
    .map((palette) => {
      const slug = slugifyPaletteName(palette.name);
      const vars = palette.colors
        .map(
          (hex, index) =>
            `  --swatch-${String(index + 1).padStart(2, "0")}: ${hex};`
        )
        .join("\n");
      return `/* ${palette.name} */\n.${slug} {\n${vars}\n}`;
    })
    .join("\n\n");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportPalettesAseFile(palettes: ColorPalette[]): void {
  const bytes = encodeAse(palettes);
  downloadBlob(
    new Blob([Uint8Array.from(bytes)], { type: "application/octet-stream" }),
    "pickhue-palettes.ase"
  );
}

export function exportPaletteAseFile(palette: ColorPalette): void {
  const bytes = encodeAse([palette]);
  downloadBlob(
    new Blob([Uint8Array.from(bytes)], { type: "application/octet-stream" }),
    `${slugifyPaletteName(palette.name)}.ase`
  );
}
