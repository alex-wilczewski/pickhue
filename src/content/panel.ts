import panelCss from "./panel.css?inline";
import { CANCEL_ACTION_ICON_HTML, DELETE_BUTTON_HTML, DELETE_ICON_HTML, ELLIPSIS_ICON_HTML, EXPORT_BACKUP_ICON_HTML, EXPORT_CODE_ICON_HTML, EXPORT_FILE_ICON_HTML, EXPORT_ICON_HTML, EXPORT_LIST_ICON_HTML, IMPORT_ICON_HTML, MOVE_ICON_HTML, PLUS_ICON_HTML, REMOVE_SWATCH_ICON_HTML, RENAME_ICON_HTML, SPARKLE_ICON_HTML } from "./icons";
import { EXPORT_TAILWIND_ICON_HTML } from "./icons";
import { extractPagePalette } from "./extract";
import { PaletteEditorView } from "./palette-editor";
import { dismissActiveMenu, showActionMenu, showSelectMenu } from "./palette-menu";
import { SwatchTooltipController } from "./swatch-tooltip";
import { bindSwatchTrack, syncTrackOverflow } from "./swatch-track";
import { copyText } from "../shared/clipboard";
import { COLOR_FORMATS, formatColor } from "../shared/colors";
import {
  exportPalettesAseFile,
  exportPalettesCss,
  exportPalettesHexList,
  exportPalettesTailwind,
  exportPaletteAseFile,
} from "../shared/palette-formats";
import { exportPalettes, importPalettes, importPalettesFromAse } from "../shared/palette-io";
import {
  addColorsToPalette,
  addRecentColor,
  createPalette,
  deletePalette,
  getPalettes,
  getSettings,
  removeRecentColor,
  reorderPalettes,
  saveSettings,
  StorageQuotaError,
} from "../shared/storage";
import { chromeTintTokens, deriveAccentTokens } from "../shared/accent";
import { resolveTheme } from "../shared/theme";
import type { ColorFormat, ColorPalette, Settings, ThemeMode } from "../shared/types";

const HOST_ID = "pickhue-panel-host";
const PANEL_STYLES_ID = "pickhue-panel-styles";
const CLOSE_ANIM_MS = 180;
const PALETTE_PREVIEW_COUNT = 4;

const FORMAT_OPTIONS = COLOR_FORMATS;

function formatLabel(format: ColorFormat): string {
  return FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? "HEX";
}

/** True when wheel should scroll an element inside the panel, not be blocked. */
function isInternallyScrollable(
  target: EventTarget | null,
  boundary: Element
): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  let el: Element | null = target;
  while (el && el !== boundary) {
    if (
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return true;
    }
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const canY =
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 1;
    const canX =
      (overflowX === "auto" || overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth + 1;
    if (canY || canX) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

/** Strip :host reset — it must not run against popup page roots. */
function panelCssForPage(css: string): string {
  return css.replace(/:host\s*\{[^}]*\}/, "");
}

const TEMPLATE = `
  <div class="panel" data-theme="dark">
    <header class="panel__header">
      <div class="panel__logo" aria-hidden="true">
        <svg class="panel__logo-mark" viewBox="0 0 14 21" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.91237e-07 8H5C5.55228 8 6 8.44772 6 9V15C6 18.3137 3.31371 21 1.91237e-07 21V8Z" fill="white"/>
          <path d="M2.05948e-07 6L0 1.625C-4.22469e-08 0.727538 0.783502 2.91663e-07 1.75 2.52433e-07L7.96923 0C11.2999 -1.3519e-07 14 2.50721 14 5.6C14 5.82091 13.8071 6 13.5692 6L2.05948e-07 6Z" fill="white"/>
          <path d="M14 8C14 11.3137 11.3137 14 8 14V9C8 8.44772 8.44772 8 9 8H14Z" fill="white"/>
        </svg>
      </div>
      <button class="panel__close" type="button" aria-label="Close PickHue" data-ref="close">
        <svg class="icon icon--close" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </header>

    <div class="panel__body" data-ref="body">
      <div class="panel__view panel__view--home" data-ref="home-view">
        <section class="panel__section panel__section--recent">
          <div class="panel__section-head">
            <h2 class="panel__label">Recent Colors</h2>
            <span class="panel__section-actions">
              <button type="button" class="panel__section-action panel__section-action--icon panel__section-action--clear" data-ref="clear-recents" aria-label="Clear recent colors" hidden>${DELETE_ICON_HTML}</button>
              <button type="button" class="panel__section-action panel__section-action--icon" data-ref="select-mode-toggle" aria-label="Save to palette" hidden>${PLUS_ICON_HTML}</button>
            </span>
          </div>
          <div class="panel__swatches-wrap">
            <button
              type="button"
              class="panel__swatches-empty"
              data-ref="empty"
              aria-label="Select Color"
            >
              Colors you select go here.
            </button>
            <div class="panel__swatches" role="list" data-ref="scroller">
              <div class="panel__swatches-inner" data-ref="track"></div>
            </div>
          </div>
        </section>

        <section class="panel__section panel__section--palettes">
          <div class="panel__section-head">
            <h2 class="panel__label">Saved Palettes</h2>
            <span class="panel__section-actions">
              <button type="button" class="panel__section-action panel__section-action--icon" data-ref="extract-page" aria-label="New palette from this page">${SPARKLE_ICON_HTML}</button>
              <button type="button" class="panel__section-action panel__section-action--icon" data-ref="new-palette" aria-label="New palette">${PLUS_ICON_HTML}</button>
            </span>
          </div>
          <div class="panel__palettes-wrap" data-ref="palette-list-wrap">
            <div class="panel__palettes" data-ref="palette-list"></div>
          </div>
        </section>

        <section class="panel__section panel__section--settings">
          <h2 class="panel__label">Extension Settings</h2>

          <div class="panel__setting">
            <span class="panel__setting-label">Theme</span>
            <div class="theme-switcher" role="radiogroup" aria-label="Theme" data-ref="theme-switcher">
              <button type="button" class="theme-switcher__btn" data-theme-mode="system" role="radio" aria-checked="false" aria-label="System theme">
                <svg class="icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <rect x="4" y="6" width="16" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                  <path d="M9 19h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <button type="button" class="theme-switcher__btn" data-theme-mode="light" role="radio" aria-checked="false" aria-label="Light theme">
                <svg class="icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" fill="none"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <button type="button" class="theme-switcher__btn" data-theme-mode="dark" role="radio" aria-checked="false" aria-label="Dark theme">
                <svg class="icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="panel__setting">
            <span class="panel__setting-label">Palettes</span>
            <div class="panel__setting-actions">
              <button type="button" class="panel__palette-btn panel__palette-btn--icon" aria-label="Export All" data-ref="export-palettes">${EXPORT_ICON_HTML}</button>
              <button type="button" class="panel__palette-btn panel__palette-btn--icon" aria-label="Import" data-ref="import-palettes">${IMPORT_ICON_HTML}</button>
            </div>
          </div>

          <div class="panel__setting">
            <span class="panel__setting-label">Shortcut</span>
            <button type="button" class="panel__shortcut-btn" data-ref="shortcut" aria-label="Change eyedropper shortcut">
              <span data-ref="shortcut-value">Eyedropper</span>
            </button>
          </div>

          <div class="panel__setting">
            <span class="panel__setting-label">Format</span>
            <div class="format-select">
              <button type="button" class="format-select__control" aria-label="Color format" aria-haspopup="listbox" aria-expanded="false" data-ref="format-select">
                <span class="format-select__value" data-ref="format-select-value">HEX</span>
                <svg class="format-select__chevron" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div class="panel__view panel__view--editor" data-ref="editor-view" hidden>
        <div data-ref="editor-container"></div>
      </div>
    </div>

    <footer class="panel__footer">
      <button class="panel__cta" type="button" data-ref="select-color">Select Color</button>
    </footer>

    <div class="panel__import" data-ref="import-dialog" hidden>
      <div class="panel__import-dialog" role="dialog" aria-label="Import palettes">
        <p class="panel__import-title">Import palettes</p>
        <p class="panel__import-hint">Adobe .ase, CSS variables, hex list, or PickHue JSON</p>
        <label class="panel__import-file">
          <input type="file" accept=".ase,.css,.json,text/plain" data-ref="import-file" hidden>
          <span class="panel__file-btn">
            <svg class="icon panel__file-btn-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M12 15V5m0 0-4 4m4-4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <path d="M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
              <path d="M5 19a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
            </svg>
            Choose File
          </span>
        </label>
        <textarea class="panel__import-input" data-ref="import-input" rows="4" placeholder="Or paste palette data here"></textarea>
        <div class="panel__import-actions">
          <button type="button" class="panel__modal-btn" data-ref="import-cancel">Cancel</button>
          <button type="button" class="panel__modal-btn" data-ref="import-merge">Merge</button>
          <button type="button" class="panel__modal-btn panel__modal-btn--accent" data-ref="import-replace">Replace</button>
        </div>
      </div>
    </div>

    <div class="panel__import panel__extract" data-ref="extract-dialog" hidden>
      <div class="panel__import-dialog" role="dialog" aria-label="Palette from this page">
        <p class="panel__import-title">Palette from this page</p>
        <p class="panel__import-hint" data-ref="extract-hint">Tap a swatch to leave it out.</p>
        <div class="panel__extract-groups" data-ref="extract-groups"></div>
        <input type="text" class="panel__extract-name" data-ref="extract-name" maxlength="48" placeholder="Palette name" aria-label="Palette name">
        <div class="panel__import-actions">
          <button type="button" class="panel__modal-btn" data-ref="extract-cancel">Cancel</button>
          <button type="button" class="panel__modal-btn panel__modal-btn--accent" data-ref="extract-save">Save palette</button>
        </div>
      </div>
    </div>

    <div class="toast" role="status" aria-live="polite" data-ref="toast" hidden>
      <span class="toast__swatch" data-ref="toast-swatch"></span>
      <span class="toast__text" data-ref="toast-text">Copied</span>
      <button type="button" class="toast__action" data-ref="toast-action" hidden></button>
    </div>
  </div>
`;

type HostContext = "content-script" | "extension-page";
type PanelView = "home" | "editor";

export interface StartPickerOptions {
  paletteId?: string;
}

interface PanelOptions {
  hostContext?: HostContext;
  onStartPicker: (options?: StartPickerOptions) => void;
}

export class PanelController {
  private readonly hostContext: HostContext;
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private panelEl: HTMLElement | null = null;
  private formatMenuDismiss: (() => void) | null = null;
  private closeTimer = 0;
  private toastTimer = 0;
  private toastAction: (() => void) | null = null;
  private settings: Settings = {
    themeMode: "system",
    colorFormat: "hex",
    recentColors: [],
  };
  private palettes: ColorPalette[] = [];
  private hadRecentColors = false;
  private view: PanelView = "home";
  private selectionMode = false;
  private selectedPaletteId: string | null = null;
  private moveModePaletteId: string | null = null;
  private paletteDragIndex = -1;
  private paletteInsertSlot = -1;
  private paletteDropHandled = false;
  private readonly selectedRecents = new Set<string>();
  private editor: PaletteEditorView | null = null;
  private swatchTooltip: SwatchTooltipController | null = null;
  private reopenEditorAfterPick = false;
  private hostResizeObserver: ResizeObserver | null = null;
  private readonly systemThemeQuery = window.matchMedia(
    "(prefers-color-scheme: dark)"
  );
  private readonly onSystemThemeChange = (): void => {
    if (this.settings.themeMode === "system" && this.isOpen) {
      this.applyResolvedTheme();
    }
  };
  private escapeListenerAttached = false;
  private readonly onEditorEnterKey = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || !this.isOpen || this.view !== "editor") {
      return;
    }
    if (
      this.getRoot().querySelector(
        ".palette-editor__confirm-overlay, .palette-editor__recents-overlay"
      )
    ) {
      return;
    }

    const active = this.getFocusedElement();
    const root = this.getRoot();
    const focusedInPanel =
      active instanceof Node &&
      (root instanceof ShadowRoot
        ? root.contains(active)
        : this.panelEl?.contains(active));

    if (!active || !focusedInPanel) {
      return;
    }

    if (active.classList.contains("palette-editor__paste-input")) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (active.classList.contains("palette-editor__name")) {
      void this.editor?.commitTitle();
    }
  };
  private readonly onEscapeKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.isOpen) {
      return;
    }
    // A menu is always the topmost layer — peel it before anything else, so
    // Escape never closes the whole panel out from under an open dropdown.
    if (dismissActiveMenu()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.ref<HTMLElement>("import-dialog")?.hidden === false) {
      event.preventDefault();
      event.stopPropagation();
      this.hideImportDialog();
      return;
    }
    if (this.ref<HTMLElement>("extract-dialog")?.hidden === false) {
      event.preventDefault();
      event.stopPropagation();
      this.hideExtractDialog();
      return;
    }
    const saveConfirm = this.getRoot().querySelector(
      ".panel__save-palette-confirm-overlay"
    );
    if (saveConfirm) {
      event.preventDefault();
      event.stopPropagation();
      this.dismissSavePaletteConfirm();
      return;
    }
    if (this.view === "editor") {
      const editorOverlay = this.getRoot().querySelector(
        ".palette-editor__confirm-overlay, .palette-editor__recents-overlay"
      );
      if (editorOverlay) {
        event.preventDefault();
        event.stopPropagation();
        editorOverlay.remove();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void this.editor?.handleBack();
      return;
    }
    const homeConfirmOverlay = this.getRoot().querySelector(
      ".palette-editor__confirm-overlay"
    );
    if (homeConfirmOverlay) {
      event.preventDefault();
      event.stopPropagation();
      homeConfirmOverlay.remove();
      return;
    }
    if (this.selectionMode) {
      event.preventDefault();
      event.stopPropagation();
      this.setSelectionMode(false);
      return;
    }
    if (this.moveModePaletteId) {
      event.preventDefault();
      event.stopPropagation();
      this.setMoveMode(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.hide();
  };

  constructor(private readonly options: PanelOptions) {
    this.hostContext = options.hostContext ?? "content-script";
    this.systemThemeQuery.addEventListener("change", this.onSystemThemeChange);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") {
        return;
      }
      void (async () => {
        const settingsChanged = Boolean(changes.pickhue_settings);
        const palettesChanged = Boolean(changes.pickhue_palettes);
        if (!settingsChanged && !palettesChanged) {
          return;
        }

        const previousLength = this.settings.recentColors.length;
        if (settingsChanged) {
          this.settings = await getSettings();
        }
        if (palettesChanged) {
          this.palettes = await getPalettes();
        }

        if (!this.isOpen) {
          return;
        }

        if (settingsChanged) {
          this.renderSettings();
          this.renderRecentColors(
            previousLength === 0 && this.settings.recentColors.length > 0
          );
        }
        if (palettesChanged) {
          this.renderPalettes();
          if (this.view === "editor") {
            await this.editor?.refreshFromStorage();
          }
        }
      })();
    });
  }

  get isOpen(): boolean {
    if (this.hostContext === "extension-page") {
      return this.panelEl !== null;
    }
    return (
      this.host !== null &&
      this.closeTimer === 0 &&
      this.host.style.display !== "none"
    );
  }

  async toggle(): Promise<void> {
    if (this.isOpen) {
      this.hide();
    } else {
      await this.show();
    }
  }

  async show(): Promise<void> {
    if (this.closeTimer) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = 0;
    }
    await this.refreshData();

    if (this.host) {
      this.host.style.display = "block";
      if (this.reopenEditorAfterPick) {
        this.reopenEditorAfterPick = false;
        this.showView("editor");
        await this.editor?.refreshFromStorage();
      } else {
        this.renderAll();
      }
      this.attachEscapeListener();
      requestAnimationFrame(() => {
        this.panelEl?.classList.add("is-open");
        this.scheduleHostSize();
      });
      return;
    }

    this.mount();
    this.renderAll();
    this.attachEscapeListener();
    if (this.hostContext === "extension-page") {
      this.panelEl?.classList.add("is-open");
    } else {
      requestAnimationFrame(() => {
        this.panelEl?.classList.add("is-open");
        this.scheduleHostSize();
      });
    }
  }

  async handlePickedColorForPalette(hex: string, paletteId: string): Promise<void> {
    if (this.editor?.getPaletteId() === paletteId) {
      await this.editor.appendPickedColor(hex);
    } else {
      try {
        await addColorsToPalette(paletteId, [hex]);
        this.palettes = await getPalettes();
      } catch (error) {
        this.handleStorageError(error);
      }
    }
    this.reopenEditorAfterPick = true;
  }

  flashCtaMessage(message: string, durationMs = 2200): void {
    const button = this.ref<HTMLButtonElement>("select-color");
    if (!button) {
      return;
    }
    const original = button.textContent ?? "Select Color";
    button.textContent = message;
    window.setTimeout(() => {
      button.textContent = original;
      this.updateFooterCta();
    }, durationMs);
  }

  hide(): void {
    if (this.hostContext === "extension-page") {
      this.detachEscapeListener();
      window.close();
      return;
    }

    if (!this.host || this.closeTimer) {
      return;
    }
    this.detachEscapeListener();
    this.detachHostResizeObserver();
    this.setSelectionMode(false);
    this.panelEl?.classList.remove("is-open");
    const host = this.host;
    this.closeTimer = window.setTimeout(() => {
      host.remove();
      if (this.host === host) {
        this.host = null;
        this.shadow = null;
        this.panelEl = null;
        this.editor = null;
        this.disposeSwatchTooltip();
        this.view = "home";
      }
      this.closeTimer = 0;
    }, CLOSE_ANIM_MS);
  }

  hideImmediate(): void {
    if (this.hostContext === "extension-page") {
      this.detachEscapeListener();
      window.close();
      return;
    }

    this.detachEscapeListener();
    if (this.host) {
      this.host.style.display = "none";
    }
  }

  private async refreshData(): Promise<void> {
    this.settings = await getSettings();
    this.palettes = await getPalettes();
    this.hadRecentColors = this.settings.recentColors.length > 0;
  }

  private renderAll(): void {
    this.renderSettings();
    this.renderRecentColors();
    this.renderPalettes();
    this.updateSelectionToggle();
    this.updateFooterCta();
    if (this.view === "editor" && this.editor) {
      this.showView("editor");
    } else {
      this.showView("home");
    }
    this.scheduleHostSize();
  }

  private attachHostResizeObserver(): void {
    if (!this.host || !this.panelEl || this.hostResizeObserver) {
      return;
    }

    this.hostResizeObserver = new ResizeObserver(() => {
      this.scheduleHostSize();
    });
    this.hostResizeObserver.observe(this.panelEl);
  }

  private detachHostResizeObserver(): void {
    this.hostResizeObserver?.disconnect();
    this.hostResizeObserver = null;
  }

  private scheduleHostSize(): void {
    if (this.hostContext === "extension-page") {
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.syncHostSize());
    });
  }

  private syncHostSize(): void {
    if (!this.host || !this.panelEl || this.hostContext === "extension-page") {
      return;
    }

    // scrollHeight reflects full content even when the host is too short.
    const height = Math.ceil(this.panelEl.scrollHeight);
    if (height <= 0) {
      return;
    }

    const next = `${height}px`;
    if (this.host.style.height !== next) {
      this.host.style.height = next;
    }
  }

  private attachEscapeListener(): void {
    if (this.escapeListenerAttached) {
      return;
    }
    document.addEventListener("keydown", this.onEscapeKey, true);
    document.addEventListener("keydown", this.onEditorEnterKey, true);
    this.escapeListenerAttached = true;
  }

  private detachEscapeListener(): void {
    if (!this.escapeListenerAttached) {
      return;
    }
    document.removeEventListener("keydown", this.onEscapeKey, true);
    document.removeEventListener("keydown", this.onEditorEnterKey, true);
    this.escapeListenerAttached = false;
  }

  private getFocusedElement(): Element | null {
    const root = this.getRoot();
    if (root instanceof ShadowRoot) {
      return root.activeElement;
    }
    return document.activeElement;
  }

  private mount(): void {
    if (this.hostContext === "extension-page") {
      this.mountExtensionPage();
      return;
    }

    this.host = document.createElement("div");
    this.host.id = HOST_ID;
    this.host.style.cssText =
      "position:fixed;top:16px;right:16px;width:320px;z-index:2147483646;margin:0;padding:0;display:block;overflow:visible;height:auto;";

    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = panelCss;
    const wrapper = document.createElement("div");
    wrapper.className = "panel-mount";
    wrapper.innerHTML = TEMPLATE;
    this.shadow.append(style, wrapper);
    document.documentElement.append(this.host);

    this.panelEl =
      this.ref<HTMLElement>("panel") ?? this.shadow.querySelector(".panel");
    this.ensureSwatchTooltip();
    this.initEditor();
    this.bindEvents();
    this.attachHostResizeObserver();
  }

  private mountExtensionPage(): void {
    if (!document.getElementById(PANEL_STYLES_ID)) {
      const style = document.createElement("style");
      style.id = PANEL_STYLES_ID;
      style.textContent = panelCssForPage(panelCss);
      document.head.append(style);
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE;
    this.panelEl = wrapper.querySelector(".panel");
    this.panelEl?.classList.add("panel--page");

    if (this.panelEl) {
      document.body.append(this.panelEl);
    }
    this.ensureSwatchTooltip();
    this.initEditor();
    this.bindEvents();
  }

  private ensureSwatchTooltip(): SwatchTooltipController | null {
    if (!this.panelEl) {
      return null;
    }
    if (!this.swatchTooltip) {
      this.swatchTooltip = new SwatchTooltipController(this.panelEl);
    }
    return this.swatchTooltip;
  }

  private disposeSwatchTooltip(): void {
    this.swatchTooltip?.dispose();
    this.swatchTooltip = null;
  }

  private initEditor(): void {
    const container = this.ref<HTMLElement>("editor-container");
    if (!container) {
      return;
    }
    this.editor = new PaletteEditorView(container, {
      onBack: () => this.showView("home"),
      onToast: (message, hex) => this.showToast(message, hex),
      onPaletteChanged: () => {
        void getPalettes().then((palettes) => {
          this.palettes = palettes;
          this.renderPalettes();
          this.scheduleHostSize();
        });
      },
      onLayoutChange: () => this.scheduleHostSize(),
      getSwatchTooltip: () => this.swatchTooltip,
      onSelectColor: () => this.startPickerFromEditor(),
    });
  }

  private ref<T extends Element>(name: string): T | null {
    const root = this.shadow ?? document;
    return root.querySelector<T>(`[data-ref="${name}"]`) ?? null;
  }

  private getRoot(): Document | ShadowRoot {
    return this.shadow ?? document;
  }

  private bindEvents(): void {
    const stopKeys = (event: Event) => {
      event.stopPropagation();
    };
    const mount =
      this.shadow?.querySelector(".panel-mount") ??
      this.panelEl?.querySelector(".panel-mount") ??
      this.panelEl;
    mount?.addEventListener("keydown", stopKeys);
    mount?.addEventListener("keyup", stopKeys);
    // Isolate panel wheel from the host page in the *bubble* phase so child
    // handlers (recent-colors scroller, palette list) still receive the event.
    // Allow native scrolling inside textareas / overflow regions (import, etc.).
    mount?.addEventListener(
      "wheel",
      (event) => {
        if (isInternallyScrollable(event.target, mount)) {
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false }
    );

    this.ref<HTMLButtonElement>("select-color")?.addEventListener("click", () => {
      if (this.selectionMode) {
        this.setSelectionMode(false);
        return;
      }
      if (this.view === "editor") {
        this.startPickerFromEditor();
        return;
      }
      this.options.onStartPicker();
    });

    this.ref<HTMLButtonElement>("close")?.addEventListener("click", () => {
      if (this.view === "editor") {
        void this.editor?.handleBack();
        return;
      }
      this.hide();
    });

    const newPaletteBtn = this.ref<HTMLButtonElement>("new-palette");
    newPaletteBtn?.addEventListener("click", () => {
      if (this.selectionMode && !this.canSaveToPalette()) {
        return;
      }
      if (this.canSaveToPalette()) {
        this.promptCreatePalette();
        return;
      }
      void this.openNewPalette();
    });
    if (newPaletteBtn) {
      // Icon-only action: the label lives in the tooltip + aria-label.
      this.swatchTooltip?.attach(newPaletteBtn, () =>
        this.canSaveToPalette()
          ? "New palette from selection"
          : "New palette"
      );
    }

    const shortcutBtn = this.ref<HTMLButtonElement>("shortcut");
    shortcutBtn?.addEventListener("click", () => {
      // chrome:// pages can't be opened from a content script — ask the worker.
      void chrome.runtime.sendMessage({ type: "OPEN_SHORTCUTS" });
    });
    if (shortcutBtn) {
      this.swatchTooltip?.attach(
        shortcutBtn,
        () => "Change in Chrome shortcut settings"
      );
    }
    this.syncShortcutRow();

    const extractBtn = this.ref<HTMLButtonElement>("extract-page");
    extractBtn?.addEventListener("click", () => {
      this.showExtractDialog();
    });
    if (extractBtn) {
      this.swatchTooltip?.attach(extractBtn, () => "New palette from this page");
    }
    this.ref<HTMLButtonElement>("extract-cancel")?.addEventListener("click", () => {
      this.hideExtractDialog();
    });
    this.ref<HTMLButtonElement>("extract-save")?.addEventListener("click", () => {
      void this.saveExtractedPalette();
    });
    this.ref<HTMLInputElement>("extract-name")?.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        void this.saveExtractedPalette();
      }
    });

    const clearRecentsBtn = this.ref<HTMLButtonElement>("clear-recents");
    clearRecentsBtn?.addEventListener("click", () => {
      void this.handleClearRecents();
    });
    if (clearRecentsBtn) {
      this.swatchTooltip?.attach(clearRecentsBtn, () => "Clear recent colors");
    }

    this.ref<HTMLButtonElement>("toast-action")?.addEventListener("click", () => {
      this.toastAction?.();
    });

    const selectModeToggle = this.ref<HTMLButtonElement>("select-mode-toggle");
    selectModeToggle?.addEventListener("click", () => {
      this.setSelectionMode(!this.selectionMode);
    });
    if (selectModeToggle) {
      // Icon-only action: the label lives in the tooltip + aria-label.
      this.swatchTooltip?.attach(selectModeToggle, () =>
        this.selectionMode ? "Cancel" : "Save to palette"
      );
    }

    this.ref<HTMLButtonElement>("empty")?.addEventListener("click", () => {
      if (this.selectionMode || this.view !== "home") {
        return;
      }
      this.options.onStartPicker();
    });

    this.ref<HTMLButtonElement>("export-palettes")?.addEventListener(
      "click",
      (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        this.showExportMenu(button);
      }
    );

    this.ref<HTMLButtonElement>("import-palettes")?.addEventListener(
      "click",
      () => {
        this.showImportDialog();
      }
    );

    this.ref<HTMLButtonElement>("import-cancel")?.addEventListener(
      "click",
      () => {
        this.hideImportDialog();
      }
    );

    this.ref<HTMLButtonElement>("import-merge")?.addEventListener(
      "click",
      () => {
        void this.runImport("merge");
      }
    );

    this.ref<HTMLButtonElement>("import-replace")?.addEventListener(
      "click",
      () => {
        void this.runImport("replace");
      }
    );

    this.ref<HTMLInputElement>("import-file")?.addEventListener(
      "change",
      (event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) {
          return;
        }
        void this.handleImportFile(file);
        input.value = "";
      }
    );

    this.bindScrollerWheel();
    this.bindSettingsControls();
    this.bindPaletteListDrag();
    this.bindPaletteListScroll();
  }

  private bindPaletteListScroll(): void {
    const list = this.ref<HTMLElement>("palette-list");
    const wrap = this.ref<HTMLElement>("palette-list-wrap");
    if (!list || !wrap || wrap.dataset.scrollBound === "true") {
      return;
    }
    wrap.dataset.scrollBound = "true";

    let hovering = false;
    wrap.addEventListener("pointerenter", () => {
      hovering = true;
    });
    wrap.addEventListener("pointerleave", () => {
      hovering = false;
    });
    wrap.addEventListener("pointerdown", () => {
      if (wrap.classList.contains("is-scrollable")) {
        wrap.focus({ preventScroll: true });
      }
    });

    list.addEventListener("scroll", () => this.syncPaletteListOverflow(), {
      passive: true,
    });

    // Capture wheel here so the host page never scrolls when the cursor is over
    // this section. Only move the palette list when hovered or focused.
    wrap.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!wrap.classList.contains("is-scrollable")) {
          return;
        }

        const focused = this.getFocusedElement();
        const sectionActive =
          hovering || (focused instanceof Node && wrap.contains(focused));
        if (!sectionActive) {
          return;
        }

        const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
        if (maxScroll <= 0) {
          return;
        }

        const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
        list.scrollTop = Math.min(
          maxScroll,
          Math.max(0, list.scrollTop + delta)
        );
        this.syncPaletteListOverflow();
      },
      { passive: false, capture: true }
    );
  }

  private syncPaletteListOverflow(): void {
    const list = this.ref<HTMLElement>("palette-list");
    const wrap = this.ref<HTMLElement>("palette-list-wrap");
    if (!list || !wrap) {
      return;
    }

    const shouldScroll = this.palettes.length > 5;
    wrap.classList.toggle("is-scrollable", shouldScroll);
    if (shouldScroll) {
      wrap.tabIndex = 0;
      wrap.setAttribute("aria-label", "Saved palettes");
    } else {
      wrap.removeAttribute("tabindex");
      wrap.removeAttribute("aria-label");
      wrap.classList.remove("has-more-above", "has-more-below");
      return;
    }

    const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
    const hasOverflow = maxScroll > 1;
    const atTop = list.scrollTop <= 1;
    const atBottom = list.scrollTop >= maxScroll - 1;

    wrap.classList.toggle("has-more-above", hasOverflow && !atTop);
    wrap.classList.toggle("has-more-below", hasOverflow && !atBottom);
  }

  private bindPaletteListDrag(): void {
    const list = this.ref<HTMLElement>("palette-list");
    if (!list || list.dataset.dragBound === "true") {
      return;
    }
    list.dataset.dragBound = "true";

    list.addEventListener("dragstart", (event) => {
      if (!this.moveModePaletteId) {
        return;
      }
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        ".panel__palette-row"
      );
      if (!row || row.dataset.paletteId !== this.moveModePaletteId) {
        event.preventDefault();
        return;
      }
      this.paletteDragIndex = this.palettes.findIndex(
        (palette) => palette.id === this.moveModePaletteId
      );
      event.dataTransfer?.setData("text/plain", String(this.paletteDragIndex));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
      row.classList.add("is-dragging");
    });

    // Insertion-slot reorder: an accent bar marks the gap the row will land in
    // (slot k = above row k; slot n = below the last row). Mirrors the editor's
    // swatch-grid indicator.
    const rowsOf = (): HTMLElement[] => [
      ...list.querySelectorAll<HTMLElement>(".panel__palette-row"),
    ];
    const clearRowIndicator = (): void => {
      for (const item of rowsOf()) {
        item.classList.remove("is-insert-above", "is-insert-below");
      }
    };
    const showRowIndicator = (slot: number): void => {
      clearRowIndicator();
      const rows = rowsOf();
      if (slot < rows.length) {
        rows[slot]?.classList.add("is-insert-above");
      } else {
        rows[rows.length - 1]?.classList.add("is-insert-below");
      }
    };

    list.addEventListener("dragend", (event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        ".panel__palette-row"
      );
      row?.classList.remove("is-dragging");
      clearRowIndicator();
      this.paletteDragIndex = -1;
      this.paletteInsertSlot = -1;
      if (!this.paletteDropHandled) {
        this.setMoveMode(null);
      }
      this.paletteDropHandled = false;
    });

    list.addEventListener("dragover", (event) => {
      if (!this.moveModePaletteId || this.paletteDragIndex < 0) {
        return;
      }
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        ".panel__palette-row"
      );
      if (!row) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const rect = row.getBoundingClientRect();
      const above = event.clientY < rect.top + rect.height / 2;
      const slot = rowsOf().indexOf(row) + (above ? 0 : 1);
      if (slot === this.paletteDragIndex || slot === this.paletteDragIndex + 1) {
        this.paletteInsertSlot = -1;
        clearRowIndicator();
        return;
      }
      this.paletteInsertSlot = slot;
      showRowIndicator(slot);
    });

    list.addEventListener("dragleave", (event) => {
      const related = event.relatedTarget as Node | null;
      if (related && list.contains(related)) {
        return;
      }
      clearRowIndicator();
      this.paletteInsertSlot = -1;
    });

    list.addEventListener("drop", (event) => {
      if (!this.moveModePaletteId || this.paletteDragIndex < 0) {
        return;
      }
      event.preventDefault();
      clearRowIndicator();
      const slot = this.paletteInsertSlot;
      this.paletteInsertSlot = -1;
      if (slot < 0) {
        return;
      }
      const to = slot > this.paletteDragIndex ? slot - 1 : slot;
      if (to !== this.paletteDragIndex) {
        this.paletteDropHandled = true;
        void this.reorderPalettesInList(this.paletteDragIndex, to);
      }
    });
  }

  private async reorderPalettesInList(
    fromIndex: number,
    toIndex: number
  ): Promise<void> {
    try {
      this.palettes = await reorderPalettes(fromIndex, toIndex);
      this.moveModePaletteId = null;
      this.paletteDragIndex = -1;
      this.renderPalettes();
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private setMoveMode(paletteId: string | null): void {
    if (paletteId && this.selectionMode) {
      this.selectionMode = false;
      this.selectedRecents.clear();
      this.selectedPaletteId = null;
      this.dismissSavePaletteConfirm();
      this.updateSelectionToggle();
      this.renderRecentColors();
      this.updateFooterCta();
    }
    this.moveModePaletteId = paletteId;
    this.paletteDragIndex = -1;
    this.renderPalettes();
  }

  private bindScrollerWheel(): void {
    const scroller = this.ref<HTMLElement>("scroller");
    if (!scroller) {
      return;
    }
    bindSwatchTrack(scroller, {
      onScroll: () => this.swatchTooltip?.hide(),
    });
  }

  private syncRecentColorsOverflow(): void {
    const scroller = this.ref<HTMLElement>("scroller");
    if (scroller) {
      syncTrackOverflow(scroller);
    }
  }

  private bindSettingsControls(): void {
    this.ref<HTMLElement>("theme-switcher")
      ?.querySelectorAll<HTMLButtonElement>("[data-theme-mode]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          void this.setThemeMode(button.dataset.themeMode as ThemeMode);
        });
      });

    const formatBtn = this.ref<HTMLButtonElement>("format-select");
    if (formatBtn) {
      this.ensureSwatchTooltip()?.attach(formatBtn, () => "Color format");
      formatBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.showFormatMenu(formatBtn);
      });
      formatBtn.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!this.formatMenuDismiss) {
            this.showFormatMenu(formatBtn);
          }
        }
      });
    }

    const exportBtn = this.ref<HTMLButtonElement>("export-palettes");
    if (exportBtn) {
      this.ensureSwatchTooltip()?.attach(exportBtn, () => "Export All");
    }
    const importBtn = this.ref<HTMLButtonElement>("import-palettes");
    if (importBtn) {
      this.ensureSwatchTooltip()?.attach(importBtn, () => "Import");
    }
  }

  private startPickerFromEditor(): void {
    const paletteId = this.editor?.getPaletteId();
    if (!paletteId) {
      return;
    }
    this.reopenEditorAfterPick = true;
    this.options.onStartPicker({ paletteId });
  }

  private showView(view: PanelView): void {
    this.view = view;
    const home = this.ref<HTMLElement>("home-view");
    const editor = this.ref<HTMLElement>("editor-view");
    home?.toggleAttribute("hidden", view !== "home");
    editor?.toggleAttribute("hidden", view !== "editor");
    this.updateHeaderChrome();
    this.updateFooterCta();
    this.scheduleHostSize();
  }

  private updateHeaderChrome(): void {
    const close = this.ref<HTMLButtonElement>("close");
    if (!close) {
      return;
    }
    if (this.view === "editor") {
      close.setAttribute("aria-label", "Back to palettes");
      close.innerHTML = `
        <svg class="icon icon--back" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      `;
      return;
    }
    close.setAttribute("aria-label", "Close PickHue");
    close.innerHTML = `
      <svg class="icon icon--close" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  private async openNewPalette(): Promise<void> {
    try {
      const palette = await createPalette();
      this.palettes = await getPalettes();
      await this.openEditor(palette);
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private async openEditor(
    palette: ColorPalette,
    options?: { focusName?: boolean }
  ): Promise<void> {
    await this.editor?.open(
      palette,
      this.settings.recentColors,
      this.settings.colorFormat,
      options
    );
    this.showView("editor");
  }

  private canSaveToPalette(): boolean {
    return this.selectionMode && this.selectedRecents.size > 0;
  }

  private setSelectionMode(enabled: boolean): void {
    if (enabled) {
      this.moveModePaletteId = null;
      this.paletteDragIndex = -1;
    }
    this.selectionMode = enabled;
    if (!enabled) {
      this.selectedRecents.clear();
      this.selectedPaletteId = null;
      this.dismissSavePaletteConfirm();
    }
    this.updateSelectionToggle();
    this.renderRecentColors();
    this.renderPalettes();
    this.updateFooterCta();
  }

  private updateSelectionToggle(): void {
    const toggle = this.ref<HTMLButtonElement>("select-mode-toggle");
    const hasRecents = this.settings.recentColors.length > 0;

    if (toggle) {
      toggle.hidden = !hasRecents;
      toggle.classList.toggle("is-active", this.selectionMode);
      toggle.innerHTML = this.selectionMode
        ? CANCEL_ACTION_ICON_HTML
        : PLUS_ICON_HTML;
      toggle.setAttribute(
        "aria-label",
        this.selectionMode ? "Cancel" : "Save to palette"
      );
    }

    const clear = this.ref<HTMLButtonElement>("clear-recents");
    if (clear) {
      clear.hidden = !hasRecents || this.selectionMode;
    }
  }

  private updateFooterCta(): void {
    const button = this.ref<HTMLButtonElement>("select-color");
    if (!button) {
      return;
    }
    button.hidden = false;
    button.classList.remove("panel__cta--selection-mode", "panel__cta--save-ready");
    if (this.view === "editor") {
      button.textContent = "Select Color";
      button.disabled = false;
      return;
    }
    if (this.selectionMode) {
      const count = this.selectedRecents.size;
      button.textContent =
        count > 0 ? "Cancel" : "Select colors";
      button.disabled = count === 0;
      button.classList.add("panel__cta--selection-mode");
      return;
    }
    button.textContent = "Select Color";
    button.disabled = false;
  }

  private highlightPaletteRow(paletteId: string): void {
    this.selectedPaletteId = paletteId;
    this.syncPaletteListState();
  }

  private clearPaletteRowSelection(): void {
    this.selectedPaletteId = null;
    this.syncPaletteListState();
  }

  private removeSavePaletteConfirmOverlay(): void {
    this.getRoot()
      .querySelector(".panel__save-palette-confirm-overlay")
      ?.remove();
  }

  private dismissSavePaletteConfirm(): void {
    this.removeSavePaletteConfirmOverlay();
    this.clearPaletteRowSelection();
  }

  private promptSaveToPalette(palette: ColorPalette): void {
    const colors = [...this.selectedRecents];
    if (colors.length === 0 || !this.canSaveToPalette()) {
      return;
    }

    this.removeSavePaletteConfirmOverlay();
    this.highlightPaletteRow(palette.id);

    const paletteName = palette.name.trim() || "this palette";
    this.mountSavePaletteConfirm({
      title: `Add to "${paletteName}"?`,
      message: `Add ${colors.length} color${colors.length === 1 ? "" : "s"} to this palette.`,
      confirmLabel: "Add colors",
      onConfirm: () => this.saveSelectionToPalette(palette.id),
    });
  }

  private promptCreatePalette(): void {
    const colors = [...this.selectedRecents];
    if (colors.length === 0 || !this.canSaveToPalette()) {
      return;
    }

    this.removeSavePaletteConfirmOverlay();
    this.clearPaletteRowSelection();

    this.mountSavePaletteConfirm({
      title: "Create new palette?",
      message: `Create a palette with ${colors.length} color${colors.length === 1 ? "" : "s"}.`,
      confirmLabel: "Create palette",
      onConfirm: () => this.saveSelectionToNewPalette(),
    });
  }

  private mountSavePaletteConfirm(options: {
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
  }): void {
    const host = this.panelEl;
    if (!host) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.className =
      "panel__save-palette-confirm-overlay palette-editor__confirm-overlay";

    const dialog = document.createElement("div");
    dialog.className = "palette-editor__confirm-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-label", options.title);

    const title = document.createElement("p");
    title.className = "palette-editor__confirm-title";
    title.textContent = options.title;

    const message = document.createElement("p");
    message.className = "palette-editor__confirm-message";
    message.textContent = options.message;

    const buttons = document.createElement("div");
    buttons.className = "palette-editor__confirm-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "palette-editor__action-btn";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      this.dismissSavePaletteConfirm();
    });

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = options.danger
      ? "palette-editor__action-btn palette-editor__action-btn--danger"
      : "palette-editor__action-btn panel__modal-btn--accent panel__save-palette-confirm-btn";
    confirm.textContent = options.confirmLabel;
    confirm.addEventListener("click", () => {
      this.removeSavePaletteConfirmOverlay();
      void options.onConfirm();
    });

    buttons.append(cancel, confirm);
    dialog.append(title, message, buttons);
    overlay.append(dialog);
    host.append(overlay);
    confirm.focus();
  }

  private finishSaveFlow(): void {
    this.dismissSavePaletteConfirm();
    this.setSelectionMode(false);
  }

  private async saveSelectionToPalette(paletteId: string): Promise<void> {
    const colors = [...this.selectedRecents];
    if (colors.length === 0) {
      return;
    }
    try {
      await addColorsToPalette(paletteId, colors);
      this.palettes = await getPalettes();
      this.renderPalettes();
      this.finishSaveFlow();
      this.showToast(`Saved ${colors.length} color${colors.length === 1 ? "" : "s"}`);
    } catch (error) {
      this.dismissSavePaletteConfirm();
      this.handleStorageError(error);
    }
  }

  private async saveSelectionToNewPalette(): Promise<void> {
    const colors = [...this.selectedRecents];
    if (colors.length === 0) {
      return;
    }
    try {
      await createPalette("Untitled palette", colors);
      this.palettes = await getPalettes();
      this.renderPalettes();
      this.finishSaveFlow();
      this.showToast(`Created palette with ${colors.length} color${colors.length === 1 ? "" : "s"}`);
    } catch (error) {
      this.dismissSavePaletteConfirm();
      this.handleStorageError(error);
    }
  }

  private renderSettings(): void {
    this.applyResolvedTheme();

    this.ref<HTMLElement>("theme-switcher")
      ?.querySelectorAll<HTMLButtonElement>("[data-theme-mode]")
      .forEach((button) => {
        const selected = button.dataset.themeMode === this.settings.themeMode;
        button.setAttribute("aria-checked", selected ? "true" : "false");
      });

    const formatValue = this.ref<HTMLElement>("format-select-value");
    if (formatValue) {
      formatValue.textContent = formatLabel(this.settings.colorFormat);
    }
  }

  private renderRecentColors(animateFirst = false): void {
    const track = this.ref<HTMLElement>("track");
    const empty = this.ref<HTMLElement>("empty");
    if (!track || !empty) {
      return;
    }

    this.swatchTooltip?.hide();

    const isEmpty = this.settings.recentColors.length === 0;
    empty.hidden = !isEmpty;
    empty.classList.toggle("is-hidden", !isEmpty);
    empty.toggleAttribute("disabled", !isEmpty);

    const wrap = empty.closest(".panel__swatches-wrap");
    if (wrap instanceof HTMLElement) {
      wrap.classList.toggle("is-empty", isEmpty);
    }

    track.replaceChildren(
      ...this.settings.recentColors.map((hex, index) => {
        const item = document.createElement("div");
        item.className = "swatch-item";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "swatch";
        if (this.selectionMode) {
          button.classList.add("swatch--selectable");
          if (this.selectedRecents.has(hex)) {
            button.classList.add("is-selected");
          }
        }
        if (animateFirst && index === 0 && !this.hadRecentColors) {
          button.classList.add("swatch--enter");
        }
        button.style.backgroundColor = hex;
        const label = formatColor(hex, this.settings.colorFormat);
        button.setAttribute("role", "listitem");
        button.setAttribute(
          "aria-label",
          this.selectionMode ? `Select ${label}` : `Copy ${label}`
        );
        button.addEventListener("click", () => {
          if (this.selectionMode) {
            if (this.selectedRecents.has(hex)) {
              this.selectedRecents.delete(hex);
            } else {
              this.selectedRecents.add(hex);
            }
            this.renderRecentColors();
            this.syncPaletteListState();
            this.updateFooterCta();
            if (this.selectedRecents.size === 0) {
              this.dismissSavePaletteConfirm();
            }
            return;
          }
          void this.handleSwatchClick(hex);
        });
        // Right-click: copy in any format without touching the global setting.
        button.addEventListener("contextmenu", (event) => {
          if (this.selectionMode) {
            return;
          }
          event.preventDefault();
          this.swatchTooltip?.hide();
          this.showCopyAsMenu(button, hex);
        });

        item.append(button);

        if (!this.selectionMode) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "swatch-remove";
          remove.setAttribute("aria-label", `Remove ${label}`);
          remove.innerHTML = REMOVE_SWATCH_ICON_HTML;
          remove.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            void this.handleRemoveRecentColor(hex);
          });
          item.append(remove);
        }

        this.swatchTooltip?.attach(item, () =>
          formatColor(hex, this.settings.colorFormat)
        );

        return item;
      })
    );

    this.hadRecentColors = !isEmpty;
    this.updateSelectionToggle();
    requestAnimationFrame(() => this.syncRecentColorsOverflow());
  }

  private async handleRemoveRecentColor(hex: string): Promise<void> {
    this.swatchTooltip?.hide();
    this.settings = await removeRecentColor(hex);
    this.selectedRecents.delete(hex.toUpperCase());
    this.renderRecentColors();
    this.syncPaletteListState();
    this.updateFooterCta();
    this.scheduleHostSize();
  }

  private renderPalettes(): void {
    const list = this.ref<HTMLElement>("palette-list");
    if (!list) {
      return;
    }

    if (this.palettes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "panel__palettes-empty";
      empty.textContent = this.canSaveToPalette()
        ? "No palettes yet — use + above."
        : "Group colors into named palettes.";
      list.replaceChildren(empty);
      this.syncPaletteListState();
      this.syncPaletteListOverflow();
      this.scheduleHostSize();
      return;
    }

    list.replaceChildren(
      ...this.palettes.map((palette) => this.createPaletteRow(palette))
    );
    this.syncPaletteListState();
    this.syncPaletteListOverflow();
    requestAnimationFrame(() => {
      this.syncPaletteListOverflow();
      this.scheduleHostSize();
    });
  }

  private syncPaletteListState(): void {
    const list = this.ref<HTMLElement>("palette-list");
    if (!list) {
      return;
    }

    const pickActive = this.canSaveToPalette();
    const awaitingSelection = this.selectionMode && !pickActive;
    const moveActive = this.moveModePaletteId !== null;
    list.classList.toggle("panel__palettes--pick-mode", pickActive);
    list.classList.toggle(
      "panel__palettes--awaiting-selection",
      awaitingSelection
    );
    list.classList.toggle(
      "panel__palettes--palette-chosen",
      pickActive && this.selectedPaletteId !== null
    );
    list.classList.toggle("panel__palettes--move-mode", moveActive);

    list.querySelectorAll<HTMLElement>(".panel__palette-row").forEach((row) => {
      const paletteId = row.dataset.paletteId ?? "";
      row.classList.toggle("panel__palette-row--selectable", pickActive);
      row.classList.toggle(
        "panel__palette-row--awaiting",
        awaitingSelection
      );
      row.classList.toggle(
        "is-selected",
        pickActive && paletteId === this.selectedPaletteId
      );
      row.classList.toggle(
        "is-moving",
        moveActive && paletteId === this.moveModePaletteId
      );
      row.draggable =
        moveActive && paletteId === this.moveModePaletteId;
      const main = row.querySelector<HTMLButtonElement>(".panel__palette-main");
      if (main) {
        main.disabled = awaitingSelection || moveActive;
      }
      row
        .querySelectorAll<HTMLButtonElement>(".panel__palette-menu-btn")
        .forEach((menuBtn) => {
          menuBtn.disabled = this.selectionMode || moveActive;
        });
    });

    const newPaletteBtn = this.ref<HTMLButtonElement>("new-palette");
    if (newPaletteBtn) {
      newPaletteBtn.disabled = awaitingSelection;
      newPaletteBtn.classList.toggle("is-awaiting", awaitingSelection);
    }
  }

  private createPaletteRow(palette: ColorPalette): HTMLElement {
    const row = document.createElement("div");
    row.className = "panel__palette-row";
    row.dataset.paletteId = palette.id;

    const main = document.createElement("button");
    main.type = "button";
    main.className = "panel__palette-main";
    main.addEventListener("click", () => {
      if (this.moveModePaletteId) {
        return;
      }
      // Wait for at least one recent swatch before palette picks are live.
      if (this.selectionMode && !this.canSaveToPalette()) {
        return;
      }
      if (this.canSaveToPalette()) {
        this.promptSaveToPalette(palette);
        return;
      }
      void this.openEditor(palette);
    });

    const name = document.createElement("span");
    name.className = "panel__palette-name";
    name.textContent = palette.name;

    const strip = document.createElement("span");
    strip.className = "panel__palette-strip";
    const preview = palette.colors.slice(0, PALETTE_PREVIEW_COUNT);
    for (const hex of preview) {
      const dot = document.createElement("span");
      dot.className = "panel__palette-dot";
      dot.style.backgroundColor = hex;
      strip.append(dot);
    }
    if (palette.colors.length > PALETTE_PREVIEW_COUNT) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "panel__palette-ellipsis";
      ellipsis.setAttribute("aria-hidden", "true");
      ellipsis.textContent = "…";
      strip.append(ellipsis);
    }

    main.append(name, strip);

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "panel__palette-btn panel__palette-menu-btn";
    menuBtn.setAttribute("aria-label", `Actions for ${palette.name}`);
    menuBtn.innerHTML = ELLIPSIS_ICON_HTML;
    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showPaletteRowMenu(menuBtn, palette);
    });

    row.append(main, menuBtn);
    return row;
  }

  private showPaletteRowMenu(
    anchor: HTMLElement,
    palette: ColorPalette
  ): void {
    const root = this.getRoot();
    const existing = root.querySelector(".palette-row-menu");
    existing?.remove();

    const row = anchor.closest(".panel__palette-row");
    const panel = this.panelEl;
    if (!row || !panel) {
      return;
    }

    const menu = document.createElement("div");
    menu.className = "palette-menu palette-row-menu";
    menu.setAttribute("role", "menu");

    const addItem = (
      label: string,
      action: () => void | Promise<void>,
      options?: { danger?: boolean; iconHtml?: string }
    ): void => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "palette-menu__item";
      if (options?.danger) {
        item.classList.add("palette-menu__item--danger");
      }
      if (options?.iconHtml) {
        item.classList.add("palette-menu__item--with-icon");
        item.innerHTML = `${options.iconHtml}<span>${label}</span>`;
      } else {
        item.textContent = label;
      }
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        dismiss();
        void action();
      });
      menu.append(item);
    };

    addItem("Rename", () => {
      void this.openEditor(palette, { focusName: true });
    }, { iconHtml: RENAME_ICON_HTML });
    addItem("Export…", () => {
      this.showExportMenuForPalettes(anchor, [palette]);
    }, { iconHtml: EXPORT_ICON_HTML });
    addItem("Move", () => {
      this.setMoveMode(palette.id);
    }, { iconHtml: MOVE_ICON_HTML });
    addItem("Delete", () => {
      this.showDeletePaletteConfirm(palette);
    }, { danger: true, iconHtml: DELETE_ICON_HTML });

    panel.append(menu);

    const rowRect = row.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    menu.style.top = `${rowRect.bottom - panelRect.top + 4}px`;
    requestAnimationFrame(() => {
      const menuWidth = menu.offsetWidth;
      menu.style.left = `${rowRect.right - panelRect.left - menuWidth}px`;
    });

    const dismiss = (): void => {
      menu.remove();
      document.removeEventListener("click", onOutside, true);
    };
    const onOutside = (event: MouseEvent): void => {
      if (!menu.contains(event.target as Node)) {
        dismiss();
      }
    };
    requestAnimationFrame(() => {
      document.addEventListener("click", onOutside, true);
    });
  }

  private showDeletePaletteConfirm(palette: ColorPalette): void {
    const panel = this.panelEl;
    if (!panel) {
      return;
    }

    panel.querySelector(".palette-editor__confirm-overlay")?.remove();

    const paletteName = palette.name.trim() || "this palette";
    const overlay = document.createElement("div");
    overlay.className = "palette-editor__confirm-overlay";

    const dialog = document.createElement("div");
    dialog.className = "palette-editor__confirm-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-label", "Delete palette");

    const title = document.createElement("p");
    title.className = "palette-editor__confirm-title";
    title.textContent = `Delete "${paletteName}"?`;

    const message = document.createElement("p");
    message.className = "palette-editor__confirm-message";
    message.textContent = "This palette and its colors will be removed.";

    const buttons = document.createElement("div");
    buttons.className = "palette-editor__confirm-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "palette-editor__action-btn";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => overlay.remove());

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className =
      "palette-editor__action-btn palette-editor__action-btn--danger palette-editor__action-btn--with-icon";
    confirm.innerHTML = DELETE_BUTTON_HTML;
    confirm.addEventListener("click", () => {
      overlay.remove();
      void this.deletePaletteById(palette.id);
    });

    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      event.stopPropagation();
      overlay.remove();
      document.removeEventListener("keydown", onEscape, true);
    };
    document.addEventListener("keydown", onEscape, true);
    overlay.addEventListener("remove", () => {
      document.removeEventListener("keydown", onEscape, true);
    });

    buttons.append(cancel, confirm);
    dialog.append(title, message, buttons);
    overlay.append(dialog);
    panel.append(overlay);
    cancel.focus();
  }

  private async deletePaletteById(id: string): Promise<void> {
    try {
      await deletePalette(id);
      this.palettes = await getPalettes();
      this.renderPalettes();
      this.showToast("Palette deleted");
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private showImportDialog(): void {
    const dialog = this.ref<HTMLElement>("import-dialog");
    const input = this.ref<HTMLTextAreaElement>("import-input");
    if (!dialog || !input) {
      return;
    }
    input.value = "";
    dialog.hidden = false;
  }

  private hideImportDialog(): void {
    this.ref<HTMLElement>("import-dialog")?.setAttribute("hidden", "");
  }

  private async handleImportFile(file: File): Promise<void> {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".ase")) {
        const buffer = await file.arrayBuffer();
        const result = await importPalettesFromAse(buffer, "merge");
        this.palettes = result.palettes;
        this.renderPalettes();
        this.hideImportDialog();
        this.showToast(
          `Imported ${result.added} new, updated ${result.updated}`
        );
        return;
      }

      const text = await file.text();
      this.ref<HTMLTextAreaElement>("import-input")!.value = text;
      this.showToast("File loaded — choose Merge or Replace");
    } catch (error) {
      this.showToast(
        error instanceof Error ? error.message : "Could not read file"
      );
    }
  }

  private async runImport(mode: "merge" | "replace"): Promise<void> {
    const input = this.ref<HTMLTextAreaElement>("import-input");
    if (!input?.value.trim()) {
      this.showToast("Paste palette data or choose a file");
      return;
    }

    if (mode === "replace") {
      const confirmed = window.confirm(
        "Replace all saved palettes? This cannot be undone."
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const result = await importPalettes(input.value, mode);
      this.palettes = result.palettes;
      this.renderPalettes();
      this.hideImportDialog();
      if (mode === "merge") {
        this.showToast(
          `Imported ${result.added} new, updated ${result.updated}`
        );
      } else {
        this.showToast(`Replaced with ${result.added} palettes`);
      }
    } catch (error) {
      this.showToast(
        error instanceof Error ? error.message : "Import failed"
      );
    }
  }

  private showFormatMenu(anchor: HTMLButtonElement): void {
    if (this.formatMenuDismiss) {
      // A second click on the trigger closes the menu that click opened.
      this.formatMenuDismiss();
      return;
    }

    this.swatchTooltip?.hide();

    this.formatMenuDismiss = showSelectMenu<ColorFormat>(anchor, {
      label: "Color format",
      className: "format-select-menu",
      options: FORMAT_OPTIONS,
      selected: this.settings.colorFormat,
      onSelect: (value) => {
        void this.updateColorFormat(value);
      },
      onClose: () => {
        this.formatMenuDismiss = null;
      },
    });
  }

  private showExportMenu(anchor: HTMLButtonElement): void {
    if (this.palettes.length === 0) {
      this.showToast("No palettes to export");
      return;
    }
    this.showExportMenuForPalettes(anchor, this.palettes);
  }

  private showExportMenuForPalettes(
    anchor: HTMLElement,
    palettes: ColorPalette[]
  ): void {
    if (palettes.length === 0) {
      this.showToast("No palettes to export");
      return;
    }

    const single = palettes.length === 1;
    showActionMenu(this.getRoot(), anchor, [
      {
        label: "Hex list — Canva, anywhere",
        iconHtml: EXPORT_LIST_ICON_HTML,
        action: () => {
          copyText(exportPalettesHexList(palettes));
          this.showToast("Hex list copied");
        },
      },
      {
        label: "CSS variables — Figma, code",
        iconHtml: EXPORT_CODE_ICON_HTML,
        action: () => {
          copyText(exportPalettesCss(palettes));
          this.showToast("CSS variables copied");
        },
      },
      {
        label: "Tailwind config",
        iconHtml: EXPORT_TAILWIND_ICON_HTML,
        action: () => {
          copyText(exportPalettesTailwind(palettes));
          this.showToast("Tailwind colors copied");
        },
      },
      {
        label: "Adobe ASE (.ase)",
        iconHtml: EXPORT_FILE_ICON_HTML,
        action: () => {
          if (single) {
            exportPaletteAseFile(palettes[0]!);
            this.showToast("Downloaded .ase file");
          } else {
            exportPalettesAseFile(palettes);
            this.showToast("Downloaded pickhue-palettes.ase");
          }
        },
      },
      {
        label: "PickHue JSON (backup)",
        iconHtml: EXPORT_BACKUP_ICON_HTML,
        action: () => {
          copyText(exportPalettes(palettes));
          this.showToast("JSON copied to clipboard");
        },
      },
    ]);
  }

  /** Shows the live eyedropper binding (users can remap it in Chrome). */
  private syncShortcutRow(): void {
    const value = this.ref<HTMLElement>("shortcut-value");
    if (!value) {
      return;
    }
    void chrome.runtime
      .sendMessage({ type: "GET_PICKER_SHORTCUT" })
      .then((response: { shortcut?: string } | undefined) => {
        value.textContent = response?.shortcut
          ? response.shortcut
          : "Set shortcut";
      })
      .catch(() => {
        value.textContent = "Set shortcut";
      });
  }

  private applyResolvedTheme(): void {
    const theme = resolveTheme(this.settings.themeMode);
    this.panelEl?.setAttribute("data-theme", theme);

    if (this.hostContext === "extension-page") {
      document.body.dataset.theme = theme;
    }

    this.applyDynamicAccent(theme);
  }

  /*
   * Dynamic accent + tinted chrome: the panel wears the user's last pick.
   * Inline vars override the static (default coral) values in panel.css.
   */
  private applyDynamicAccent(theme: "light" | "dark"): void {
    if (!this.panelEl) {
      return;
    }
    const pick = this.settings.recentColors[0] ?? null;
    const tokens = deriveAccentTokens(pick, theme);
    this.panelEl.style.setProperty("--accent", tokens.accent);
    this.panelEl.style.setProperty("--accent-hover", tokens.accentHover);
    this.panelEl.style.setProperty("--accent-text", tokens.accentText);
    this.panelEl.style.setProperty("--accent-link", tokens.accentLink);
    for (const [prop, value] of Object.entries(
      chromeTintTokens(tokens.hue, theme)
    )) {
      this.panelEl.style.setProperty(prop, value);
    }
  }

  private async setThemeMode(mode: ThemeMode): Promise<void> {
    if (!mode || mode === this.settings.themeMode) {
      return;
    }
    this.settings = await saveSettings({ themeMode: mode });
    this.renderSettings();
  }

  private async updateColorFormat(format: ColorFormat): Promise<void> {
    if (!format || format === this.settings.colorFormat) {
      return;
    }
    this.settings = { ...this.settings, colorFormat: format };
    this.renderSettings();
    this.renderRecentColors();
    if (this.view === "editor" && this.editor) {
      const palette = this.editor.getPalette();
      if (palette) {
        await this.editor.open(
          palette,
          this.settings.recentColors,
          format
        );
      }
    }
    this.settings = await saveSettings({ colorFormat: format });
  }

  private async handleSwatchClick(hex: string): Promise<void> {
    const formatted = formatColor(hex, this.settings.colorFormat);
    copyText(formatted);
    const previousLength = this.settings.recentColors.length;
    this.settings = await addRecentColor(hex);
    this.renderRecentColors(
      previousLength === 0 && this.settings.recentColors.length > 0
    );
    this.showToast(`Copied ${formatted}`, hex);
  }

  /*
   * Clear-all is undoable rather than confirmed: the toast offers Undo for a
   * few seconds and restores the exact list (and with it, the dynamic accent).
   */
  private async handleClearRecents(): Promise<void> {
    if (this.settings.recentColors.length === 0) {
      return;
    }
    this.swatchTooltip?.hide();
    const snapshot = [...this.settings.recentColors];
    try {
      this.settings = await saveSettings({ recentColors: [] });
    } catch (error) {
      this.handleStorageError(error);
      return;
    }
    this.selectedRecents.clear();
    this.renderRecentColors();
    this.syncPaletteListState();
    this.updateFooterCta();
    this.applyResolvedTheme();
    this.scheduleHostSize();
    this.showToast(
      "Recent colors cleared",
      undefined,
      { label: "Undo", onClick: () => void this.restoreRecents(snapshot) },
      5000
    );
  }

  private async restoreRecents(snapshot: string[]): Promise<void> {
    try {
      this.settings = await saveSettings({ recentColors: snapshot });
    } catch (error) {
      this.handleStorageError(error);
      return;
    }
    this.renderRecentColors();
    this.syncPaletteListState();
    this.updateFooterCta();
    this.applyResolvedTheme();
    this.scheduleHostSize();
    this.hideToast();
  }

  /*
   * Extraction review: the page's colors grouped by role, every swatch a
   * toggle (on by default), a prefilled name, one Save. Runs on demand — the
   * DOM walk is capped and takes a few milliseconds.
   */
  private showExtractDialog(): void {
    const dialog = this.ref<HTMLElement>("extract-dialog");
    const groupsEl = this.ref<HTMLElement>("extract-groups");
    const nameInput = this.ref<HTMLInputElement>("extract-name");
    const hint = this.ref<HTMLElement>("extract-hint");
    const saveBtn = this.ref<HTMLButtonElement>("extract-save");
    if (!dialog || !groupsEl || !nameInput || !hint || !saveBtn) {
      return;
    }

    const extracted = extractPagePalette();
    const groups: Array<{ label: string; colors: string[] }> = [
      { label: "Backgrounds", colors: extracted.backgrounds },
      { label: "Text", colors: extracted.text },
      { label: "Borders", colors: extracted.borders },
    ].filter((group) => group.colors.length > 0);

    groupsEl.replaceChildren();
    const empty = groups.length === 0;
    hint.textContent = empty
      ? "No colors found on this page."
      : "Tap a swatch to leave it out.";
    saveBtn.disabled = empty;

    for (const group of groups) {
      const label = document.createElement("p");
      label.className = "panel__extract-group-label";
      label.textContent = group.label;
      const row = document.createElement("div");
      row.className = "panel__extract-row";
      for (const hex of group.colors) {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "swatch panel__extract-swatch";
        swatch.style.backgroundColor = hex;
        swatch.dataset.hex = hex;
        swatch.setAttribute("aria-pressed", "true");
        swatch.setAttribute(
          "aria-label",
          `Include ${formatColor(hex, this.settings.colorFormat)}`
        );
        swatch.addEventListener("click", () => {
          const excluded = swatch.classList.toggle("is-excluded");
          swatch.setAttribute("aria-pressed", excluded ? "false" : "true");
        });
        this.swatchTooltip?.attach(swatch, () =>
          formatColor(hex, this.settings.colorFormat)
        );
        row.append(swatch);
      }
      groupsEl.append(label, row);
    }

    nameInput.value = (document.title || "").trim().slice(0, 48) || "Page palette";
    dialog.hidden = false;
    this.scheduleHostSize();
  }

  private hideExtractDialog(): void {
    const dialog = this.ref<HTMLElement>("extract-dialog");
    if (dialog) {
      dialog.hidden = true;
    }
  }

  private async saveExtractedPalette(): Promise<void> {
    const groupsEl = this.ref<HTMLElement>("extract-groups");
    const nameInput = this.ref<HTMLInputElement>("extract-name");
    if (!groupsEl || !nameInput) {
      return;
    }
    const colors = [
      ...new Set(
        [...groupsEl.querySelectorAll<HTMLElement>(
          ".panel__extract-swatch:not(.is-excluded)"
        )].map((swatch) => swatch.dataset.hex ?? "")
      ),
    ].filter(Boolean);
    if (colors.length === 0) {
      this.showToast("No colors selected");
      return;
    }
    const name = nameInput.value.trim().slice(0, 48) || "Page palette";
    try {
      await createPalette(name, colors);
    } catch (error) {
      this.handleStorageError(error);
      return;
    }
    this.hideExtractDialog();
    this.palettes = await getPalettes();
    this.renderPalettes();
    this.scheduleHostSize();
    this.showToast(`Saved ${name}`);
  }

  /** Format-conversion menu: every format with its live value, one click copies. */
  private showCopyAsMenu(anchor: HTMLElement, hex: string): void {
    showActionMenu(
      this.getRoot() as Document | ShadowRoot,
      anchor,
      FORMAT_OPTIONS.map((option) => ({
        label: `${option.label} · ${formatColor(hex, option.value)}`,
        action: () => {
          const formatted = formatColor(hex, option.value);
          copyText(formatted);
          this.showToast(`Copied ${formatted}`, hex);
        },
      }))
    );
  }

  showToast(
    message: string,
    hex?: string,
    action?: { label: string; onClick: () => void },
    durationMs = 2200
  ): void {
    const toast = this.ref<HTMLElement>("toast");
    const swatch = this.ref<HTMLElement>("toast-swatch");
    const text = this.ref<HTMLElement>("toast-text");
    if (!toast || !swatch || !text) {
      return;
    }

    if (hex) {
      swatch.style.backgroundColor = hex;
      swatch.hidden = false;
    } else {
      swatch.hidden = true;
    }
    // Swatchless toasts drop the swatch-concentric radius — at text height it
    // reads as a pill instead of a rounded rectangle.
    toast.classList.toggle("toast--text-only", !hex);
    text.textContent = message;

    const actionBtn = this.ref<HTMLButtonElement>("toast-action");
    this.toastAction = action?.onClick ?? null;
    if (actionBtn) {
      actionBtn.hidden = !action;
      actionBtn.textContent = action?.label ?? "";
    }
    // The toast is click-through unless it carries an action.
    toast.classList.toggle("toast--actionable", Boolean(action));

    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-visible"));

    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => this.hideToast(), durationMs);
  }

  private hideToast(): void {
    const toast = this.ref<HTMLElement>("toast");
    if (!toast) {
      return;
    }
    window.clearTimeout(this.toastTimer);
    this.toastAction = null;
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }

  private handleStorageError(error: unknown): void {
    if (error instanceof StorageQuotaError) {
      this.showToast(
        "Storage full — delete a palette or export and remove old ones"
      );
      return;
    }
    if (error instanceof Error) {
      this.showToast(error.message);
    }
  }
}
