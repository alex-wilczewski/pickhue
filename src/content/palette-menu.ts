import type { ColorPalette } from "../shared/types";

export interface PaletteMenuCallbacks {
  onSelect: (paletteId: string) => void | Promise<void>;
  onNewPalette: () => void | Promise<void>;
  onClose?: () => void;
}

const MENU_CLASS = "palette-menu";
const MENU_GAP = 6;
/** Matches palette row → gear menu spacing in the panel. */
const TOAST_MENU_GAP = 4;

/** Active menu dismisser — replace/remove always runs this so listeners don't leak. */
let activeMenuDismiss: (() => void) | null = null;

function dismissActiveMenu(): void {
  const dismiss = activeMenuDismiss;
  activeMenuDismiss = null;
  dismiss?.();
}

function registerMenuDismiss(dismiss: () => void): () => void {
  dismissActiveMenu();
  const wrapped = (): void => {
    if (activeMenuDismiss === wrapped) {
      activeMenuDismiss = null;
    }
    dismiss();
  };
  activeMenuDismiss = wrapped;
  return wrapped;
}

function positionMenuInPanel(
  menu: HTMLElement,
  anchorRect: DOMRect,
  panelRect: DOMRect,
  options?: { alignRight?: boolean }
): void {
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const panelWidth = panelRect.width;
  const panelHeight = panelRect.height;

  const preferredLeft = options?.alignRight
    ? anchorRect.right - panelRect.left - menuWidth
    : anchorRect.left - panelRect.left;
  const maxLeft = Math.max(8, panelWidth - menuWidth - 8);
  const left = Math.min(Math.max(8, preferredLeft), maxLeft);

  const belowTop = anchorRect.bottom - panelRect.top + MENU_GAP;
  const aboveTop = anchorRect.top - panelRect.top - menuHeight - MENU_GAP;
  const maxTop = Math.max(8, panelHeight - menuHeight - 8);
  const top =
    belowTop + menuHeight <= panelHeight - 8
      ? belowTop
      : aboveTop >= 8
        ? aboveTop
        : Math.min(Math.max(8, belowTop), maxTop);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function positionMenuFixed(
  menu: HTMLElement,
  anchorRect: DOMRect,
  options?: {
    align?: "start" | "center";
    preferAbove?: boolean;
    gap?: number;
    /** Visual surface for vertical clearance (e.g. whole toast, not just the button). */
    edgeRect?: DOMRect;
  }
): void {
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const pad = 8;
  const gap = options?.gap ?? MENU_GAP;
  const edgeRect = options?.edgeRect ?? anchorRect;

  const preferredLeft =
    options?.align === "center"
      ? anchorRect.left + anchorRect.width / 2 - menuWidth / 2
      : anchorRect.left;
  const maxLeft = Math.max(pad, viewportWidth - menuWidth - pad);
  const left = Math.min(Math.max(pad, preferredLeft), maxLeft);

  const belowTop = edgeRect.bottom + gap;
  const aboveTop = edgeRect.top - menuHeight - gap;
  const fitsBelow = belowTop + menuHeight <= viewportHeight - pad;
  const fitsAbove = aboveTop >= pad;

  let top: number;
  if (options?.preferAbove) {
    top = fitsAbove
      ? aboveTop
      : fitsBelow
        ? belowTop
        : Math.max(pad, viewportHeight - menuHeight - pad);
  } else {
    top = fitsBelow
      ? belowTop
      : fitsAbove
        ? aboveTop
        : Math.min(
            Math.max(pad, belowTop),
            Math.max(pad, viewportHeight - menuHeight - pad)
          );
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function applyToastMenuSurface(
  menu: HTMLElement,
  theme: "light" | "dark"
): void {
  // Toast menus mount in the page light DOM. Host stylesheets and a stale
  // injected picker stylesheet can beat class rules, so pin the surface here.
  menu.dataset.theme = theme;
  menu.style.position = "fixed";
  menu.style.zIndex = "2147483647";
  menu.style.borderRadius = "14px";
  menu.style.padding = "4px";
  menu.style.minWidth = "160px";
  menu.style.maxWidth = "240px";
  menu.style.maxHeight = "220px";
  menu.style.overflowY = "auto";
  menu.style.fontFamily = '"Geist", "Segoe UI", system-ui, sans-serif';

  if (theme === "light") {
    menu.style.background = "rgba(255, 255, 255, 0.94)";
    menu.style.border = "1px solid rgba(20, 20, 20, 0.14)";
    menu.style.boxShadow = "0 16px 40px rgba(0, 0, 0, 0.12)";
    menu.style.color = "#141414";
  } else {
    menu.style.background = "rgba(20, 20, 20, 0.94)";
    menu.style.border = "1px solid rgba(255, 255, 255, 0.08)";
    menu.style.boxShadow = "0 16px 40px rgba(0, 0, 0, 0.28)";
    menu.style.color = "#f6f6f6";
  }
}

function styleToastMenuItem(item: HTMLElement, theme: "light" | "dark"): void {
  const text = theme === "light" ? "#141414" : "#f6f6f6";
  const hoverBg =
    theme === "light" ? "rgba(20, 20, 20, 0.08)" : "rgba(246, 246, 246, 0.1)";
  item.style.color = text;
  item.style.background = "transparent";
  item.addEventListener("mouseenter", () => {
    item.style.background = hoverBg;
  });
  item.addEventListener("mouseleave", () => {
    item.style.background = "transparent";
  });
}

function styleToastActionItem(item: HTMLElement, theme: "light" | "dark"): void {
  const link = theme === "light" ? "#3d6b0f" : "#b8f06a";
  const hover = theme === "light" ? "#141414" : "#f6f6f6";
  item.style.color = link;
  item.style.justifyContent = "flex-start";
  item.style.fontWeight = "500";
  item.style.background = "transparent";
  item.addEventListener("mouseenter", () => {
    item.style.color = hover;
    item.style.background = "transparent";
  });
  item.addEventListener("mouseleave", () => {
    item.style.color = link;
    item.style.background = "transparent";
  });
}

export function showPaletteMenu(
  root: Document | ShadowRoot,
  anchor: HTMLElement,
  palettes: ColorPalette[],
  callbacks: PaletteMenuCallbacks
): () => void {
  dismissActiveMenu();

  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");

  const isToastAnchor = Boolean(anchor.closest(".pickhue-copy-toast"));
  const toastTheme =
    (anchor.closest(".pickhue-copy-toast")?.getAttribute("data-theme") as
      | "light"
      | "dark"
      | null) === "light"
      ? "light"
      : "dark";

  const addItem = (
    label: string,
    action: () => void | Promise<void>,
    options?: { swatches?: string[]; actionItem?: boolean }
  ): void => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "palette-menu__item";
    if (options?.actionItem) {
      item.classList.add("palette-menu__item--action");
    }
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

    if (isToastAnchor) {
      if (options?.actionItem) {
        styleToastActionItem(item, toastTheme);
      } else {
        styleToastMenuItem(item, toastTheme);
      }
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

  if (palettes.length > 0) {
    const divider = document.createElement("div");
    divider.className = "palette-menu__divider";
    divider.setAttribute("role", "separator");
    if (isToastAnchor) {
      divider.style.height = "1px";
      divider.style.margin = "4px 8px";
      divider.style.background =
        toastTheme === "light"
          ? "rgba(20, 20, 20, 0.14)"
          : "rgba(246, 246, 246, 0.12)";
    }
    menu.append(divider);
  }

  addItem("New palette", () => callbacks.onNewPalette(), {
    actionItem: true,
  });

  const panel = anchor.closest(".panel");
  if (panel) {
    panel.append(menu);
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    requestAnimationFrame(() => {
      positionMenuInPanel(menu, anchorRect, panelRect);
    });
  } else {
    menu.classList.add("palette-menu--toast");
    applyToastMenuSurface(menu, toastTheme);
    document.body.append(menu);
    const toastEl = anchor.closest(".pickhue-copy-toast");
    requestAnimationFrame(() => {
      const buttonRect = anchor.getBoundingClientRect();
      const toastRect = toastEl?.getBoundingClientRect();
      positionMenuFixed(menu, buttonRect, {
        align: "center",
        preferAbove: true,
        gap: TOAST_MENU_GAP,
        edgeRect: toastRect ?? buttonRect,
      });
    });
  }

  const dismiss = registerMenuDismiss((): void => {
    menu.remove();
    document.removeEventListener("click", onOutside, true);
    document.removeEventListener("keydown", onEscape, true);
    callbacks.onClose?.();
  });

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
  dismissActiveMenu();

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
    requestAnimationFrame(() => {
      positionMenuInPanel(menu, anchorRect, panelRect, { alignRight: true });
    });
  } else {
    document.body.append(menu);
    menu.style.position = "fixed";
    menu.style.zIndex = "2147483647";
    requestAnimationFrame(() => {
      positionMenuFixed(menu, anchor.getBoundingClientRect());
    });
  }

  const dismiss = registerMenuDismiss((): void => {
    menu.remove();
    document.removeEventListener("click", onOutside, true);
    document.removeEventListener("keydown", onEscape, true);
  });

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
