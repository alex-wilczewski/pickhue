import panelCss from "./panel.css?inline";
import { copyText } from "../shared/clipboard";
import { formatColor } from "../shared/colors";
import { addRecentColor, getSettings, saveSettings } from "../shared/storage";
import type { ColorFormat, Settings } from "../shared/types";

const HOST_ID = "pickhue-panel-host";
const CLOSE_ANIM_MS = 180;

const formatLabels: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
};

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
        <span class="panel__setting-label">Light Mode</span>
        <button class="toggle" type="button" role="switch" aria-checked="false" data-ref="toggle">
          <span class="toggle__thumb"></span>
        </button>
      </div>

      <div class="panel__setting">
        <span class="panel__setting-label">Color Format</span>
        <div class="select" data-ref="select">
          <button class="select__trigger" type="button" aria-haspopup="listbox" aria-expanded="false" data-ref="formatTrigger">
            <span data-ref="formatValue">HEX</span>
            <svg class="icon icon--chevron" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
          <ul class="select__menu" role="listbox" data-ref="formatMenu" hidden>
            <li><button type="button" data-format="hex" role="option">HEX</button></li>
            <li><button type="button" data-format="rgb" role="option">RGB</button></li>
            <li><button type="button" data-format="hsl" role="option">HSL</button></li>
          </ul>
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

interface PanelOptions {
  onStartPicker: () => void;
}

export class PanelController {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private panelEl: HTMLElement | null = null;
  private closeTimer = 0;
  private toastTimer = 0;
  private settings: Settings = {
    lightMode: false,
    colorFormat: "hex",
    recentColors: [],
  };
  private hadRecentColors = false;

  constructor(private readonly options: PanelOptions) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes.pickhue_settings) {
        return;
      }
      const previousLength = this.settings.recentColors.length;
      this.settings = {
        ...this.settings,
        ...(changes.pickhue_settings.newValue as Settings),
      };
      if (this.isOpen) {
        this.renderSettings();
        this.renderRecentColors(
          previousLength === 0 && this.settings.recentColors.length > 0
        );
      }
    });
  }

  get isOpen(): boolean {
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
      requestAnimationFrame(() => this.panelEl?.classList.add("is-open"));
      return;
    }

    this.settings = await getSettings();
    this.hadRecentColors = this.settings.recentColors.length > 0;
    this.mount();
    this.renderSettings();
    this.renderRecentColors();
    requestAnimationFrame(() => this.panelEl?.classList.add("is-open"));
  }

  hide(): void {
    if (!this.host || this.closeTimer) {
      return;
    }
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

  private mount(): void {
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

  private ref<T extends Element>(name: string): T | null {
    return this.shadow?.querySelector<T>(`[data-ref="${name}"]`) ?? null;
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
    scroller?.addEventListener(
      "wheel",
      (event) => {
        const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
        if (delta === 0 || scroller.scrollWidth <= scroller.clientWidth) {
          return;
        }
        event.preventDefault();
        scroller.scrollLeft += delta;
      },
      { passive: false }
    );

    this.ref<HTMLButtonElement>("toggle")?.addEventListener("click", () => {
      void this.toggleLightMode();
    });

    const formatTrigger = this.ref<HTMLButtonElement>("formatTrigger");
    const formatMenu = this.ref<HTMLUListElement>("formatMenu");

    formatTrigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      const expanded = formatTrigger.getAttribute("aria-expanded") === "true";
      formatTrigger.setAttribute("aria-expanded", expanded ? "false" : "true");
      if (formatMenu) {
        formatMenu.hidden = expanded;
      }
    });

    formatMenu?.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("click", () => {
        void this.updateColorFormat(button.dataset.format as ColorFormat);
        formatTrigger?.setAttribute("aria-expanded", "false");
        formatMenu.hidden = true;
      });
    });

    // Close the format menu when clicking elsewhere inside the panel.
    this.shadow?.addEventListener("click", (event) => {
      const select = this.ref<HTMLElement>("select");
      if (select && event.target instanceof Node && !select.contains(event.target)) {
        formatTrigger?.setAttribute("aria-expanded", "false");
        if (formatMenu) {
          formatMenu.hidden = true;
        }
      }
    });
  }

  private renderSettings(): void {
    const theme = this.settings.lightMode ? "light" : "dark";
    this.panelEl?.setAttribute("data-theme", theme);

    this.ref<HTMLButtonElement>("toggle")?.setAttribute(
      "aria-checked",
      this.settings.lightMode ? "true" : "false"
    );

    const formatValue = this.ref<HTMLElement>("formatValue");
    if (formatValue) {
      formatValue.textContent = formatLabels[this.settings.colorFormat];
    }

    this.ref<HTMLUListElement>("formatMenu")
      ?.querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) => {
        button.setAttribute(
          "aria-selected",
          button.dataset.format === this.settings.colorFormat ? "true" : "false"
        );
      });
  }

  private renderRecentColors(animateFirst = false): void {
    const track = this.ref<HTMLElement>("track");
    const empty = this.ref<HTMLElement>("empty");
    if (!track || !empty) {
      return;
    }

    const isEmpty = this.settings.recentColors.length === 0;
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

  private async toggleLightMode(): Promise<void> {
    this.settings = await saveSettings({ lightMode: !this.settings.lightMode });
    this.renderSettings();
  }

  private async updateColorFormat(format: ColorFormat): Promise<void> {
    if (!format) {
      return;
    }
    this.settings = await saveSettings({ colorFormat: format });
    this.renderSettings();
    this.renderRecentColors();
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
