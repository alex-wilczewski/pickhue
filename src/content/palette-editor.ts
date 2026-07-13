import { copyText } from "../shared/clipboard";
import { formatColor } from "../shared/colors";
import { parseHexInput } from "../shared/palette-io";
import {
  exportPaletteAseFile,
  exportPalettesCss,
  exportPalettesHexList,
} from "../shared/palette-formats";
import { exportPalette } from "../shared/palette-io";
import {
  addColorToPalette,
  addColorsToPalette,
  deletePalette,
  getPalette,
  removeColorFromPalette,
  reorderPaletteColor,
  StorageQuotaError,
  updatePalette,
} from "../shared/storage";
import type { ColorFormat, ColorPalette } from "../shared/types";
import { DELETE_BUTTON_HTML, REMOVE_SWATCH_ICON_HTML } from "./icons";
import { showActionMenu } from "./palette-menu";
import {
  SWATCH_TOOLTIP_DELAY_MS,
  type SwatchTooltipController,
} from "./swatch-tooltip";

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

    const recentsBtn = document.createElement("button");
    recentsBtn.type = "button";
    recentsBtn.className = "palette-editor__add-btn palette-editor__add-btn--recents";
    recentsBtn.textContent = "From Recents";
    recentsBtn.disabled = this.recentColors.length === 0;
    recentsBtn.addEventListener("click", () => {
      this.showRecentsPicker();
    });

    const pasteRow = document.createElement("div");
    pasteRow.className = "palette-editor__paste";
    const pasteInput = document.createElement("input");
    pasteInput.type = "text";
    pasteInput.className = "palette-editor__paste-input";
    pasteInput.placeholder = "#hex or paste list";
    pasteInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        void this.addFromPaste(pasteInput.value);
        pasteInput.value = "";
      }
    });
    pasteInput.addEventListener("keyup", (event) => {
      event.stopPropagation();
    });
    const pasteBtn = document.createElement("button");
    pasteBtn.type = "button";
    pasteBtn.className = "palette-editor__add-btn";
    pasteBtn.textContent = "Add";
    pasteBtn.addEventListener("click", () => {
      void this.addFromPaste(pasteInput.value);
      pasteInput.value = "";
    });
    pasteRow.append(pasteInput, pasteBtn);

    addSection.append(recentsBtn, pasteRow);

    const actions = document.createElement("div");
    actions.className = "palette-editor__actions";
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "palette-editor__action-btn";
    exportBtn.textContent = "Export";
    exportBtn.addEventListener("click", (event) => {
      this.showExportMenu(event.currentTarget as HTMLButtonElement);
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className =
      "palette-editor__action-btn palette-editor__action-btn--danger palette-editor__action-btn--with-icon";
    deleteBtn.innerHTML = DELETE_BUTTON_HTML;
    deleteBtn.addEventListener("click", () => {
      this.showDeleteConfirm();
    });
    actions.append(exportBtn, deleteBtn);

    this.container.append(header, swatchSection, addSection, actions);
    requestAnimationFrame(() => this.callbacks.onLayoutChange());
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

    let blockDrag = false;
    remove.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      blockDrag = true;
    });
    item.addEventListener("pointerdown", (event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".palette-editor__remove")
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

    item.append(button, remove);
    this.callbacks.getSwatchTooltip()?.attach(item, () =>
      formatColor(hex, this.colorFormat)
    );
    return item;
  }

  private setupDragReorder(track: HTMLElement): void {
    let dragIndex = -1;

    const items = (): HTMLElement[] =>
      [...track.querySelectorAll<HTMLElement>(".palette-editor__swatch-item")];

    for (const [index, item] of items().entries()) {
      item.addEventListener("dragstart", (event) => {
        dragIndex = index;
        event.dataTransfer?.setData("text/plain", String(index));
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
        }
        item.classList.add("is-dragging");
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
        dragIndex = -1;
        for (const el of items()) {
          el.classList.remove("is-drop-target");
        }
      });

      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        for (const el of items()) {
          el.classList.remove("is-drop-target");
        }
        item.classList.add("is-drop-target");
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("is-drop-target");
      });

      item.addEventListener("drop", (event) => {
        event.preventDefault();
        const dropIndex = items().indexOf(item);
        item.classList.remove("is-drop-target");
        if (dragIndex >= 0 && dropIndex >= 0 && dragIndex !== dropIndex) {
          void this.reorderColors(dragIndex, dropIndex);
        }
      });
    }
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

  private async reorderColors(fromIndex: number, toIndex: number): Promise<void> {
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

  private showRecentsPicker(): void {
    if (!this.palette) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "palette-editor__recents-overlay";

    const dialog = document.createElement("div");
    dialog.className = "palette-editor__recents-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "From Recents");

    const title = document.createElement("p");
    title.className = "palette-editor__recents-title";
    title.textContent = "From Recents";

    const swatchBox = document.createElement("div");
    swatchBox.className = "palette-editor__swatches palette-editor__recents-swatches";

    const grid = document.createElement("div");
    grid.className = "palette-editor__swatches-grid";

    const tooltip = document.createElement("div");
    tooltip.className = "swatch-tooltip palette-editor__recents-tooltip";
    tooltip.hidden = true;
    tooltip.setAttribute("role", "tooltip");

    const selected = new Set<string>();
    let tipTimer = 0;
    let tipAnchor: HTMLElement | null = null;

    const hideTip = (): void => {
      window.clearTimeout(tipTimer);
      tipTimer = 0;
      tipAnchor = null;
      tooltip.hidden = true;
      tooltip.textContent = "";
    };

    const positionTooltip = (anchor: HTMLElement): void => {
      const dialogRect = dialog.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const tipWidth = tooltip.offsetWidth;
      const tipHeight = tooltip.offsetHeight;
      const left =
        anchorRect.left -
        dialogRect.left +
        anchorRect.width / 2 -
        tipWidth / 2;
      let top = anchorRect.bottom - dialogRect.top + 6;
      const maxTop = Math.max(4, dialog.clientHeight - tipHeight - 4);
      if (top > maxTop) {
        top = anchorRect.top - dialogRect.top - tipHeight - 6;
      }
      tooltip.style.left = `${Math.max(4, Math.min(left, dialog.clientWidth - tipWidth - 4))}px`;
      tooltip.style.top = `${Math.max(4, Math.min(top, maxTop))}px`;
    };

    const scheduleTip = (anchor: HTMLElement, hex: string): void => {
      window.clearTimeout(tipTimer);
      tipTimer = window.setTimeout(() => {
        tipAnchor = anchor;
        tooltip.textContent = formatColor(hex, this.colorFormat);
        tooltip.hidden = false;
        positionTooltip(anchor);
      }, SWATCH_TOOLTIP_DELAY_MS);
    };

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "palette-editor__recents-confirm";
    confirm.textContent = "Add";
    confirm.disabled = true;

    const syncConfirm = (): void => {
      confirm.disabled = selected.size === 0;
    };

    for (const hex of this.recentColors) {
      const item = document.createElement("div");
      item.className = "palette-editor__swatch-item";

      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "swatch palette-editor__recents-pick";
      pick.style.backgroundColor = hex;
      pick.setAttribute("aria-label", `Select ${formatColor(hex, this.colorFormat)}`);
      pick.setAttribute("aria-pressed", "false");

      pick.addEventListener("click", () => {
        if (selected.has(hex)) {
          selected.delete(hex);
          pick.classList.remove("is-selected");
          pick.setAttribute("aria-pressed", "false");
        } else {
          selected.add(hex);
          pick.classList.add("is-selected");
          pick.setAttribute("aria-pressed", "true");
        }
        syncConfirm();
      });

      pick.addEventListener("mouseenter", () => {
        scheduleTip(pick, hex);
      });

      pick.addEventListener("mousemove", () => {
        if (tipAnchor === pick && !tooltip.hidden) {
          positionTooltip(pick);
        }
      });

      pick.addEventListener("mouseleave", () => {
        hideTip();
      });

      item.append(pick);
      grid.append(item);
    }

    swatchBox.append(grid);

    const buttons = document.createElement("div");
    buttons.className = "palette-editor__recents-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "palette-editor__action-btn";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      hideTip();
      overlay.remove();
    });
    confirm.addEventListener("click", () => {
      hideTip();
      void this.addFromRecents([...selected]);
      overlay.remove();
    });
    buttons.append(cancel, confirm);

    dialog.append(title, swatchBox, tooltip, buttons);
    overlay.append(dialog);
    this.container.append(overlay);
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

  private showExportMenu(anchor: HTMLButtonElement): void {
    if (!this.palette) {
      return;
    }
    const palette = this.palette;
    showActionMenu(this.container.getRootNode() as Document | ShadowRoot, anchor, [
      {
        label: "Hex list — Canva, anywhere",
        action: () => {
          copyText(exportPalettesHexList([palette]));
          this.callbacks.onToast("Hex list copied");
        },
      },
      {
        label: "CSS variables — Figma, code",
        action: () => {
          copyText(exportPalettesCss([palette]));
          this.callbacks.onToast("CSS variables copied");
        },
      },
      {
        label: "Adobe ASE (.ase)",
        action: () => {
          exportPaletteAseFile(palette);
          this.callbacks.onToast("Downloaded .ase file");
        },
      },
      {
        label: "PickHue JSON (backup)",
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
