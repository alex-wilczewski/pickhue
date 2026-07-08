import type { ColorPalette } from "../shared/types";

export interface PaletteMenuCallbacks {
  onSelect: (paletteId: string) => void | Promise<void>;
  onNewPalette: () => void | Promise<void>;
  onClose?: () => void;
}

const MENU_CLASS = "palette-menu";

export function showPaletteMenu(
  root: Document | ShadowRoot,
  anchor: HTMLElement,
  palettes: ColorPalette[],
  callbacks: PaletteMenuCallbacks
): () => void {
  const existing = root.querySelector(`.${MENU_CLASS}`);
  existing?.remove();

  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");

  const addItem = (
    label: string,
    action: () => void | Promise<void>,
    options?: { swatches?: string[] }
  ): void => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "palette-menu__item";
    item.setAttribute("role", "menuitem");

    const name = document.createElement("span");
    name.className = "palette-menu__name";
    name.textContent = label;
    item.append(name);

    if (options?.swatches?.length) {
      const strip = document.createElement("span");
      strip.className = "palette-menu__swatches";
      for (const hex of options.swatches.slice(0, 4)) {
        const dot = document.createElement("span");
        dot.className = "palette-menu__dot";
        dot.style.backgroundColor = hex;
        strip.append(dot);
      }
      item.append(strip);
    }

    item.addEventListener("click", (event) => {
      event.stopPropagation();
      void action();
      dismiss();
    });
    menu.append(item);
  };

  for (const palette of palettes) {
    addItem(
      palette.name,
      () => callbacks.onSelect(palette.id),
      { swatches: palette.colors }
    );
  }

  addItem("+ New palette", () => callbacks.onNewPalette());

  const panel = anchor.closest(".panel");
  if (panel) {
    panel.append(menu);
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    menu.style.left = `${anchorRect.left - panelRect.left}px`;
    menu.style.top = `${anchorRect.bottom - panelRect.top + 6}px`;
  } else {
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.zIndex = "2147483647";
  }

  const dismiss = (): void => {
    menu.remove();
    document.removeEventListener("click", onOutside, true);
    document.removeEventListener("keydown", onEscape, true);
    callbacks.onClose?.();
  };

  const onOutside = (event: MouseEvent): void => {
    if (!menu.contains(event.target as Node)) {
      dismiss();
    }
  };

  const onEscape = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      dismiss();
    }
  };

  requestAnimationFrame(() => {
    document.addEventListener("click", onOutside, true);
    document.addEventListener("keydown", onEscape, true);
  });

  return dismiss;
}

export interface ActionMenuItem {
  label: string;
  action: () => void | Promise<void>;
}

export function showActionMenu(
  root: Document | ShadowRoot,
  anchor: HTMLElement,
  items: ActionMenuItem[]
): () => void {
  const existing = root.querySelector(`.${MENU_CLASS}`);
  existing?.remove();

  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-menu__item";
    button.setAttribute("role", "menuitem");
    button.textContent = item.label;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void item.action();
      dismiss();
    });
    menu.append(button);
  }

  const panel = anchor.closest(".panel");
  if (panel) {
    panel.append(menu);
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    menu.style.top = `${anchorRect.bottom - panelRect.top + 6}px`;
    requestAnimationFrame(() => {
      const menuWidth = menu.offsetWidth;
      menu.style.left = `${Math.max(
        8,
        anchorRect.right - panelRect.left - menuWidth
      )}px`;
    });
  } else {
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.zIndex = "2147483647";
  }

  const dismiss = (): void => {
    menu.remove();
    document.removeEventListener("click", onOutside, true);
    document.removeEventListener("keydown", onEscape, true);
  };

  const onOutside = (event: MouseEvent): void => {
    if (!menu.contains(event.target as Node)) {
      dismiss();
    }
  };

  const onEscape = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      dismiss();
    }
  };

  requestAnimationFrame(() => {
    document.addEventListener("click", onOutside, true);
    document.addEventListener("keydown", onEscape, true);
  });

  return dismiss;
}
