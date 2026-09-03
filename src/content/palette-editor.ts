import { buildColorRamp, contrastRatio, hexToOklch, oklchToHex } from "../shared/accent";
import { copyText } from "../shared/clipboard";
import { COLOR_FORMATS, formatColor, parseHex } from "../shared/colors";
import { parseHexInput } from "../shared/palette-io";
import {
  exportPaletteAseFile,
  exportPalettesCss,
  exportPalettesHexList,
  exportPalettesTailwind,
} from "../shared/palette-formats";
import { exportPalette } from "../shared/palette-io";
import {
  addColorToPalette,
  addColorsToPalette,
  createPalette,
  deletePalette,
  getPalette,
  removeColorFromPalette,
  reorderPaletteColor,
  StorageQuotaError,
  updatePalette,
} from "../shared/storage";
import type { ColorFormat, ColorPalette } from "../shared/types";
import {
  CANCEL_ACTION_ICON_HTML,
  CHECK_SWATCH_ICON_HTML,
  DELETE_BUTTON_HTML,
  DELETE_ICON_HTML,
  DUPLICATE_ICON_HTML,
  ELLIPSIS_ICON_HTML,
  EXPORT_BACKUP_ICON_HTML,
  EXPORT_CODE_ICON_HTML,
  EXPORT_FILE_ICON_HTML,
  EXPORT_ICON_HTML,
  EXPORT_LIST_ICON_HTML,
  EXPORT_TAILWIND_ICON_HTML,
  PLUS_ICON_HTML,
  RAMP_ICON_HTML,
  REMOVE_SWATCH_ICON_HTML,
} from "./icons";
import { showActionMenu } from "./palette-menu";
import type { SwatchTooltipController } from "./swatch-tooltip";
import { bindSwatchTrack, syncTrackOverflow } from "./swatch-track";

export interface PaletteEditorCallbacks {
  onBack: () => void;
  onToast: (message: string, hex?: string) => void;
  onPaletteChanged: () => void;
  onLayoutChange: () => void;
  getSwatchTooltip: () => SwatchTooltipController | null;
  onSelectColor: () => void;
}

export interface PaletteEditorOpenOptions {
  focusName?: boolean;
}

export class PaletteEditorView {
  private palette: ColorPalette | null = null;
  private recentColors: string[] = [];
  private colorFormat: ColorFormat = "hex";
  private nameEdited = false;
  private savedName = "";
  private committingTitle = false;
  private nameSavedTimer = 0;
  private recentsScrollLeft = 0;
  private readonly container: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly callbacks: PaletteEditorCallbacks
  ) {
    this.container = container;
    this.container.classList.add("palette-editor");
  }

  async open(
    palette: ColorPalette,
    recentColors: string[],
    colorFormat: ColorFormat,
    options?: PaletteEditorOpenOptions
  ): Promise<void> {
    if (palette.id !== this.palette?.id) {
      this.recentsScrollLeft = 0;
    }
    this.palette = { ...palette, colors: [...palette.colors] };
    this.recentColors = recentColors;
    this.colorFormat = colorFormat;
    this.nameEdited = palette.name !== "Untitled palette";
    this.savedName = palette.name;
    this.render();
    if (options?.focusName) {
      requestAnimationFrame(() => {
        const nameInput = this.container.querySelector<HTMLInputElement>(
          ".palette-editor__name"
        );
        if (!nameInput) {
          return;
        }
        nameInput.focus();
        nameInput.select();
      });
    }
  }

  async refreshFromStorage(): Promise<void> {
    if (!this.palette) {
      return;
    }
    const latest = await getPalette(this.palette.id);
    if (!latest) {
      return;
    }

    const nameInput = this.container.querySelector<HTMLInputElement>(
      ".palette-editor__name"
    );
    const active = this.getActiveElement();
    const editingTitle = active === nameInput;

    this.palette = { ...latest, colors: [...latest.colors] };
    this.savedName = latest.name;

    if (editingTitle && nameInput) {
      return;
    }

    this.render();
  }

  getPaletteId(): string | null {
    return this.palette?.id ?? null;
  }

  getPalette(): ColorPalette | null {
    return this.palette;
  }

  async commitTitle(): Promise<void> {
    const nameInput = this.container.querySelector<HTMLInputElement>(
      ".palette-editor__name"
    );
    if (!nameInput || !this.palette || this.committingTitle) {
      return;
    }

    this.committingTitle = true;
    try {
      await this.confirmNameInput(nameInput);
      nameInput.blur();
    } finally {
      this.committingTitle = false;
    }
  }

  private getActiveElement(): Element | null {
    const root = this.container.getRootNode();
    if (root instanceof ShadowRoot) {
      return root.activeElement;
    }
    return document.activeElement;
  }

  async handleBack(): Promise<void> {
    if (!this.palette) {
      this.callbacks.onBack();
      return;
    }

    const nameInput = this.container.querySelector<HTMLInputElement>(
      ".palette-editor__name"
    );
    if (nameInput) {
      const trimmed = nameInput.value.trim() || "Untitled palette";
      if (trimmed !== this.savedName) {
        await this.confirmNameInput(nameInput);
      }
    }

    if (this.palette.colors.length === 0 && !this.nameEdited) {
      await deletePalette(this.palette.id);
      this.callbacks.onPaletteChanged();
    }

    this.palette = null;
    this.callbacks.onBack();
  }

  private async confirmNameInput(nameInput: HTMLInputElement): Promise<void> {
    if (!this.palette) {
      return;
    }

    const trimmed = nameInput.value.trim();
    const nextName = trimmed || "Untitled palette";
    if (nameInput.value !== nextName) {
      nameInput.value = nextName;
    }

    this.nameEdited = true;

    if (nextName !== this.savedName) {
      this.palette.name = nextName;
      await this.persistName(nextName, nameInput);
      return;
    }

    this.palette.name = nextName;
    this.flashNameSaved(nameInput);
  }

  private render(): void {
    const palette = this.palette;
    this.callbacks.getSwatchTooltip()?.hide();
    if (!palette) {
      this.container.replaceChildren();
      return;
    }

    this.container.replaceChildren();

    const header = document.createElement("div");
    header.className = "palette-editor__header";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "palette-editor__name";
    nameInput.value = palette.name;
    nameInput.maxLength = 48;
    nameInput.setAttribute("aria-label", "Palette name");
    nameInput.addEventListener("input", () => {
      this.nameEdited = true;
      nameInput.classList.remove("is-saved");
    });
    nameInput.addEventListener("focus", () => {
      nameInput.classList.remove("is-saved");
    });
    nameInput.addEventListener("blur", () => {
      if (this.committingTitle) {
        return;
      }
      void this.confirmNameInput(nameInput);
    });
    nameInput.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter") {
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        void this.commitTitle();
      },
      true
    );
    nameInput.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.stopPropagation();
    });

    header.append(nameInput);

    const meta = document.createElement("div");
    meta.className = "palette-editor__meta";

    const count = document.createElement("span");
    count.className = "palette-editor__count";
    const n = palette.colors.length;
    count.textContent = `${n} ${n === 1 ? "color" : "colors"}`;

    const metaActions = document.createElement("span");
    metaActions.className = "palette-editor__meta-actions";

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "palette-editor__export-btn";
    exportBtn.innerHTML = `${EXPORT_ICON_HTML}<span>Export</span>`;
    exportBtn.disabled = n === 0;
    exportBtn.addEventListener("click", (event) => {
      this.showExportMenu(event.currentTarget as HTMLButtonElement);
    });

    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "palette-editor__more-btn";
    moreBtn.setAttribute("aria-label", "Palette actions");
    moreBtn.innerHTML = ELLIPSIS_ICON_HTML;
    moreBtn.addEventListener("click", (event) => {
      this.showMoreMenu(event.currentTarget as HTMLButtonElement);
    });

    metaActions.append(exportBtn, moreBtn);
    meta.append(count, metaActions);
    header.append(meta);

    const swatchSection = document.createElement("div");
    swatchSection.className = "palette-editor__swatches-wrap";

    if (palette.colors.length === 0) {
      const emptyBox = document.createElement("div");
      emptyBox.className = "palette-editor__swatches";
      const empty = document.createElement("p");
      empty.className = "palette-editor__empty";
      empty.append("No colors yet — use ");
      const selectLink = document.createElement("button");
      selectLink.type = "button";
      selectLink.className = "panel__section-action palette-editor__empty-action";
      selectLink.textContent = "Select Color";
      selectLink.addEventListener("click", () => {
        this.callbacks.onSelectColor();
      });
      empty.append(selectLink, " below.");
      emptyBox.append(empty);
      swatchSection.append(emptyBox);
    } else {
      const swatchBox = document.createElement("div");
      swatchBox.className = "palette-editor__swatches";
      swatchBox.setAttribute("role", "list");

      const grid = document.createElement("div");
      grid.className = "palette-editor__swatches-grid";

      for (const hex of palette.colors) {
        grid.append(this.createSwatchItem(hex));
      }

      swatchBox.append(grid);
      swatchSection.append(swatchBox);
      this.setupDragReorder(grid);
    }

    const addSection = document.createElement("div");
    addSection.className = "palette-editor__add";

    const pasteRow = document.createElement("div");
    pasteRow.className = "palette-editor__paste";
    const pasteInput = document.createElement("input");
    pasteInput.type = "text";
    pasteInput.className = "palette-editor__paste-input";
    pasteInput.placeholder = "#hex or paste list";
    // Border reflects parseability before Add is ever pressed.
    const syncPasteValidity = (): void => {
      const value = pasteInput.value.trim();
      const hasColors = value.length > 0 && parseHexInput(value).length > 0;
      pasteInput.classList.toggle("is-valid", hasColors);
      pasteInput.classList.toggle("is-invalid", value.length > 0 && !hasColors);
    };
    const submitPaste = (): void => {
      void this.addFromPaste(pasteInput.value);
      pasteInput.value = "";
      syncPasteValidity();
    };
    pasteInput.addEventListener("input", syncPasteValidity);
    pasteInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        submitPaste();
      }
    });
    pasteInput.addEventListener("keyup", (event) => {
      event.stopPropagation();
    });
    const pasteBtn = document.createElement("button");
    pasteBtn.type = "button";
    pasteBtn.className = "palette-editor__add-btn palette-editor__add-btn--icon";
    pasteBtn.setAttribute("aria-label", "Add colors");
    pasteBtn.innerHTML = PLUS_ICON_HTML;
    pasteBtn.addEventListener("click", submitPaste);
    pasteRow.append(pasteInput, pasteBtn);

    addSection.append(pasteRow);

    this.container.append(
      header,
      swatchSection,
      this.createRecentsStrip(),
      addSection
    );
    this.restoreRecentsScroll();
    requestAnimationFrame(() => this.callbacks.onLayoutChange());
  }

  /**
   * Inline recents track — same 44px scroller the home view uses, so a color
   * goes into the palette in one click instead of a modal round trip.
   */
  private createRecentsStrip(): HTMLElement {
    const section = document.createElement("div");
    section.className = "palette-editor__recents";

    const label = document.createElement("h3");
    label.className = "palette-editor__recents-label";
    label.textContent = "Recents";

    const wrap = document.createElement("div");
    wrap.className = "panel__swatches-wrap palette-editor__recents-track";

    const empty = document.createElement("p");
    empty.className = "panel__swatches-empty palette-editor__recents-empty";
    empty.textContent = "Colors you pick will show up here.";

    const scroller = document.createElement("div");
    scroller.className = "panel__swatches";
    scroller.setAttribute("role", "list");

    const inner = document.createElement("div");
    inner.className = "panel__swatches-inner";

    const isEmpty = this.recentColors.length === 0;
    empty.hidden = !isEmpty;
    wrap.classList.toggle("is-empty", isEmpty);

    const inPalette = new Set(this.palette?.colors ?? []);

    for (const hex of this.recentColors) {
      inner.append(this.createRecentItem(hex, inPalette.has(hex)));
    }

    scroller.append(inner);
    wrap.append(empty, scroller);
    section.append(label, wrap);

    bindSwatchTrack(scroller, {
      onScroll: () => this.callbacks.getSwatchTooltip()?.hide(),
      onSettle: (scrollLeft) => {
        this.recentsScrollLeft = scrollLeft;
      },
    });

    return section;
  }

  /**
   * Toggling a color re-renders the editor, which would otherwise drop the
   * recents strip back to offset 0 and re-apply the edge fades a frame later —
   * read as the gradient blinking out and back. Restore synchronously, before
   * the browser paints the new strip.
   */
  private restoreRecentsScroll(): void {
    const scroller = this.container.querySelector<HTMLElement>(
      ".palette-editor__recents-track .panel__swatches"
    );
    if (!scroller) {
      return;
    }
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = Math.min(this.recentsScrollLeft, maxScroll);
    this.recentsScrollLeft = scroller.scrollLeft;
    syncTrackOverflow(scroller);
  }

  private createRecentItem(hex: string, added: boolean): HTMLElement {
    const item = document.createElement("div");
    item.className = "swatch-item palette-editor__recents-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch palette-editor__recents-swatch";
    button.style.backgroundColor = hex;
    button.classList.toggle("is-added", added);
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-pressed", added ? "true" : "false");

    const label = formatColor(hex, this.colorFormat);
    button.setAttribute(
      "aria-label",
      added ? `Remove ${label} from palette` : `Add ${label} to palette`
    );
    button.addEventListener("click", () => {
      void this.toggleRecent(hex);
    });

    const check = document.createElement("span");
    check.className = "palette-editor__recents-check";
    check.innerHTML = CHECK_SWATCH_ICON_HTML;
    check.setAttribute("aria-hidden", "true");

    item.append(button, check);
    this.callbacks.getSwatchTooltip()?.attach(item, () =>
      formatColor(hex, this.colorFormat)
    );
    return item;
  }

  private async toggleRecent(hex: string): Promise<void> {
    if (!this.palette) {
      return;
    }
    this.callbacks.getSwatchTooltip()?.hide();
    if (this.palette.colors.includes(hex)) {
      await this.removeColor(hex);
      return;
    }
    await this.addFromRecents([hex]);
  }

  private createSwatchItem(hex: string): HTMLElement {
    const item = document.createElement("div");
    item.className = "palette-editor__swatch-item";
    item.draggable = true;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.style.backgroundColor = hex;
    const label = formatColor(hex, this.colorFormat);
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", `Copy ${label}`);
    button.addEventListener("click", () => {
      const formatted = formatColor(hex, this.colorFormat);
      copyText(formatted);
      this.callbacks.onToast(`Copied ${formatted}`, hex);
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.callbacks.getSwatchTooltip()?.hide();
      showActionMenu(
        this.container.getRootNode() as Document | ShadowRoot,
        button,
        COLOR_FORMATS.map((option) => ({
          label: `${option.label} · ${formatColor(hex, option.value)}`,
          action: () => {
            const formatted = formatColor(hex, option.value);
            copyText(formatted);
            this.callbacks.onToast(`Copied ${formatted}`, hex);
          },
        }))
      );
    });
    // Keyboard reorder: arrows move the focused color, Shift jumps to the ends.
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      const colors = this.palette?.colors ?? [];
      const index = colors.indexOf(hex);
      if (index < 0 || colors.length < 2) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const dir = event.key === "ArrowLeft" ? -1 : 1;
      const to = event.shiftKey
        ? dir < 0
          ? 0
          : colors.length - 1
        : Math.min(colors.length - 1, Math.max(0, index + dir));
      if (to !== index) {
        void this.reorderColors(index, to, true);
      }
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "palette-editor__remove";
    remove.setAttribute("aria-label", "Remove color");
    remove.innerHTML = REMOVE_SWATCH_ICON_HTML;
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      this.callbacks.getSwatchTooltip()?.hide();
      void this.removeColor(hex);
    });

    const ramp = document.createElement("button");
    ramp.type = "button";
    ramp.className = "palette-editor__ramp-btn";
    ramp.setAttribute("aria-label", `Color card for ${label}`);
    ramp.innerHTML = RAMP_ICON_HTML;
    ramp.addEventListener("click", (event) => {
      event.stopPropagation();
      this.callbacks.getSwatchTooltip()?.hide();
      this.showColorCard(hex);
    });

    let blockDrag = false;
    const blockDragFrom = (el: HTMLElement): void => {
      el.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        blockDrag = true;
      });
    };
    blockDragFrom(ramp);
    remove.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      blockDrag = true;
    });
    item.addEventListener("pointerdown", (event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".palette-editor__remove, .palette-editor__ramp-btn")
      ) {
        blockDrag = false;
      }
    });
    item.addEventListener("dragstart", (event) => {
      this.callbacks.getSwatchTooltip()?.hide();
      if (blockDrag) {
        event.preventDefault();
      }
    });

    item.append(button, remove, ramp);
    this.callbacks.getSwatchTooltip()?.attach(item, () =>
      formatColor(hex, this.colorFormat)
    );
    return item;
  }

  /*
   * The Color Card: one overlay per swatch holding the tune sliders (OKLCH),
   * the Tailwind-scale ramp, and contrast checks against white/black and the
   * rest of the palette. Everything updates live as the color is tuned; adds
   * and replaces apply without re-rendering (the grid re-syncs on close).
   */
  private showColorCard(baseHex: string): void {
    if (!this.palette) {
      return;
    }

    let base = baseHex.toUpperCase();
    const initial = hexToOklch(base);
    const state = { L: initial.L, C: initial.C, h: (initial.h + 360) % 360 };
    let tuned = base;

    const overlay = document.createElement("div");
    overlay.className =
      "palette-editor__confirm-overlay palette-editor__card-overlay";

    const dialog = document.createElement("div");
    dialog.className =
      "palette-editor__confirm-dialog palette-editor__card-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Color card");

    /* -- header: live preview + value, click copies -- */
    const head = document.createElement("div");
    head.className = "palette-editor__card-head";
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "palette-editor__card-preview";
    const value = document.createElement("button");
    value.type = "button";
    value.className = "palette-editor__card-value";
    const copyTuned = (): void => {
      const formatted = formatColor(tuned, this.colorFormat);
      copyText(formatted);
      this.callbacks.onToast(`Copied ${formatted}`, tuned);
    };
    preview.addEventListener("click", copyTuned);
    value.addEventListener("click", copyTuned);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "palette-editor__card-close";
    closeBtn.setAttribute("aria-label", "Close color card");
    closeBtn.innerHTML = CANCEL_ACTION_ICON_HTML;
    head.append(preview, value, closeBtn);

    /* -- tune sliders -- */
    const tuneLabel = document.createElement("p");
    tuneLabel.className = "palette-editor__card-section-label";
    tuneLabel.textContent = "Tune";
    const sliders = document.createElement("div");
    sliders.className = "palette-editor__card-sliders";
    /*
     * The gradient lives on a wrapper pill, NOT the input: Chrome's range
     * internals keep painting artifacts into styled inputs, so the input is a
     * fully transparent overlay that contributes only the thumb.
     */
    const makeSlider = (
      label: string,
      min: number,
      max: number,
      step: number,
      get: () => number,
      set: (v: number) => void
    ): { input: HTMLInputElement; track: HTMLSpanElement } => {
      const row = document.createElement("label");
      row.className = "palette-editor__card-slider";
      const tag = document.createElement("span");
      tag.className = "palette-editor__card-slider-label";
      tag.textContent = label;
      const track = document.createElement("span");
      track.className = "palette-editor__card-slider-track";
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(get());
      input.setAttribute("aria-label", `${label} slider`);
      input.addEventListener("input", () => {
        set(Number(input.value));
        refresh();
      });
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
      });
      track.append(input);
      row.append(tag, track);
      sliders.append(row);
      return { input, track };
    };
    const { input: lSlider, track: lTrack } = makeSlider(
      "L", 0, 100, 0.5,
      () => state.L * 100,
      (v) => { state.L = v / 100; }
    );
    const { input: cSlider, track: cTrack } = makeSlider(
      "C", 0, 0.37, 0.002,
      () => state.C,
      (v) => { state.C = v; }
    );
    const { input: hSlider, track: hTrack } = makeSlider(
      "H", 0, 360, 1,
      () => state.h,
      (v) => { state.h = v; }
    );

    /* -- actions on the tuned color -- */
    const actions = document.createElement("div");
    actions.className = "palette-editor__confirm-actions";
    /* Staged ramp steps + the tuned color commit together on Add. */
    const staged = new Set<string>();
    const pendingColors = (): string[] => {
      const colors = [...staged];
      if (
        tuned !== base &&
        !staged.has(tuned) &&
        !this.palette?.colors.includes(tuned)
      ) {
        colors.push(tuned);
      }
      return colors.filter((hex) => !this.palette?.colors.includes(hex));
    };

    const replaceBtn = document.createElement("button");
    replaceBtn.type = "button";
    replaceBtn.className = "palette-editor__action-btn";
    replaceBtn.textContent = "Replace";
    replaceBtn.addEventListener("click", () => {
      void this.replaceCardColor(base, tuned).then((replaced) => {
        if (replaced) {
          this.callbacks.onToast("Color replaced", tuned);
          close();
        }
      });
    });
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className =
      "palette-editor__action-btn panel__modal-btn--accent palette-editor__card-add";
    addBtn.textContent = "Add";
    addBtn.addEventListener("click", () => {
      const colors = pendingColors();
      if (colors.length === 0) {
        return;
      }
      void this.addCardColors(colors).then(() => {
        this.callbacks.onToast(
          colors.length === 1
            ? `Added ${formatColor(colors[0]!, this.colorFormat)}`
            : `Added ${colors.length} colors`,
          colors[0]
        );
        close();
      });
    });
    actions.append(replaceBtn, addBtn);

    /* -- ramp -- */
    const rampLabel = document.createElement("p");
    rampLabel.className = "palette-editor__card-section-label";
    rampLabel.textContent = "Shades & tints";
    const grid = document.createElement("div");
    grid.className = "palette-editor__ramp-grid";

    /* -- contrast: collapsed by default so color + ramp keep priority -- */
    const contrastToggle = document.createElement("button");
    contrastToggle.type = "button";
    contrastToggle.className =
      "palette-editor__card-section-label palette-editor__card-section-toggle";
    contrastToggle.innerHTML =
      '<span>Contrast</span><svg class="icon" viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    contrastToggle.setAttribute("aria-expanded", "false");
    const contrastList = document.createElement("div");
    contrastList.className = "palette-editor__card-contrast";
    contrastList.hidden = true;
    contrastToggle.addEventListener("click", () => {
      contrastList.hidden = !contrastList.hidden;
      contrastToggle.setAttribute(
        "aria-expanded",
        contrastList.hidden ? "false" : "true"
      );
      contrastToggle.classList.toggle("is-open", !contrastList.hidden);
    });

    const close = (): void => {
      overlay.remove();
      document.removeEventListener("keydown", onEscape, true);
      this.render();
    };
    closeBtn.addEventListener("click", close);

    /*
     * The ramp stays anchored to the swatch the card was opened for. Tapping
     * a step STAGES it (accent ring); tapping again unstages. Nothing touches
     * the palette until Add commits the staged set. Steps already in the
     * palette are inert and wear the ✓ marker.
     */
    const rampSource = base;
    const renderRamp = (): void => {
      grid.replaceChildren();
      for (const step of buildColorRamp(rampSource)) {
        const cell = document.createElement("div");
        cell.className = "palette-editor__ramp-cell";
        const stepBtn = document.createElement("button");
        stepBtn.type = "button";
        stepBtn.className = "palette-editor__ramp-step";
        stepBtn.style.backgroundColor = step.hex;
        const formatted = formatColor(step.hex, this.colorFormat);
        const inPalette = Boolean(this.palette?.colors.includes(step.hex));
        stepBtn.classList.toggle("is-staged", staged.has(step.hex));
        stepBtn.setAttribute(
          "aria-label",
          inPalette
            ? `${formatted} in palette`
            : staged.has(step.hex)
              ? `Unstage ${formatted}`
              : `Stage ${formatted}`
        );
        stepBtn.setAttribute(
          "aria-pressed",
          staged.has(step.hex) ? "true" : "false"
        );
        const stepLabel = document.createElement("span");
        stepLabel.className = "palette-editor__ramp-step-label";
        stepLabel.textContent = step.label;
        const { r, g, b } = parseHex(step.hex);
        stepLabel.style.color =
          0.299 * r + 0.587 * g + 0.114 * b > 145 ? "#141414" : "#f6f6f6";
        stepBtn.append(stepLabel);
        if (inPalette) {
          stepBtn.disabled = true;
          const marker = document.createElement("span");
          marker.className = "palette-editor__ramp-added-marker";
          marker.innerHTML = CHECK_SWATCH_ICON_HTML;
          marker.setAttribute("aria-hidden", "true");
          cell.append(marker);
        } else {
          stepBtn.addEventListener("click", () => {
            if (staged.has(step.hex)) {
              staged.delete(step.hex);
            } else {
              staged.add(step.hex);
            }
            refresh();
          });
        }
        cell.append(stepBtn);
        grid.append(cell);
      }
    };

    const renderContrast = (): void => {
      contrastList.replaceChildren();
      const others: Array<{ label: string; hex: string }> = [
        { label: "White", hex: "#FFFFFF" },
        { label: "Black", hex: "#000000" },
        ...(this.palette?.colors ?? [])
          .filter((c) => c !== base)
          .map((c) => ({ label: c, hex: c })),
      ];
      for (const other of others) {
        const row = document.createElement("div");
        row.className = "palette-editor__card-contrast-row";
        const chip = document.createElement("span");
        chip.className = "palette-editor__card-contrast-chip";
        chip.style.backgroundColor = other.hex;
        chip.style.color = tuned;
        chip.textContent = "Aa";
        const name = document.createElement("span");
        name.className = "palette-editor__card-contrast-name";
        name.textContent = other.label;
        const ratio = contrastRatio(tuned, other.hex);
        const ratioEl = document.createElement("span");
        ratioEl.className = "palette-editor__card-contrast-ratio";
        ratioEl.textContent = `${ratio.toFixed(2)}`;
        const level = document.createElement("span");
        level.className = "palette-editor__card-contrast-level";
        const grade =
          ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA·L" : "✕";
        level.textContent = grade;
        level.classList.toggle("is-fail", grade === "✕");
        row.append(chip, name, ratioEl, level);
        contrastList.append(row);
      }
    };

    const trackGradient = (stops: string[]): string =>
      `linear-gradient(to right, ${stops.join(", ")})`;

    const refresh = (): void => {
      tuned = oklchToHex(state.L, state.C, state.h).toUpperCase();
      preview.style.backgroundColor = tuned;
      const formatted = formatColor(tuned, this.colorFormat);
      value.textContent = formatted;
      preview.setAttribute("aria-label", `Copy ${formatted}`);

      lSlider.value = String(state.L * 100);
      cSlider.value = String(state.C);
      hSlider.value = String(state.h);
      for (const input of [lSlider, cSlider, hSlider]) {
        input.style.setProperty("--card-thumb", tuned);
      }

      const steps = (count: number, fn: (t: number) => string): string[] =>
        Array.from({ length: count }, (_, i) => fn(i / (count - 1)));
      lTrack.style.background = trackGradient(
        steps(9, (t) => oklchToHex(t, state.C, state.h))
      );
      cTrack.style.background = trackGradient(
        steps(9, (t) => oklchToHex(state.L, t * 0.37, state.h))
      );
      hTrack.style.background = trackGradient(
        steps(13, (t) => oklchToHex(state.L, Math.max(state.C, 0.08), t * 360))
      );

      const colors = this.palette?.colors ?? [];
      replaceBtn.disabled =
        tuned === base || colors.includes(tuned) || !colors.includes(base);
      const pending = pendingColors().length;
      addBtn.disabled = pending === 0;
      addBtn.textContent = pending > 1 ? `Add ${pending}` : "Add";

      renderRamp();
      renderContrast();
    };

    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      event.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onEscape, true);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close();
      }
    });

    dialog.append(
      head,
      tuneLabel,
      sliders,
      rampLabel,
      grid,
      contrastToggle,
      contrastList,
      actions
    );
    overlay.append(dialog);
    // Full-panel modal layer — the editor area alone is too short for the card.
    (this.container.closest(".panel") ?? this.container).append(overlay);
    refresh();
    closeBtn.focus();
  }

  /** Commits the staged card colors in one write. */
  private async addCardColors(hexes: string[]): Promise<void> {
    if (!this.palette || hexes.length === 0) {
      return;
    }
    try {
      const updated = await addColorsToPalette(this.palette.id, hexes);
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.callbacks.onPaletteChanged();
      }
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  /** Swap one palette color for the tuned value, preserving its position. */
  private async replaceCardColor(
    oldHex: string,
    newHex: string
  ): Promise<boolean> {
    if (!this.palette) {
      return false;
    }
    const colors = [...this.palette.colors];
    const index = colors.indexOf(oldHex);
    if (index < 0 || colors.includes(newHex)) {
      return false;
    }
    colors[index] = newHex;
    try {
      const updated = await updatePalette(this.palette.id, { colors });
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.callbacks.onPaletteChanged();
        return true;
      }
    } catch (error) {
      this.handleStorageError(error);
    }
    return false;
  }

  /** Adds a ramp step without re-rendering (would tear down the overlay). */
  private async addRampColor(hex: string): Promise<void> {
    if (!this.palette) {
      return;
    }
    try {
      const updated = await addColorsToPalette(this.palette.id, [hex]);
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.callbacks.onPaletteChanged();
      }
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  /*
   * Drag reorder with insertion-slot semantics: an accent bar shows the gap the
   * color will land in (slot k = before item k; slot n = after the last item).
   * Slots equal to the dragged item's own edges are no-ops and show no bar.
   */
  private setupDragReorder(track: HTMLElement): void {
    let dragIndex = -1;
    let insertSlot = -1;

    const items = (): HTMLElement[] =>
      [...track.querySelectorAll<HTMLElement>(".palette-editor__swatch-item")];

    const clearIndicator = (): void => {
      for (const el of items()) {
        el.classList.remove("is-insert-before", "is-insert-after");
      }
    };

    const showIndicator = (slot: number): void => {
      clearIndicator();
      const els = items();
      if (slot < els.length) {
        els[slot]?.classList.add("is-insert-before");
      } else {
        els[els.length - 1]?.classList.add("is-insert-after");
      }
    };

    for (const [index, item] of items().entries()) {
      item.addEventListener("dragstart", (event) => {
        dragIndex = index;
        insertSlot = -1;
        event.dataTransfer?.setData("text/plain", String(index));
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
        }
        item.classList.add("is-dragging");
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
        dragIndex = -1;
        insertSlot = -1;
        clearIndicator();
      });

      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        if (dragIndex < 0) {
          return;
        }
        const rect = item.getBoundingClientRect();
        const before = event.clientX < rect.left + rect.width / 2;
        const slot = items().indexOf(item) + (before ? 0 : 1);
        if (slot === dragIndex || slot === dragIndex + 1) {
          insertSlot = -1;
          clearIndicator();
          return;
        }
        insertSlot = slot;
        showIndicator(slot);
      });

      item.addEventListener("drop", (event) => {
        event.preventDefault();
        clearIndicator();
        if (dragIndex < 0 || insertSlot < 0) {
          return;
        }
        const to = insertSlot > dragIndex ? insertSlot - 1 : insertSlot;
        if (to !== dragIndex) {
          void this.reorderColors(dragIndex, to);
        }
        insertSlot = -1;
      });
    }

    track.addEventListener("dragleave", (event) => {
      const related = event.relatedTarget as Node | null;
      if (!related || !track.contains(related)) {
        clearIndicator();
        insertSlot = -1;
      }
    });
  }

  private async persistName(
    name: string,
    nameInput: HTMLInputElement
  ): Promise<void> {
    if (!this.palette) {
      return;
    }
    try {
      const updated = await updatePalette(this.palette.id, { name });
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.savedName = updated.name;
        this.callbacks.onPaletteChanged();
        this.flashNameSaved(nameInput);
      }
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private flashNameSaved(nameInput: HTMLInputElement): void {
    nameInput.classList.add("is-saved");
    window.clearTimeout(this.nameSavedTimer);
    this.nameSavedTimer = window.setTimeout(() => {
      nameInput.classList.remove("is-saved");
    }, 1500);
  }

  private async removeColor(hex: string): Promise<void> {
    if (!this.palette) {
      return;
    }
    try {
      const updated = await removeColorFromPalette(this.palette.id, hex);
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.callbacks.onPaletteChanged();
        this.render();
      }
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private async reorderColors(
    fromIndex: number,
    toIndex: number,
    focusAfter = false
  ): Promise<void> {
    if (!this.palette) {
      return;
    }
    try {
      const updated = await reorderPaletteColor(
        this.palette.id,
        fromIndex,
        toIndex
      );
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.callbacks.onPaletteChanged();
        this.render();
        if (focusAfter) {
          requestAnimationFrame(() => {
            const buttons = this.container.querySelectorAll<HTMLButtonElement>(
              ".palette-editor__swatch-item .swatch"
            );
            buttons[toIndex]?.focus();
          });
        }
      }
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private showDeleteConfirm(): void {
    if (!this.palette) {
      return;
    }

    const paletteName = this.palette.name.trim() || "this palette";
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
      void this.deleteCurrent();
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
    this.container.append(overlay);
    cancel.focus();
  }

  private async addFromRecents(hexes: string[]): Promise<void> {
    if (!this.palette || hexes.length === 0) {
      return;
    }
    try {
      const updated = await addColorsToPalette(this.palette.id, hexes);
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.callbacks.onPaletteChanged();
        this.render();
      }
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private async addFromPaste(input: string): Promise<void> {
    if (!this.palette || !input.trim()) {
      return;
    }
    try {
      const colors = parseHexInput(input);
      if (colors.length === 0) {
        this.callbacks.onToast("No valid colors found");
        return;
      }
      const updated = await addColorsToPalette(this.palette.id, colors);
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.callbacks.onPaletteChanged();
        this.render();
      }
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private showMoreMenu(anchor: HTMLButtonElement): void {
    if (!this.palette) {
      return;
    }
    showActionMenu(this.container.getRootNode() as Document | ShadowRoot, anchor, [
      {
        label: "Duplicate",
        iconHtml: DUPLICATE_ICON_HTML,
        action: () => this.duplicateCurrent(),
      },
      {
        label: "Delete",
        iconHtml: DELETE_ICON_HTML,
        danger: true,
        action: () => this.showDeleteConfirm(),
      },
    ]);
  }

  private async duplicateCurrent(): Promise<void> {
    if (!this.palette) {
      return;
    }
    try {
      const copy = await createPalette(
        `${this.palette.name} copy`.slice(0, 48),
        [...this.palette.colors]
      );
      this.callbacks.onPaletteChanged();
      await this.open(copy, this.recentColors, this.colorFormat);
      this.callbacks.onToast("Palette duplicated");
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private showExportMenu(anchor: HTMLButtonElement): void {
    if (!this.palette) {
      return;
    }
    const palette = this.palette;
    showActionMenu(this.container.getRootNode() as Document | ShadowRoot, anchor, [
      {
        label: "Hex list — Canva, anywhere",
        iconHtml: EXPORT_LIST_ICON_HTML,
        action: () => {
          copyText(exportPalettesHexList([palette]));
          this.callbacks.onToast("Hex list copied");
        },
      },
      {
        label: "CSS variables — Figma, code",
        iconHtml: EXPORT_CODE_ICON_HTML,
        action: () => {
          copyText(exportPalettesCss([palette]));
          this.callbacks.onToast("CSS variables copied");
        },
      },
      {
        label: "Tailwind config",
        iconHtml: EXPORT_TAILWIND_ICON_HTML,
        action: () => {
          copyText(exportPalettesTailwind([palette]));
          this.callbacks.onToast("Tailwind colors copied");
        },
      },
      {
        label: "Adobe ASE (.ase)",
        iconHtml: EXPORT_FILE_ICON_HTML,
        action: () => {
          exportPaletteAseFile(palette);
          this.callbacks.onToast("Downloaded .ase file");
        },
      },
      {
        label: "PickHue JSON (backup)",
        iconHtml: EXPORT_BACKUP_ICON_HTML,
        action: () => {
          copyText(exportPalette(palette));
          this.callbacks.onToast("JSON copied to clipboard");
        },
      },
    ]);
  }

  private async deleteCurrent(): Promise<void> {
    if (!this.palette) {
      return;
    }
    const id = this.palette.id;
    await deletePalette(id);
    this.palette = null;
    this.callbacks.onPaletteChanged();
    this.callbacks.onBack();
  }

  async appendPickedColor(hex: string): Promise<void> {
    if (!this.palette) {
      return;
    }
    try {
      const updated = await addColorToPalette(this.palette.id, hex);
      if (updated) {
        this.palette = { ...updated, colors: [...updated.colors] };
        this.callbacks.onPaletteChanged();
        this.render();
      }
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  private handleStorageError(error: unknown): void {
    if (error instanceof StorageQuotaError) {
      this.callbacks.onToast(
        "Storage full — delete a palette or export and remove old ones"
      );
      return;
    }
    if (error instanceof Error) {
      this.callbacks.onToast(error.message);
    }
  }
}
