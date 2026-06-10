import { copyText } from "../shared/clipboard";
import { formatColor } from "../shared/colors";
import { getSettings } from "../shared/storage";
import type { ColorFormat } from "../shared/types";

const PICKER_ID = "pickhue-picker-root";
const TOAST_ID = "pickhue-copy-toast";
const LOUPE_SIZE = 144;
const SAMPLE = 11;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.75;
const ZOOM_DEFAULT = 1;
const ZOOM_WHEEL_SENSITIVITY = 0.001;

interface CaptureResponse {
  dataUrl?: string;
}

export type PickerCloseReason = "pick" | "cancel";

export class EyedropperOverlay {
  /** Invoked whenever the picker stops. `pick` = color chosen; `cancel` = Esc. */
  onClose?: (reason: PickerCloseReason) => void;

  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private scale = 1;
  private active = false;

  private loupe: HTMLDivElement | null = null;
  private lensCtx: CanvasRenderingContext2D | null = null;
  private hexLabel: HTMLSpanElement | null = null;
  private swatchDot: HTMLSpanElement | null = null;

  private pointerX = 0;
  private pointerY = 0;
  private rafId = 0;
  private hasPointer = false;
  private colorFormat: ColorFormat = "hex";
  private zoom = ZOOM_DEFAULT;
  private hint: HTMLParagraphElement | null = null;

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.stop("cancel");
    }
  };

  private onWheel = (event: WheelEvent): void => {
    if (!this.active) {
      return;
    }
    event.preventDefault();
    const next = this.zoom - event.deltaY * ZOOM_WHEEL_SENSITIVITY;
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    this.updateHint();
  };

  async start(): Promise<void> {
    if (this.active) {
      return;
    }

    const settings = await getSettings();
    this.colorFormat = settings.colorFormat;

    const response = (await chrome.runtime.sendMessage({
      type: "CAPTURE_TAB",
    })) as CaptureResponse;

    if (!response?.dataUrl) {
      return;
    }

    const image = await this.loadImage(response.dataUrl);
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

    if (!this.ctx) {
      return;
    }

    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.ctx.drawImage(image, 0, 0);
    this.scale = image.width / window.innerWidth;
    this.active = true;
    this.hasPointer = false;
    this.zoom = ZOOM_DEFAULT;
    this.mount();
    document.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
  }

  stop(reason: PickerCloseReason = "cancel"): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("wheel", this.onWheel, true);
    window.removeEventListener("mousemove", this.handleMove, true);
    window.removeEventListener("click", this.handleClick, true);
    this.root?.remove();
    this.root = null;
    this.canvas = null;
    this.ctx = null;
    this.loupe = null;
    this.lensCtx = null;
    this.hint = null;
    this.hasPointer = false;
    this.zoom = ZOOM_DEFAULT;
    this.onClose?.(reason);
  }

  private mount(): void {
    this.root = document.createElement("div");
    this.root.id = PICKER_ID;
    this.root.className = "pickhue-picker";

    this.loupe = document.createElement("div");
    this.loupe.className = "pickhue-loupe";

    const glass = document.createElement("div");
    glass.className = "pickhue-loupe__glass";

    const lens = document.createElement("canvas");
    lens.className = "pickhue-loupe__lens";
    lens.width = LOUPE_SIZE;
    lens.height = LOUPE_SIZE;
    this.lensCtx = lens.getContext("2d");

    const reticle = document.createElement("div");
    reticle.className = "pickhue-loupe__reticle";

    glass.append(lens, reticle);

    const info = document.createElement("div");
    info.className = "pickhue-loupe__info";

    this.swatchDot = document.createElement("span");
    this.swatchDot.className = "pickhue-loupe__dot";

    this.hexLabel = document.createElement("span");
    this.hexLabel.className = "pickhue-loupe__hex";
    this.hexLabel.textContent = "#------";

    info.append(this.swatchDot, this.hexLabel);
    this.loupe.append(glass, info);

    this.hint = document.createElement("p");
    this.hint.className = "pickhue-picker__hint";
    this.updateHint();

    this.root.append(this.loupe, this.hint);
    document.documentElement.append(this.root);

    // Listen on window (capture) rather than the overlay root: it is immune to
    // any page CSS or specificity quirks that could collapse the root's box.
    window.addEventListener("mousemove", this.handleMove, true);
    window.addEventListener("click", this.handleClick, true);

    this.renderLoop();
  }

  private handleMove = (event: MouseEvent): void => {
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.hasPointer = true;
  };

  private renderLoop = (): void => {
    if (!this.active) {
      return;
    }
    this.update();
    this.rafId = requestAnimationFrame(this.renderLoop);
  };

  private update(): void {
    if (!this.loupe) {
      return;
    }

    if (!this.hasPointer) {
      this.loupe.style.opacity = "0";
      return;
    }

    // Center the loupe on the pointer so the magnified center pixel is exactly
    // the pixel that will be picked (the system cursor is hidden via CSS).
    const tx = Math.round(this.pointerX - LOUPE_SIZE / 2);
    const ty = Math.round(this.pointerY - LOUPE_SIZE / 2);
    this.loupe.style.transform = `translate(${tx}px, ${ty}px)`;
    this.loupe.style.opacity = "1";

    this.drawLens();

    const hex = this.sampleAt(this.pointerX, this.pointerY);
    if (hex && this.hexLabel && this.swatchDot) {
      this.hexLabel.textContent = formatColor(hex, this.colorFormat);
      this.swatchDot.style.backgroundColor = hex;
    }
  }

  private updateHint(): void {
    if (!this.hint) {
      return;
    }
    const zoomPct = Math.round(this.zoom * 100);
    this.hint.innerHTML =
      zoomPct === 100
        ? "<b>Scroll</b> to zoom &middot; <b>Click</b> to pick &middot; <b>Esc</b> to close"
        : `<b>Scroll</b> to zoom &middot; <b>${zoomPct}%</b> &middot; <b>Click</b> to pick &middot; <b>Esc</b> to close`;
  }

  private handleClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    if (!this.hasPointer) {
      return;
    }

    const hex = this.sampleAt(event.clientX, event.clientY);
    if (!hex) {
      return;
    }

    // Everything here is synchronous so the clipboard write stays inside the
    // user-gesture (an awaited navigator.clipboard call silently fails in
    // content scripts when the document isn't focused).
    const formatted = formatColor(hex, this.colorFormat);
    copyText(formatted);
    chrome.runtime.sendMessage({ type: "COLOR_PICKED", hex });
    this.stop("pick");
    showCopyToast(formatted, hex);
  };

  private drawLens(): void {
    const lensCtx = this.lensCtx;
    if (!lensCtx || !this.ctx) {
      return;
    }

    const px = Math.round(this.pointerX * this.scale);
    const py = Math.round(this.pointerY * this.scale);
    const center = (SAMPLE - 1) / 2;
    const cell = LOUPE_SIZE / SAMPLE;

    lensCtx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    lensCtx.imageSmoothingEnabled = this.zoom < 1;

    for (let row = 0; row < SAMPLE; row += 1) {
      for (let col = 0; col < SAMPLE; col += 1) {
        const offsetX = Math.round((col - center) / this.zoom);
        const offsetY = Math.round((row - center) / this.zoom);
        const hex = this.readHex(px + offsetX, py + offsetY);
        lensCtx.fillStyle = hex ?? "rgba(0,0,0,0)";
        lensCtx.fillRect(
          Math.floor(col * cell),
          Math.floor(row * cell),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }

    lensCtx.strokeStyle = "rgba(255,255,255,0.12)";
    lensCtx.lineWidth = 1;
    for (let i = 1; i < SAMPLE; i += 1) {
      const pos = Math.floor(i * cell) + 0.5;
      lensCtx.beginPath();
      lensCtx.moveTo(pos, 0);
      lensCtx.lineTo(pos, LOUPE_SIZE);
      lensCtx.moveTo(0, pos);
      lensCtx.lineTo(LOUPE_SIZE, pos);
      lensCtx.stroke();
    }
  }

  private sampleAt(x: number, y: number): string | null {
    return this.readHex(Math.round(x * this.scale), Math.round(y * this.scale));
  }

  private readHex(x: number, y: number): string | null {
    if (!this.ctx || !this.canvas) {
      return null;
    }

    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
      return null;
    }

    const [r, g, b] = this.ctx.getImageData(x, y, 1, 1).data;
    const toHex = (value: number) => value.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load capture"));
      image.src = dataUrl;
    });
  }
}

export function showCopyToast(formatted: string, hex: string): void {
  let toast = document.getElementById(TOAST_ID) as HTMLDivElement | null;

  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "pickhue-copy-toast";
    document.documentElement.append(toast);
  }

  toast.innerHTML = `
    <span class="pickhue-copy-toast__swatch" style="background-color:${hex}"></span>
    <span class="pickhue-copy-toast__text">Copied ${formatted}</span>
  `;

  requestAnimationFrame(() => toast?.classList.add("is-visible"));

  window.setTimeout(() => {
    toast?.classList.remove("is-visible");
  }, 2200);
}
