import panelCss from "./panel.css?inline";
import { copyText } from "../shared/clipboard";
import { formatColor } from "../shared/colors";
import { addRecentColor, getSettings, saveSettings } from "../shared/storage";
import { resolveTheme } from "../shared/theme";
import type { ColorFormat, Settings, ThemeMode } from "../shared/types";

const HOST_ID = "pickhue-panel-host";
const PANEL_STYLES_ID = "pickhue-panel-styles";
const CLOSE_ANIM_MS = 180;

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

    <section class="panel__section panel__section--recent">
      <h2 class="panel__label">Recent Colors</h2>
      <div class="panel__swatches-wrap">
        <p class="panel__swatches-empty" data-ref="empty">Colors you select go here.</p>
        <div class="panel__swatches" role="list" data-ref="scroller">
          <div class="panel__swatches-inner" data-ref="track"></div>
        </div>
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
    </section>

    <footer class="panel__footer">
      <button class="panel__cta" type="button" data-ref="select-color">Select Color</button>
    </footer>

    <div class="toast" role="status" aria-live="polite" data-ref="toast" hidden>
      <span class="toast__swatch" data-ref="toast-swatch"></span>
      <span class="toast__text" data-ref="toast-text">Copied</span>
    </div>
  </div>
`;

type HostContext = "content-script" | "extension-page";

interface PanelOptions {
  hostContext?: HostContext;
  onStartPicker: () => void;
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
  private hadRecentColors = false;
  private readonly systemThemeQuery = window.matchMedia(
    "(prefers-color-scheme: dark)"
  );
  private readonly onSystemThemeChange = (): void => {
    if (this.settings.themeMode === "system" && this.isOpen) {
      this.applyResolvedTheme();
    }
  };
  private escapeListenerAttached = false;
  private readonly onEscapeKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.isOpen) {
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
      if (area !== "sync" || !changes.pickhue_settings) {
        return;
      }
      void (async () => {
        const previousLength = this.settings.recentColors.length;
        this.settings = await getSettings();
        if (this.isOpen) {
          this.renderSettings();
          this.renderRecentColors(
            previousLength === 0 && this.settings.recentColors.length > 0
          );
        }
      })();
    });
  }

  get isOpen(): boolean {
    if (this.hostContext === "extension-page") {
      return this.panelEl !== null;
    }
    return this.host !== null && this.closeTimer === 0;
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
    if (this.host) {
      // Already mounted (e.g. reopened after a pick) — just refresh + animate.
      this.settings = await getSettings();
      this.hadRecentColors = this.settings.recentColors.length > 0;
      this.renderSettings();
      this.renderRecentColors();
      this.attachEscapeListener();
      requestAnimationFrame(() => this.panelEl?.classList.add("is-open"));
      return;
    }

    this.settings = await getSettings();
    this.hadRecentColors = this.settings.recentColors.length > 0;
    this.mount();
    this.renderSettings();
    this.renderRecentColors();
    this.attachEscapeListener();
    if (this.hostContext === "extension-page") {
      this.panelEl?.classList.add("is-open");
    } else {
      requestAnimationFrame(() => this.panelEl?.classList.add("is-open"));
    }
  }

  private attachEscapeListener(): void {
    if (this.escapeListenerAttached) {
      return;
    }
    document.addEventListener("keydown", this.onEscapeKey, true);
    this.escapeListenerAttached = true;
  }

  private detachEscapeListener(): void {
    if (!this.escapeListenerAttached) {
      return;
    }
    document.removeEventListener("keydown", this.onEscapeKey, true);
    this.escapeListenerAttached = false;
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
    this.panelEl?.classList.remove("is-open");
    const host = this.host;
    this.closeTimer = window.setTimeout(() => {
      host.remove();
      if (this.host === host) {
        this.host = null;
        this.shadow = null;
        this.panelEl = null;
      }
      this.closeTimer = 0;
    }, CLOSE_ANIM_MS);
  }

  /**
   * Tear the panel out of the DOM immediately, with no close animation. Used
   * right before starting the eyedropper: `captureVisibleTab` snapshots the page
   * synchronously, so the panel host must be gone (and the page repainted)
   * before capture, otherwise the magnifier samples a screenshot that still
   * contains the panel.
   */
  hideImmediate(): void {
    if (this.hostContext === "extension-page") {
      this.detachEscapeListener();
      window.close();
      return;
    }

    this.detachEscapeListener();
    if (this.closeTimer) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = 0;
    }
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.panelEl = null;
  }

  private mount(): void {
    if (this.hostContext === "extension-page") {
      this.mountExtensionPage();
      return;
    }

    this.host = document.createElement("div");
    this.host.id = HOST_ID;
    this.host.style.cssText =
      "position:fixed;top:16px;right:16px;width:320px;height:378px;z-index:2147483646;margin:0;padding:0;";

    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = panelCss;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE;
    this.shadow.append(style, wrapper);
    document.documentElement.append(this.host);

    this.panelEl = this.ref<HTMLElement>("panel") ?? this.shadow.querySelector(".panel");
    this.bindEvents();
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
    this.bindEvents();
  }

  private ref<T extends Element>(name: string): T | null {
    const root = this.shadow ?? document;
    return root.querySelector<T>(`[data-ref="${name}"]`) ?? null;
  }

  private bindEvents(): void {
    this.ref<HTMLButtonElement>("select-color")?.addEventListener("click", () => {
      this.options.onStartPicker();
    });

    this.ref<HTMLButtonElement>("close")?.addEventListener("click", () => {
      this.hide();
    });

    // Translate vertical wheel into horizontal scroll while hovering the recent
    // colors row (Chromium doesn't do this automatically for inner elements).
    const scroller = this.ref<HTMLElement>("scroller");
    const track = this.ref<HTMLElement>("track");
    if (scroller && track) {
      let targetScroll = 0;
      let scrollRafId = 0;
      let direction = 1; // +1 = scrolling toward the end, -1 = toward the start
      let lastLeft = Number.NaN; // detects hitting a hard scroll bound

      const maxScroll = (): number =>
        Math.max(0, scroller.scrollWidth - scroller.clientWidth);

      // Hand the resting position to native CSS scroll-snap so the edge inset
      // lands on the device-pixel grid (clean at every zoom). Choose which edge
      // to align based on the direction the user scrolled.
      const settleSnap = (): void => {
        scroller.classList.toggle("snap-end", direction >= 0);
        scroller.classList.add("is-snapping");
      };

      const animateScroll = (): void => {
        const diff = targetScroll - scroller.scrollLeft;
        const stuck = scroller.scrollLeft === lastLeft; // hit a hard bound
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

          // Disable mandatory snap during the gesture so it never fights the
          // free-scroll momentum; it's re-enabled when the scroll settles.
          scroller.classList.remove("is-snapping");

          // Resync to the live position when starting a fresh gesture so the
          // target never drifts, and keep a single animation loop running.
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
        if (animateFirst && index === 0 && !this.hadRecentColors) {
          button.classList.add("swatch--enter");
        }
        button.style.backgroundColor = hex;
        button.title = formatColor(hex, this.settings.colorFormat);
        button.setAttribute("role", "listitem");
        button.setAttribute("aria-label", `Copy ${button.title}`);
        button.addEventListener("click", () => {
          void this.handleSwatchClick(hex);
        });
        return button;
      })
    );

    this.hadRecentColors = !isEmpty;
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
    this.showToast(formatted, hex);
  }

  private showToast(formatted: string, hex: string): void {
    const toast = this.ref<HTMLElement>("toast");
    const swatch = this.ref<HTMLElement>("toast-swatch");
    const text = this.ref<HTMLElement>("toast-text");
    if (!toast || !swatch || !text) {
      return;
    }

    swatch.style.backgroundColor = hex;
    text.textContent = `Copied ${formatted}`;
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
}
