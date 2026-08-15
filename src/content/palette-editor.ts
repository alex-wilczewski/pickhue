import { buildColorRamp } from "../shared/accent";
import { copyText } from "../shared/clipboard";
import { formatColor, parseHex } from "../shared/colors";
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
    ramp.setAttribute("aria-label", `Shades of ${label}`);
    ramp.innerHTML = RAMP_ICON_HTML;
    ramp.addEventListener("click", (event) => {
      event.stopPropagation();
      this.callbacks.getSwatchTooltip()?.hide();
      this.showRampOverlay(hex);
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
   * Shades & tints: a Tailwind-scale OKLCH ramp of the swatch. Click copies a
   * step; the hover + adds it to the palette without closing the overlay (the
   * grid re-syncs when the overlay closes).
   */
  private showRampOverlay(baseHex: string): void {
    if (!this.palette) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.className =
      "palette-editor__confirm-overlay palette-editor__ramp-overlay";

    const dialog = document.createElement("div");
    dialog.className =
      "palette-editor__confirm-dialog palette-editor__ramp-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Shades and tints");

    const title = document.createElement("p");
    title.className = "palette-editor__confirm-title";
    title.textContent = "Shades & tints";

    const base = document.createElement("p");
    base.className = "palette-editor__ramp-base";
    const baseDot = document.createElement("span");
    baseDot.className = "palette-editor__ramp-base-dot";
    baseDot.style.backgroundColor = baseHex;
    base.append(baseDot, formatColor(baseHex, this.colorFormat));

    const grid = document.createElement("div");
    grid.className = "palette-editor__ramp-grid";

    const close = (): void => {
      overlay.remove();
      document.removeEventListener("keydown", onEscape, true);
      // Adds were applied without re-rendering; sync the grid now.
      this.render();
    };

    for (const step of buildColorRamp(baseHex)) {
      const cell = document.createElement("div");
      cell.className = "palette-editor__ramp-cell";

      const stepBtn = document.createElement("button");
      stepBtn.type = "button";
      stepBtn.className = "palette-editor__ramp-step";
      if (step.isBase) {
        stepBtn.classList.add("is-base");
      }
      stepBtn.style.backgroundColor = step.hex;
      const formatted = formatColor(step.hex, this.colorFormat);
      stepBtn.setAttribute("aria-label", `Copy ${formatted}`);

      const stepLabel = document.createElement("span");
      stepLabel.className = "palette-editor__ramp-step-label";
      stepLabel.textContent = step.label;
      const { r, g, b } = parseHex(step.hex);
      stepLabel.style.color =
        0.299 * r + 0.587 * g + 0.114 * b > 145 ? "#141414" : "#f6f6f6";
      stepBtn.append(stepLabel);

      stepBtn.addEventListener("click", () => {
        copyText(formatted);
        this.callbacks.onToast(`Copied ${formatted}`, step.hex);
      });

      const add = document.createElement("button");
      add.type = "button";
      add.className = "palette-editor__ramp-add";
      const syncAdded = (): void => {
        const added = Boolean(this.palette?.colors.includes(step.hex));
        add.classList.toggle("is-added", added);
        add.disabled = added;
        add.innerHTML = added ? CHECK_SWATCH_ICON_HTML : PLUS_ICON_HTML;
        add.setAttribute(
          "aria-label",
          added ? `${formatted} in palette` : `Add ${formatted} to palette`
        );
      };
      syncAdded();
      add.addEventListener("click", (event) => {
        event.stopPropagation();
        void this.addRampColor(step.hex).then(syncAdded);
      });

      cell.append(stepBtn, add);
      grid.append(cell);
    }

    const actions = document.createElement("div");
    actions.className = "palette-editor__confirm-actions";
    const done = document.createElement("button");
    done.type = "button";
    done.className = "palette-editor__action-btn";
    done.textContent = "Done";
    done.addEventListener("click", close);
    actions.append(done);

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

    dialog.append(title, base, grid, actions);
    overlay.append(dialog);
    this.container.append(overlay);
    done.focus();
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
