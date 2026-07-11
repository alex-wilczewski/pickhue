import panelCss from "./panel.css?inline";
import { DELETE_BUTTON_HTML, DELETE_ICON_HTML, SETTINGS_ICON_HTML } from "./icons";
import { PaletteEditorView } from "./palette-editor";
import { showActionMenu } from "./palette-menu";
import { copyText } from "../shared/clipboard";
import { formatColor } from "../shared/colors";
import {
  exportPalettesAseFile,
  exportPalettesHexList,
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
  reorderPalettes,
  saveSettings,
  StorageQuotaError,
} from "../shared/storage";
import { resolveTheme } from "../shared/theme";
import type { ColorFormat, ColorPalette, Settings, ThemeMode } from "../shared/types";

const HOST_ID = "pickhue-panel-host";
const PANEL_STYLES_ID = "pickhue-panel-styles";
const CLOSE_ANIM_MS = 180;
const PALETTE_PREVIEW_COUNT = 4;

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
            <button type="button" class="panel__section-action" data-ref="select-mode-toggle" hidden>
              Save to palette
            </button>
          </div>
          <div class="panel__swatches-wrap">
            <p class="panel__swatches-empty" data-ref="empty">Colors you select go here.</p>
            <div class="panel__swatches" role="list" data-ref="scroller">
              <div class="panel__swatches-inner" data-ref="track"></div>
            </div>
          </div>
        </section>

        <section class="panel__section panel__section--palettes">
          <div class="panel__section-head">
            <h2 class="panel__label">Saved Palettes</h2>
            <button type="button" class="panel__section-action" data-ref="new-palette">
              New palette
            </button>
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
            <span class="panel__setting-label">Format</span>
            <div class="format-switcher" role="radiogroup" aria-label="Format" data-ref="format-switcher">
              <button type="button" class="format-switcher__btn" data-format="hex" role="radio" aria-checked="true">HEX</button>
              <button type="button" class="format-switcher__btn" data-format="rgb" role="radio" aria-checked="false">RGB</button>
              <button type="button" class="format-switcher__btn" data-format="hsl" role="radio" aria-checked="false">HSL</button>
              <button type="button" class="format-switcher__btn" data-format="oklch" role="radio" aria-checked="false">OKLCH</button>
            </div>
          </div>

          <div class="panel__setting">
            <span class="panel__setting-label">Palettes</span>
            <div class="panel__setting-actions">
              <button type="button" class="panel__palette-btn" data-ref="export-palettes">Export All</button>
              <button type="button" class="panel__palette-btn" data-ref="import-palettes">Import</button>
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

    <div class="toast" role="status" aria-live="polite" data-ref="toast" hidden>
      <span class="toast__swatch" data-ref="toast-swatch"></span>
      <span class="toast__text" data-ref="toast-text">Copied</span>
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
  private closeTimer = 0;
  private toastTimer = 0;
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
  private paletteDropHandled = false;
  private readonly selectedRecents = new Set<string>();
  private editor: PaletteEditorView | null = null;
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
    if (this.ref<HTMLElement>("import-dialog")?.hidden === false) {
      event.preventDefault();
      event.stopPropagation();
      this.hideImportDialog();
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
    this.initEditor();
    this.bindEvents();
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
    // Keep host-page scroll from moving while the cursor is over the panel.
    mount?.addEventListener(
      "wheel",
      (event) => {
        event.stopPropagation();
      },
      { passive: true, capture: true }
    );

    this.ref<HTMLButtonElement>("select-color")?.addEventListener("click", () => {
      if (this.selectionMode) {
        this.setSelectionMode(false);
        return;
      }
      if (this.view === "editor") {
        const paletteId = this.editor?.getPaletteId();
        if (paletteId) {
          this.reopenEditorAfterPick = true;
          this.options.onStartPicker({ paletteId });
        }
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

    this.ref<HTMLButtonElement>("new-palette")?.addEventListener("click", () => {
      if (this.canSaveToPalette()) {
        this.promptCreatePalette();
        return;
      }
      void this.openNewPalette();
    });

    this.ref<HTMLButtonElement>("select-mode-toggle")?.addEventListener(
      "click",
      () => {
        this.setSelectionMode(!this.selectionMode);
      }
    );

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

    list.addEventListener("dragend", (event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        ".panel__palette-row"
      );
      row?.classList.remove("is-dragging");
      for (const item of list.querySelectorAll<HTMLElement>(
        ".panel__palette-row"
      )) {
        item.classList.remove("is-drop-target");
      }
      this.paletteDragIndex = -1;
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
      if (!row || row.dataset.paletteId === this.moveModePaletteId) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      for (const item of list.querySelectorAll<HTMLElement>(
        ".panel__palette-row"
      )) {
        item.classList.remove("is-drop-target");
      }
      row.classList.add("is-drop-target");
    });

    list.addEventListener("dragleave", (event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        ".panel__palette-row"
      );
      if (!row) {
        return;
      }
      const related = event.relatedTarget as Node | null;
      if (related && row.contains(related)) {
        return;
      }
      row.classList.remove("is-drop-target");
    });

    list.addEventListener("drop", (event) => {
      if (!this.moveModePaletteId || this.paletteDragIndex < 0) {
        return;
      }
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        ".panel__palette-row"
      );
      if (!row || row.dataset.paletteId === this.moveModePaletteId) {
        return;
      }
      event.preventDefault();
      row.classList.remove("is-drop-target");
      const dropIndex = this.palettes.findIndex(
        (palette) => palette.id === row.dataset.paletteId
      );
      if (dropIndex >= 0 && dropIndex !== this.paletteDragIndex) {
        this.paletteDropHandled = true;
        void this.reorderPalettesInList(this.paletteDragIndex, dropIndex);
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

    let targetScroll = 0;
    let scrollRafId = 0;
    let direction = 1;
    let lastLeft = Number.NaN;

    const maxScroll = (): number =>
      Math.max(0, scroller.scrollWidth - scroller.clientWidth);

    const settleSnap = (): void => {
      scroller.classList.toggle("snap-end", direction >= 0);
      scroller.classList.add("is-snapping");
    };

    const animateScroll = (): void => {
      const diff = targetScroll - scroller.scrollLeft;
      const stuck = scroller.scrollLeft === lastLeft;
      lastLeft = scroller.scrollLeft;

      if (Math.abs(diff) <= 0.5 || (stuck && Math.abs(diff) <= 4)) {
        scrollRafId = 0;
        settleSnap();
        return;
      }

      scroller.scrollLeft += diff * 0.22;
      scrollRafId = requestAnimationFrame(animateScroll);
    };

    scroller.addEventListener(
      "wheel",
      (event) => {
        const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
        if (delta === 0 || maxScroll() === 0) {
          return;
        }
        event.preventDefault();
        direction = delta > 0 ? 1 : -1;
        scroller.classList.remove("is-snapping");

        const running = scrollRafId !== 0;
        if (!running) {
          targetScroll = scroller.scrollLeft;
          lastLeft = Number.NaN;
        }
        targetScroll = Math.min(
          maxScroll(),
          Math.max(0, targetScroll + delta)
        );
        if (!running) {
          scrollRafId = requestAnimationFrame(animateScroll);
        }
      },
      { passive: false }
    );
  }

  private bindSettingsControls(): void {
    this.ref<HTMLElement>("theme-switcher")
      ?.querySelectorAll<HTMLButtonElement>("[data-theme-mode]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          void this.setThemeMode(button.dataset.themeMode as ThemeMode);
        });
      });

    this.ref<HTMLElement>("format-switcher")
      ?.querySelectorAll<HTMLButtonElement>("[data-format]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          void this.updateColorFormat(button.dataset.format as ColorFormat);
        });
      });
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
    if (!toggle) {
      return;
    }
    const hasRecents = this.settings.recentColors.length > 0;
    toggle.hidden = !hasRecents;
    toggle.classList.toggle("is-active", this.selectionMode);
    toggle.textContent = this.selectionMode ? "Cancel" : "Save to palette";
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
    confirm.className =
      "palette-editor__action-btn panel__modal-btn--accent panel__save-palette-confirm-btn";
    confirm.textContent = options.confirmLabel;
    confirm.addEventListener("click", () => {
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

    this.ref<HTMLElement>("format-switcher")
      ?.querySelectorAll<HTMLButtonElement>("[data-format]")
      .forEach((button) => {
        const selected = button.dataset.format === this.settings.colorFormat;
        button.setAttribute("aria-checked", selected ? "true" : "false");
      });
  }

  private renderRecentColors(animateFirst = false): void {
    const track = this.ref<HTMLElement>("track");
    const empty = this.ref<HTMLElement>("empty");
    if (!track || !empty) {
      return;
    }

    const isEmpty = this.settings.recentColors.length === 0;
    empty.hidden = !isEmpty;
    empty.classList.toggle("is-hidden", !isEmpty);

    track.replaceChildren(
      ...this.settings.recentColors.map((hex, index) => {
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
        button.title = formatColor(hex, this.settings.colorFormat);
        button.setAttribute("role", "listitem");
        button.setAttribute(
          "aria-label",
          this.selectionMode
            ? `Select ${button.title}`
            : `Copy ${button.title}`
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
            return;
          }
          void this.handleSwatchClick(hex);
        });
        return button;
      })
    );

    this.hadRecentColors = !isEmpty;
    this.updateSelectionToggle();
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
        ? "No palettes yet — use New palette above."
        : "Group colors into named palettes.";
      list.replaceChildren(empty);
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
    const moveActive = this.moveModePaletteId !== null;
    list.classList.toggle("panel__palettes--pick-mode", pickActive);
    list.classList.toggle(
      "panel__palettes--palette-chosen",
      pickActive && this.selectedPaletteId !== null
    );
    list.classList.toggle("panel__palettes--move-mode", moveActive);

    list.querySelectorAll<HTMLElement>(".panel__palette-row").forEach((row) => {
      const paletteId = row.dataset.paletteId ?? "";
      row.classList.toggle("panel__palette-row--selectable", pickActive);
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
      row
        .querySelector<HTMLElement>(".panel__palette-menu-btn")
        ?.classList.toggle(
          "panel__palette-menu-btn--hidden",
          pickActive || moveActive
        );
    });
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
    menuBtn.innerHTML = SETTINGS_ICON_HTML;
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
        void action();
        menu.remove();
      });
      menu.append(item);
    };

    addItem("Rename", () => {
      void this.openEditor(palette, { focusName: true });
    });
    addItem("Export", () => {
      exportPaletteAseFile(palette);
      this.showToast("Downloaded .ase file");
    });
    addItem("Move", () => {
      this.setMoveMode(palette.id);
    });
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

  private showExportMenu(anchor: HTMLButtonElement): void {
    if (this.palettes.length === 0) {
      this.showToast("No palettes to export");
      return;
    }

    showActionMenu(this.getRoot(), anchor, [
      {
        label: "Adobe ASE (.ase)",
        action: () => {
          exportPalettesAseFile(this.palettes);
          this.showToast("Downloaded pickhue-palettes.ase");
        },
      },
      {
        label: "Color list",
        action: () => {
          copyText(exportPalettesHexList(this.palettes));
          this.showToast("Color list copied");
        },
      },
      {
        label: "PickHue JSON",
        action: () => {
          copyText(exportPalettes(this.palettes));
          this.showToast("JSON copied to clipboard");
        },
      },
    ]);
  }

  private applyResolvedTheme(): void {
    const theme = resolveTheme(this.settings.themeMode);
    this.panelEl?.setAttribute("data-theme", theme);

    if (this.hostContext === "extension-page") {
      document.body.dataset.theme = theme;
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

  showToast(message: string, hex?: string): void {
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
    text.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-visible"));

    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => {
        toast.hidden = true;
      }, 220);
    }, 2200);
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
