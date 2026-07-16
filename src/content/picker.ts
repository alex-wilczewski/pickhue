import { copyText } from "../shared/clipboard";
import { formatColor } from "../shared/colors";
import { colorDistanceSq, probeDomColor } from "../shared/dom-color";
import { resolveTheme } from "../shared/theme";
import { showPaletteMenu } from "./palette-menu";
import {
  addColorToPalette,
  createPalette,
  getPalettes,
  getSettings,
} from "../shared/storage";
import type { ColorFormat } from "../shared/types";

const PICKER_ID = "pickhue-picker-root";
const TOAST_ID = "pickhue-copy-toast";
let toastHideTimer = 0;
let toastPointerTimer = 0;
let toastPaletteMenuOpen = false;
let toastMenuOpenId = 0;
const LOUPE_SIZE = 144;
const SAMPLE = 11;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.75;
const ZOOM_DEFAULT = 1;
const ZOOM_STEP = 0.1;
const SCROLL_SETTLE_MS = 150;
/** If DOM and bitmap disagree beyond this, trust the rendered pixel. */
const DOM_BITMAP_MAX_DISTANCE_SQ = 55 * 55;

function waitForRepaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(resolve, 0))
    );
  });
}

interface CaptureResponse {
  dataUrl?: string;
}

export type PickerCloseReason = "pick" | "cancel";

export interface PickerCloseResult {
  reason: PickerCloseReason;
  hex?: string;
}

export class EyedropperOverlay {
  /** Invoked whenever the picker stops. */
  onClose?: (result: PickerCloseResult) => void;

  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private scaleX = 1;
  private scaleY = 1;
  private viewportOffsetX = 0;
  private viewportOffsetY = 0;
  private captureScrollX = 0;
  private captureScrollY = 0;
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
  private uiTheme: "light" | "dark" = "dark";
  private zoom = ZOOM_DEFAULT;
  private lastPickedHex: string | null = null;
  private hint: HTMLParagraphElement | null = null;
  private capturePending = false;
  private scrollCapturePending = false;
  private scrollCaptureTimer = 0;

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.stop("cancel");
      return;
    }

    if (this.isZoomInKey(event)) {
      event.preventDefault();
      this.adjustZoom(ZOOM_STEP);
      return;
    }

    if (this.isZoomOutKey(event)) {
      event.preventDefault();
      this.adjustZoom(-ZOOM_STEP);
    }
  };

  private isZoomInKey(event: KeyboardEvent): boolean {
    return (
      event.key === "+" ||
      event.key === "=" ||
      event.code === "NumpadAdd"
    );
  }

  private isZoomOutKey(event: KeyboardEvent): boolean {
    return event.key === "-" || event.code === "NumpadSubtract";
  }

  private adjustZoom(delta: number): void {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom + delta));
    if (next === this.zoom) {
      return;
    }
    this.zoom = next;
    this.updateHint();
  }

  private onScroll = (): void => {
    if (!this.active) {
      return;
    }

    // Recapture only after scrolling stops — hiding the overlay during capture
    // would otherwise flash the loupe on every scroll tick.
    window.clearTimeout(this.scrollCaptureTimer);
    this.scrollCaptureTimer = window.setTimeout(() => {
      this.scrollCaptureTimer = 0;
      void this.refreshCapture();
    }, SCROLL_SETTLE_MS);
  };

  async start(): Promise<void> {
    if (this.active) {
      return;
    }

    const settings = await getSettings();
    this.colorFormat = settings.colorFormat;
    this.uiTheme = resolveTheme(settings.themeMode);

    const response = (await chrome.runtime.sendMessage({
      type: "CAPTURE_TAB",
    })) as CaptureResponse;

    if (!(await this.applyCapture(response))) {
      return;
    }

    this.active = true;
    this.hasPointer = false;
    this.zoom = ZOOM_DEFAULT;
    this.mount();
    document.addEventListener("keydown", this.onKeyDown, true);
    document.addEventListener("scroll", this.onScroll, {
      capture: true,
      passive: true,
    });
    window.visualViewport?.addEventListener("resize", this.onScroll, {
      passive: true,
    });
    window.visualViewport?.addEventListener("scroll", this.onScroll, {
      passive: true,
    });
  }

  /**
   * Map viewport/client coordinates to captured bitmap pixels.
   * While scrolling, offset into the stale capture so the loupe stays accurate
   * without recapturing (and flashing) on every scroll event.
   */
  private clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const viewport = window.visualViewport;
    const scrollDeltaX = window.scrollX - this.captureScrollX;
    const scrollDeltaY = window.scrollY - this.captureScrollY;
    const viewportDeltaX =
      (viewport?.offsetLeft ?? 0) - this.viewportOffsetX;
    const viewportDeltaY =
      (viewport?.offsetTop ?? 0) - this.viewportOffsetY;

    const sampleX = clientX + scrollDeltaX + viewportDeltaX;
    const sampleY = clientY + scrollDeltaY + viewportDeltaY;

    const x = Math.floor((sampleX + this.viewportOffsetX) * this.scaleX + 0.5);
    const y = Math.floor((sampleY + this.viewportOffsetY) * this.scaleY + 0.5);
    return { x, y };
  }

  private updateCaptureMetrics(captureWidth: number, captureHeight: number): void {
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    this.viewportOffsetX = viewport?.offsetLeft ?? 0;
    this.viewportOffsetY = viewport?.offsetTop ?? 0;
    this.captureScrollX = window.scrollX;
    this.captureScrollY = window.scrollY;
    this.scaleX = captureWidth / viewportWidth;
    this.scaleY = captureHeight / viewportHeight;
  }

  private setCaptureOverlayHidden(hidden: boolean): void {
    if (this.root) {
      this.root.classList.toggle("is-recapturing", hidden);
    }
    const toast = document.getElementById(TOAST_ID);
    if (toast) {
      toast.style.visibility = hidden ? "hidden" : "";
    }
  }

  private async captureVisibleTab(): Promise<boolean> {
    this.setCaptureOverlayHidden(true);
    await waitForRepaint();

    try {
      const response = (await chrome.runtime.sendMessage({
        type: "CAPTURE_TAB",
      })) as CaptureResponse;

      return await this.applyCapture(response);
    } finally {
      this.setCaptureOverlayHidden(false);
    }
  }

  private async applyCapture(response: CaptureResponse): Promise<boolean> {
    if (!response?.dataUrl) {
      return false;
    }

    const decoded = await this.decodeCaptureToCanvas(response.dataUrl);
    if (!decoded) {
      return false;
    }

    this.updateCaptureMetrics(decoded.width, decoded.height);
    return true;
  }

  /**
   * Decode the tab capture without color-space conversion so sampled bytes match
   * what Chromium rendered. Loading via HTMLImageElement can shift values.
   */
  private async decodeCaptureToCanvas(
    dataUrl: string
  ): Promise<{ width: number; height: number } | null> {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const bitmap = await createImageBitmap(blob, {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
      });

      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d", {
          willReadFrequently: true,
          colorSpace: "srgb",
        });
      }

      if (!this.ctx) {
        bitmap.close();
        return null;
      }

      this.canvas.width = bitmap.width;
      this.canvas.height = bitmap.height;
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      return { width: this.canvas.width, height: this.canvas.height };
    } catch {
      return null;
    }
  }

  private async refreshCapture(): Promise<void> {
    if (!this.active) {
      return;
    }

    if (this.capturePending) {
      this.scrollCapturePending = true;
      return;
    }

    this.capturePending = true;
    try {
      if (!this.active) {
        return;
      }
      await this.captureVisibleTab();
    } catch {
      /* keep the previous capture if refresh fails */
    } finally {
      this.capturePending = false;
      if (this.scrollCapturePending) {
        this.scrollCapturePending = false;
        void this.refreshCapture();
      }
    }
  }

  stop(reason: PickerCloseReason = "cancel"): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    cancelAnimationFrame(this.rafId);
    window.clearTimeout(this.scrollCaptureTimer);
    this.scrollCaptureTimer = 0;
    this.scrollCapturePending = false;
    document.removeEventListener("keydown", this.onKeyDown, true);
    document.removeEventListener("scroll", this.onScroll, true);
    window.visualViewport?.removeEventListener("resize", this.onScroll);
    window.visualViewport?.removeEventListener("scroll", this.onScroll);
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
    this.onClose?.({
      reason,
      hex: reason === "pick" ? (this.lastPickedHex ?? undefined) : undefined,
    });
    this.lastPickedHex = null;
  }

  private mount(): void {
    this.root = document.createElement("div");
    this.root.id = PICKER_ID;
    this.root.className = "pickhue-picker";
    this.root.dataset.theme = this.uiTheme;

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

    const hex = this.resolveColorAt(this.pointerX, this.pointerY);
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
        ? "<b>+</b>/<b>&minus;</b> to zoom &middot; <b>Click</b> to pick &middot; <b>Esc</b> to close"
        : `<b>+</b>/<b>&minus;</b> to zoom &middot; <b>${zoomPct}%</b> &middot; <b>Click</b> to pick &middot; <b>Esc</b> to close`;
  }

  private handleClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    if (!this.hasPointer) {
      return;
    }

    const hex = this.resolveColorAt(event.clientX, event.clientY);
    if (!hex) {
      return;
    }

    // Everything here is synchronous so the clipboard write stays inside the
    // user-gesture (an awaited navigator.clipboard call silently fails in
    // content scripts when the document isn't focused).
    const formatted = formatColor(hex, this.colorFormat);
    copyText(formatted);
    chrome.runtime.sendMessage({ type: "COLOR_PICKED", hex });
    this.lastPickedHex = hex;
    this.stop("pick");
    showCopyToast(formatted, hex);
  };

  private drawLens(): void {
    const lensCtx = this.lensCtx;
    if (!lensCtx || !this.ctx) {
      return;
    }

    const { x: px, y: py } = this.clientToCanvas(this.pointerX, this.pointerY);
    const center = (SAMPLE - 1) / 2;
    const cell = LOUPE_SIZE / SAMPLE;
    const resolved = this.resolveColorAt(this.pointerX, this.pointerY);

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

    // When DOM probing finds the authoritative CSS color, paint the reticle cell
    // to match what will be copied (DevTools parity on solid fills and text).
    if (resolved) {
      const centerCol = Math.floor(center);
      const centerRow = Math.floor(center);
      lensCtx.fillStyle = resolved;
      lensCtx.fillRect(
        Math.floor(centerCol * cell),
        Math.floor(centerRow * cell),
        Math.ceil(cell),
        Math.ceil(cell)
      );
    }
  }

  /**
   * Resolve the picked color: prefer computed CSS when it matches DevTools
   * (solid backgrounds and text), otherwise fall back to the captured pixel.
   */
  private resolveColorAt(clientX: number, clientY: number): string | null {
    const bitmapHex = this.sampleBitmapAt(clientX, clientY);
    const domHex = probeDomColor(clientX, clientY);

    if (domHex) {
      if (
        !bitmapHex ||
        colorDistanceSq(domHex, bitmapHex) <= DOM_BITMAP_MAX_DISTANCE_SQ
      ) {
        return domHex;
      }
    }

    return bitmapHex;
  }

  private sampleBitmapAt(x: number, y: number): string | null {
    const { x: px, y: py } = this.clientToCanvas(x, y);
    return this.readHex(px, py);
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
}

export function showCopyToast(formatted: string, hex: string): void {
  void showCopyToastAsync(formatted, hex);
}

async function showCopyToastAsync(formatted: string, hex: string): Promise<void> {
  let toast = document.getElementById(TOAST_ID) as HTMLDivElement | null;

  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "pickhue-copy-toast";
    document.documentElement.append(toast);
  }

  toastPaletteMenuOpen = false;
  clearToastHideTimers();

  const settings = await getSettings();
  toast.dataset.theme = resolveTheme(settings.themeMode);

  toast.innerHTML = `
    <span class="pickhue-copy-toast__swatch" style="background-color:${hex}"></span>
    <span class="pickhue-copy-toast__text">Copied ${formatted}</span>
    <button type="button" class="pickhue-copy-toast__save">Save to palette</button>
  `;
  toast.style.pointerEvents = "auto";

  const saveBtn = toast.querySelector<HTMLButtonElement>(
    ".pickhue-copy-toast__save"
  );
  saveBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    void openPickToastPaletteMenu(saveBtn, hex);
  });

  requestAnimationFrame(() => toast?.classList.add("is-visible"));
  scheduleToastHide(4000);
}

function clearToastHideTimers(): void {
  window.clearTimeout(toastHideTimer);
  window.clearTimeout(toastPointerTimer);
  toastHideTimer = 0;
  toastPointerTimer = 0;
}

function scheduleToastHide(delayMs: number): void {
  clearToastHideTimers();
  const toast = document.getElementById(TOAST_ID) as HTMLDivElement | null;
  if (!toast) {
    return;
  }

  toastHideTimer = window.setTimeout(() => {
    if (toastPaletteMenuOpen) {
      return;
    }
    toast.classList.remove("is-visible");
    toastPointerTimer = window.setTimeout(() => {
      toast.style.pointerEvents = "none";
    }, 220);
  }, delayMs);
}

async function openPickToastPaletteMenu(
  anchor: HTMLButtonElement,
  hex: string
): Promise<void> {
  const toast = document.getElementById(TOAST_ID) as HTMLDivElement | null;
  if (!toast) {
    return;
  }

  clearToastHideTimers();
  toastPaletteMenuOpen = true;
  toast.classList.add("is-visible");
  toast.style.pointerEvents = "auto";

  const openId = ++toastMenuOpenId;
  const palettes = await getPalettes();
  // Toast mounts on documentElement (not body), so use document.contains.
  if (
    openId !== toastMenuOpenId ||
    !document.getElementById(TOAST_ID) ||
    !document.contains(anchor)
  ) {
    toastPaletteMenuOpen = false;
    scheduleToastHide(2500);
    return;
  }

  let completed = false;

  showPaletteMenu(document, anchor, palettes, {
    onSelect: async (paletteId) => {
      completed = true;
      try {
        await addColorToPalette(paletteId, hex);
        showPaletteSavedToast(hex, "Saved to palette");
      } catch {
        showPaletteSavedToast(hex, "Could not save");
      }
    },
    onNewPalette: async () => {
      completed = true;
      try {
        await createPalette("Untitled palette", [hex]);
        showPaletteSavedToast(hex, "Created new palette");
      } catch {
        showPaletteSavedToast(hex, "Could not create palette");
      }
    },
    onClose: () => {
      if (openId !== toastMenuOpenId) {
        return;
      }
      toastPaletteMenuOpen = false;
      scheduleToastHide(completed ? 2000 : 2500);
    },
  });
}

function showPaletteSavedToast(hex: string, message: string): void {
  const toast = document.getElementById(TOAST_ID);
  if (!toast) {
    return;
  }
  toast.classList.add("is-visible");
  toast.style.pointerEvents = "auto";
  const text = toast.querySelector(".pickhue-copy-toast__text");
  const saveBtn = toast.querySelector(".pickhue-copy-toast__save");
  if (text) {
    text.textContent = message;
  }
  saveBtn?.remove();
  const swatch = toast.querySelector<HTMLElement>(
    ".pickhue-copy-toast__swatch"
  );
  if (swatch) {
    swatch.style.backgroundColor = hex;
  }
}
