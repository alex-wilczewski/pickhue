import { deriveAccentTokens, tintedOverlaySurface } from "../shared/accent";
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
/** Icon-only save action in the copy toast (label lives in aria-label/title). */
const TOAST_PLUS_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
const TOAST_CHECK_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 13l4 4L19 7" transform="translate(0 -0.63)" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
let lastToastHex: string | null = null;
const TOAST_ID = "pickhue-copy-toast";
let toastHideTimer = 0;
let toastPointerTimer = 0;
let toastPaletteMenuOpen = false;
let toastMenuOpenId = 0;
const LOUPE_SIZE = 144;
const LOUPE_INFO_HEIGHT = 32;
const LOUPE_INFO_GAP = 8;
const LOUPE_EDGE_PAD = 8;
const SAMPLE = 11;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.75;
const ZOOM_DEFAULT = 1;
const ZOOM_STEP = 0.1;
/** S cycles through these sample sizes (NxN screen-pixel average). */
const SAMPLE_SIZES = [1, 3, 5] as const;
const SCROLL_SETTLE_MS = 150;
/**
 * Chrome throttles tabs.captureVisibleTab to 2 calls/second and silently
 * rejects the rest, so stay just under it.
 */
const MIN_CAPTURE_INTERVAL_MS = 520;
/** If DOM and bitmap disagree beyond this, trust the rendered pixel. */
const DOM_BITMAP_MAX_DISTANCE_SQ = 55 * 55;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  private sampleSize: number = SAMPLE_SIZES[0];
  private reticleEl: HTMLDivElement | null = null;
  private infoEl: HTMLDivElement | null = null;
  private lastPickedHex: string | null = null;
  private hint: HTMLParagraphElement | null = null;
  private glassEl: HTMLDivElement | null = null;
  private zoomBadge: HTMLSpanElement | null = null;
  private accentPick: string | null = null;
  private capturePending = false;
  private scrollCapturePending = false;
  private scrollCaptureTimer = 0;
  /** Timestamp of the last capture, for the 2/second throttle. */
  private lastCaptureAt = 0;
  // Bumped whenever a new screenshot lands, so a recapture (or the capture that
  // races the overlay open) repaints even if the pointer never moved.
  private captureGeneration = 0;
  // Signature of the last frame actually drawn; identical signature => no work.
  private lastRenderKey = "";
  private themeListenerAttached = false;

  private readonly onThemeStorageChange = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string
  ): void => {
    if (area !== "sync" || !changes.pickhue_settings) {
      return;
    }
    void getSettings().then((settings) => {
      const theme = resolveTheme(settings.themeMode);
      this.uiTheme = theme;
      this.colorFormat = settings.colorFormat;
      if (this.root) {
        this.root.dataset.theme = theme;
      }
      const toast = document.getElementById(TOAST_ID);
      if (toast) {
        toast.dataset.theme = theme;
      }
      this.applyOverlayAccents();
      this.updateHint();
    });
  };

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
      return;
    }

    if (event.key === "s" || event.key === "S") {
      event.preventDefault();
      event.stopPropagation();
      const index = SAMPLE_SIZES.indexOf(this.sampleSize as 1 | 3 | 5);
      this.sampleSize = SAMPLE_SIZES[(index + 1) % SAMPLE_SIZES.length]!;
      this.updateZoomBadge();
      this.updateReticleSize();
      return;
    }

    if (event.key === "Enter" && this.hasPointer) {
      event.preventDefault();
      event.stopPropagation();
      this.pickAt(this.pointerX, this.pointerY);
      return;
    }

    // Pixel nudge for precise picks (Shift = 10px). The render loop follows
    // pointerX/Y, so moving the virtual pointer is all it takes.
    const step = event.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const delta = nudge[event.key];
    if (delta && this.hasPointer) {
      event.preventDefault();
      event.stopPropagation();
      const viewport = window.visualViewport;
      const maxX = (viewport?.width ?? window.innerWidth) - 1;
      const maxY = (viewport?.height ?? window.innerHeight) - 1;
      this.pointerX = Math.min(maxX, Math.max(0, this.pointerX + delta[0]));
      this.pointerY = Math.min(maxY, Math.max(0, this.pointerY + delta[1]));
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
    this.updateZoomBadge();
    this.updateReticleSize();
  }

  /* One status badge carries both non-default states: "3×3 · 120%". */
  private updateZoomBadge(): void {
    if (!this.zoomBadge) {
      return;
    }
    const parts: string[] = [];
    if (this.sampleSize > 1) {
      parts.push(`${this.sampleSize}×${this.sampleSize}`);
    }
    const pct = Math.round(this.zoom * 100);
    if (pct !== 100) {
      parts.push(`${pct}%`);
    }
    this.zoomBadge.textContent = parts.join(" · ");
    this.zoomBadge.classList.toggle("is-visible", parts.length > 0);
  }

  /** The reticle grows to cover exactly the pixels being averaged. */
  private updateReticleSize(): void {
    if (!this.reticleEl) {
      return;
    }
    const cell = (LOUPE_SIZE / SAMPLE) * this.zoom;
    const size = Math.min(LOUPE_SIZE, cell * this.sampleSize);
    this.reticleEl.style.width = `${size}px`;
    this.reticleEl.style.height = `${size}px`;
  }

  private onScroll = (): void => {
    if (!this.active) {
      return;
    }

    // The capture is stale the instant the page moves, so the loupe is showing
    // pixels that are no longer under the cursor. Step it aside for the whole
    // scroll instead of letting it display a lie and then blink once at the
    // end: it leaves as the page starts moving and fades back in refocused.
    // The overlay being hidden already is also why the capture below can fire
    // immediately once scrolling settles.
    this.setCaptureOverlayHidden(true);

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

    // Fire the capture immediately and mount the overlay while it's in
    // flight — the cursor swap and hint appear instantly instead of waiting
    // out the screenshot round-trip; the loupe fades in when pixels arrive.
    const capturePromise = chrome.runtime.sendMessage({
      type: "CAPTURE_TAB",
    }) as Promise<CaptureResponse>;

    const settings = await getSettings();
    this.colorFormat = settings.colorFormat;
    this.uiTheme = resolveTheme(settings.themeMode);
    this.accentPick = settings.recentColors[0] ?? null;

    this.active = true;
    this.hasPointer = false;
    this.zoom = ZOOM_DEFAULT;
    this.sampleSize = SAMPLE_SIZES[0];
    this.mount();
    this.attachThemeListener();
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

    if (!(await this.applyCapture(await capturePromise))) {
      this.stop("cancel");
    }
  }

  private attachThemeListener(): void {
    if (this.themeListenerAttached) {
      return;
    }
    chrome.storage.onChanged.addListener(this.onThemeStorageChange);
    this.themeListenerAttached = true;
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

    // Chrome caps captureVisibleTab at MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND
    // (2). Stop-start scrolling clears that bar easily, and a rejected capture
    // fails silently — the loupe just keeps showing stale pixels. Space the
    // calls out instead; the wait happens while the overlay is already hidden,
    // so it reads as the lens refocusing rather than as a stall.
    const sinceLast = Date.now() - this.lastCaptureAt;
    if (sinceLast < MIN_CAPTURE_INTERVAL_MS) {
      await sleep(MIN_CAPTURE_INTERVAL_MS - sinceLast);
      if (!this.active) {
        return false;
      }
    }
    this.lastCaptureAt = Date.now();

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
    this.captureGeneration += 1;
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
    syncToastAboveHint();
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
    this.reticleEl = reticle;

    this.zoomBadge = document.createElement("span");
    this.zoomBadge.className = "pickhue-loupe__zoom";

    glass.append(lens, reticle, this.zoomBadge);
    this.glassEl = glass;

    const info = document.createElement("div");
    info.className = "pickhue-loupe__info";
    this.infoEl = info;

    this.swatchDot = document.createElement("span");
    this.swatchDot.className = "pickhue-loupe__dot";

    this.hexLabel = document.createElement("span");
    this.hexLabel.className = "pickhue-loupe__hex";
    this.hexLabel.textContent = "#------";

    info.append(this.swatchDot, this.hexLabel);
    // Glass stays centered on the cursor; the color chip is absolutely
    // positioned above (or below near the top edge) so it never clips.
    this.loupe.append(glass, info);

    this.hint = document.createElement("p");
    this.hint.className = "pickhue-picker__hint";
    this.updateHint();

    this.root.append(this.loupe, this.hint);
    this.applyOverlayAccents();
    this.updateZoomBadge();
    this.updateReticleSize();
    document.documentElement.append(this.root);
    syncToastAboveHint();

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

    // Skip the frame when nothing that affects the loupe has changed. Without
    // this the picker re-probes the DOM and re-reads the capture 60x a second
    // with the cursor sitting still, which is what makes pages with playing
    // media stutter while the picker is open. Every input the render depends on
    // is in the key: pointer position (glass, edge clipping, chip shift), zoom,
    // sample size (averaging + reticle), and the capture generation.
    const key = this.hasPointer
      ? `${this.pointerX},${this.pointerY},${this.zoom},${this.sampleSize},${this.captureGeneration},${this.colorFormat}`
      : "idle";
    if (key !== this.lastRenderKey) {
      this.lastRenderKey = key;
      this.update();
    }

    this.rafId = requestAnimationFrame(this.renderLoop);
  };

  private update(): void {
    if (!this.loupe) {
      return;
    }

    if (!this.hasPointer || !this.ctx) {
      this.loupe.style.opacity = "0";
      return;
    }

    // Center the loupe glass on the pointer so the magnified center pixel is
    // exactly the pixel that will be picked (cursor is hidden via CSS). The
    // glass is NOT clamped to the viewport — at the edges it clips like a
    // physical lens, keeping the reticle on the exact edge pixel.
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
    const viewportTop = window.visualViewport?.offsetTop ?? 0;

    const tx = Math.round(this.pointerX - LOUPE_SIZE / 2);
    const ty = Math.round(this.pointerY - LOUPE_SIZE / 2);

    // Prefer the color chip above the loupe; flip below when near the top.
    const spaceAbove = ty - viewportTop;
    const needsBelow =
      spaceAbove < LOUPE_INFO_HEIGHT + LOUPE_INFO_GAP + LOUPE_EDGE_PAD;
    this.loupe.classList.toggle("is-info-below", needsBelow);

    // The chip carries the value, so it alone stays inside the viewport:
    // shift it horizontally off-center as the glass clips at the sides.
    if (this.infoEl) {
      const chipWidth = this.infoEl.offsetWidth;
      const center = tx + LOUPE_SIZE / 2;
      const minCenter = viewportLeft + chipWidth / 2 + LOUPE_EDGE_PAD;
      const maxCenter =
        viewportLeft + viewportWidth - chipWidth / 2 - LOUPE_EDGE_PAD;
      const shift =
        Math.min(Math.max(center, minCenter), Math.max(minCenter, maxCenter)) -
        center;
      this.infoEl.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`;
    }

    this.loupe.style.transform = `translate(${tx}px, ${ty}px)`;
    this.loupe.style.opacity = "1";

    // drawLens already resolved the colour under the crosshair — reuse it
    // instead of running the DOM probe (or the area average) twice this frame.
    const hex = this.drawLens();
    if (hex && this.hexLabel && this.swatchDot) {
      this.hexLabel.textContent = formatColor(hex, this.colorFormat);
      this.swatchDot.style.backgroundColor = hex;
      // The glass ring previews the hovered color (see picker.css --pickhue-ring).
      this.glassEl?.style.setProperty("--pickhue-ring", hex);
    }
  }

  /** Hint accent + tinted surfaces derive from the most recent pick. */
  private applyOverlayAccents(): void {
    if (!this.root) {
      return;
    }
    const tokens = deriveAccentTokens(this.accentPick, this.uiTheme);
    this.root.style.setProperty("--pickhue-accent-link", tokens.accentLink);
    this.root.style.setProperty(
      "--pickhue-surface",
      tintedOverlaySurface(this.accentPick, this.uiTheme)
    );
  }

  private updateHint(): void {
    if (!this.hint) {
      return;
    }
    this.hint.innerHTML =
      "<b>+</b>/<b>&minus;</b> to zoom &middot; <b>Click</b> to pick &middot; <b>Esc</b> to close";
  }

  private handleClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    if (!this.hasPointer) {
      return;
    }
    this.pickAt(event.clientX, event.clientY);
  };

  private pickAt(clientX: number, clientY: number): void {
    const hex = this.resolveColorAt(clientX, clientY);
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
  }

  private drawLens(): string | null {
    const lensCtx = this.lensCtx;
    if (!lensCtx || !this.ctx) {
      return null;
    }

    const { x: px, y: py } = this.clientToCanvas(this.pointerX, this.pointerY);
    const center = (SAMPLE - 1) / 2;
    const cell = LOUPE_SIZE / SAMPLE;
    const resolved = this.resolveColorAt(this.pointerX, this.pointerY);

    lensCtx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    lensCtx.imageSmoothingEnabled = this.zoom < 1;

    // Read the whole magnified neighbourhood in one getImageData rather than
    // one per cell: 121 GPU->CPU readbacks a frame was the other half of the
    // stall. Offsets below stay inside this block by construction.
    const minOffset = Math.round((0 - center) / this.zoom);
    const maxOffset = Math.round((SAMPLE - 1 - center) / this.zoom);
    const blockAt = this.readBlock(
      px + minOffset,
      py + minOffset,
      maxOffset - minOffset + 1
    );

    for (let row = 0; row < SAMPLE; row += 1) {
      for (let col = 0; col < SAMPLE; col += 1) {
        const offsetX = Math.round((col - center) / this.zoom);
        const offsetY = Math.round((row - center) / this.zoom);
        const hex = blockAt(px + offsetX, py + offsetY);
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

    return resolved;
  }

  /**
   * Grab a square of captured pixels in a single readback and return a lookup
   * in canvas coordinates. Out-of-bounds reads yield null, matching readHex, so
   * the lens still clips correctly at the edges of the capture.
   */
  private readBlock(
    originX: number,
    originY: number,
    size: number
  ): (x: number, y: number) => string | null {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) {
      return () => null;
    }

    const x0 = Math.max(0, originX);
    const y0 = Math.max(0, originY);
    const x1 = Math.min(canvas.width, originX + size);
    const y1 = Math.min(canvas.height, originY + size);
    if (x1 <= x0 || y1 <= y0) {
      return () => null;
    }

    const width = x1 - x0;
    const { data } = ctx.getImageData(x0, y0, width, y1 - y0);
    const toHex = (value: number) => value.toString(16).padStart(2, "0");

    return (x: number, y: number): string | null => {
      if (x < x0 || y < y0 || x >= x1 || y >= y1) {
        return null;
      }
      const i = ((y - y0) * width + (x - x0)) * 4;
      return `#${toHex(data[i]!)}${toHex(data[i + 1]!)}${toHex(
        data[i + 2]!
      )}`.toUpperCase();
    };
  }

  /**
   * Resolve the picked color: prefer computed CSS when it matches DevTools
   * (solid backgrounds and text), otherwise fall back to the captured pixel.
   */
  private resolveColorAt(clientX: number, clientY: number): string | null {
    // Area averaging is a bitmap operation — the DOM probe answers a different
    // question (one element's own color), so it only applies at 1×1.
    if (this.sampleSize > 1) {
      return this.sampleAverageAt(clientX, clientY, this.sampleSize);
    }

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

  /** Average of an NxN screen-pixel block centered on the point. */
  private sampleAverageAt(
    clientX: number,
    clientY: number,
    size: number
  ): string | null {
    if (!this.ctx || !this.canvas) {
      return null;
    }
    const { x: cx, y: cy } = this.clientToCanvas(clientX, clientY);
    const w = Math.max(1, Math.round(size * this.scaleX));
    const h = Math.max(1, Math.round(size * this.scaleY));
    const x0 = Math.max(0, Math.min(this.canvas.width - 1, cx - Math.floor(w / 2)));
    const y0 = Math.max(0, Math.min(this.canvas.height - 1, cy - Math.floor(h / 2)));
    const cw = Math.min(w, this.canvas.width - x0);
    const ch = Math.min(h, this.canvas.height - y0);
    if (cw < 1 || ch < 1) {
      return null;
    }
    const data = this.ctx.getImageData(x0, y0, cw, ch).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const count = cw * ch;
    for (let i = 0; i < count; i += 1) {
      r += data[i * 4]!;
      g += data[i * 4 + 1]!;
      b += data[i * 4 + 2]!;
    }
    const toHex = (value: number): string =>
      Math.round(value / count).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
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

function syncOpenToastTheme(theme: "light" | "dark"): void {
  const toast = document.getElementById(TOAST_ID);
  if (toast) {
    toast.dataset.theme = theme;
    applyToastAccent(toast, theme);
  }
  document
    .querySelectorAll<HTMLElement>(".palette-menu--toast")
    .forEach((menu) => {
      menu.dataset.theme = theme;
      applyToastAccent(menu, theme);
    });
}

/** Tint the toast/menu surface + accent link from the just-picked color. */
function applyToastAccent(el: HTMLElement, theme: "light" | "dark"): void {
  const tokens = deriveAccentTokens(lastToastHex, theme);
  el.style.setProperty("--pickhue-accent-link", tokens.accentLink);
  el.style.setProperty(
    "--pickhue-surface",
    tintedOverlaySurface(lastToastHex, theme)
  );
}

async function showCopyToastAsync(formatted: string, hex: string): Promise<void> {
  let toast = document.getElementById(TOAST_ID) as HTMLDivElement | null;

  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "pickhue-copy-toast";
    document.documentElement.append(toast);

    // Hovering holds the toast open so the save action can't vanish mid-reach.
    toast.addEventListener("mouseenter", () => {
      if (toast?.classList.contains("is-visible")) {
        clearToastHideTimers();
      }
    });
    toast.addEventListener("mouseleave", () => {
      if (toast?.classList.contains("is-visible") && !toastPaletteMenuOpen) {
        scheduleToastHide(1200);
      }
    });
  }

  toastPaletteMenuOpen = false;
  clearToastHideTimers();

  const settings = await getSettings();
  const theme = resolveTheme(settings.themeMode);
  toast.dataset.theme = theme;
  lastToastHex = hex;
  syncOpenToastTheme(theme);

  toast.innerHTML = `
    <span class="pickhue-copy-toast__swatch" style="background-color:${hex}"></span>
    <span class="pickhue-copy-toast__text">Copied ${formatted}</span>
    <button type="button" class="pickhue-copy-toast__save pickhue-copy-toast__save--icon" aria-label="Save to palette" title="Save to palette">${TOAST_PLUS_ICON}</button>
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
  syncToastAboveHint();
  scheduleToastHide(3000);
}

function syncToastAboveHint(): void {
  const toast = document.getElementById(TOAST_ID);
  if (!toast) {
    return;
  }
  toast.classList.toggle(
    "is-above-hint",
    Boolean(document.getElementById(PICKER_ID))
  );
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
      const name = palettes.find((p) => p.id === paletteId)?.name;
      try {
        await addColorToPalette(paletteId, hex);
        showPaletteSavedToast(hex, name ? `Added to ${name}` : "Added to palette", true);
      } catch {
        showPaletteSavedToast(hex, "Could not save");
      }
    },
    onNewPalette: async () => {
      completed = true;
      try {
        await createPalette("Untitled palette", [hex]);
        showPaletteSavedToast(hex, "Created new palette", true);
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

function showPaletteSavedToast(
  hex: string,
  message: string,
  saved = false
): void {
  const toast = document.getElementById(TOAST_ID);
  if (!toast) {
    return;
  }
  toast.classList.add("is-visible");
  toast.style.pointerEvents = "auto";
  const text = toast.querySelector(".pickhue-copy-toast__text");
  const saveBtn = toast.querySelector<HTMLButtonElement>(
    ".pickhue-copy-toast__save"
  );
  if (text) {
    text.textContent = message;
  }
  if (saveBtn) {
    if (saved) {
      // Morph + into a check: confirmation without a second toast.
      saveBtn.innerHTML = TOAST_CHECK_ICON;
      saveBtn.classList.add("is-saved");
      saveBtn.setAttribute("aria-label", "Saved");
      saveBtn.title = "";
      saveBtn.disabled = true;
    } else {
      saveBtn.remove();
    }
  }
  const swatch = toast.querySelector<HTMLElement>(
    ".pickhue-copy-toast__swatch"
  );
  if (swatch) {
    swatch.style.backgroundColor = hex;
  }
}
