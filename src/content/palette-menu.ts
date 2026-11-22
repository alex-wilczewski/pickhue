import { PLUS_ICON_HTML } from "./icons";
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

/** Closes whatever menu is open. Returns true when there was one. */
export function dismissActiveMenu(): boolean {
  const dismiss = activeMenuDismiss;
  activeMenuDismiss = null;
  dismiss?.();
  return Boolean(dismiss);
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
  menu.style.borderRadius = "16px";
  menu.style.padding = "4px";
  menu.style.minWidth = "220px";
  menu.style.maxWidth = "264px";
  menu.style.maxHeight = "220px";
  menu.style.overflowY = "auto";
  menu.style.fontFamily = '"Geist", "Segoe UI", system-ui, sans-serif';

  if (theme === "light") {
    menu.style.background = "var(--pickhue-surface, rgba(255, 255, 255, 0.94))";
    menu.style.border = "1px solid rgba(20, 20, 20, 0.14)";
    menu.style.boxShadow = "0 16px 40px rgba(0, 0, 0, 0.12)";
    menu.style.color = "#141414";
  } else {
    menu.style.background = "var(--pickhue-surface, rgba(20, 20, 20, 0.94))";
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
  const link =
    theme === "light"
      ? "var(--pickhue-accent-link, #3b6600)"
      : "var(--pickhue-accent-link, #b1de8b)";
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

    if (options?.actionItem) {
      // Same + glyph as the toast's save action, so the affordances rhyme.
      const icon = document.createElement("span");
      icon.className = "palette-menu__action-icon";
      icon.innerHTML = PLUS_ICON_HTML;
      icon.style.display = "inline-flex";
      icon.style.alignItems = "center";
      icon.style.flexShrink = "0";
      item.append(icon);
    }

    const name = document.createElement("span");
    name.className = "palette-menu__name";
    name.textContent = label;
    // Flex child: without min-width:0 long names push the swatches instead of
    // truncating into the ellipsis.
    name.style.minWidth = "0";
    name.style.flex = "1 1 auto";
    item.append(name);

    if (options?.swatches?.length) {
      const strip = document.createElement("span");
      strip.className = "palette-menu__swatches";
      strip.style.flexShrink = "0";
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
          : "rgba(246, 246, 246, 0.2)";
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
    const accentSource = anchor.closest<HTMLElement>(".pickhue-copy-toast");
    if (accentSource) {
      for (const prop of ["--pickhue-surface", "--pickhue-accent-link"]) {
        const value = accentSource.style.getPropertyValue(prop);
        if (value) {
          menu.style.setProperty(prop, value);
        }
      }
    }
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

/** Deepest focused node — `document.activeElement` stops at the shadow host. */
function getDeepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

export interface SelectMenuOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectMenuConfig<T extends string> {
  /** Accessible name for the listbox. */
  label: string;
  options: SelectMenuOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  /** Extra class on the menu surface, for width/alignment overrides. */
  className?: string;
  /** Runs on every dismissal, however it was triggered. */
  onClose?: () => void;
}

/**
 * Single-choice listbox anchored to a button — the keyboard-navigable stand-in
 * for a native `<select>`, whose popup we cannot style inside the panel.
 */
export function showSelectMenu<T extends string>(
  anchor: HTMLElement,
  config: SelectMenuConfig<T>
): () => void {
  dismissActiveMenu();

  const menu = document.createElement("div");
  menu.className = config.className
    ? `${MENU_CLASS} ${config.className}`
    : MENU_CLASS;
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", config.label);

  anchor.setAttribute("aria-expanded", "true");

  const items: HTMLButtonElement[] = [];
  let selectedIndex = 0;

  config.options.forEach((option, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "palette-menu__item";
    item.setAttribute("role", "option");

    const isSelected = option.value === config.selected;
    item.setAttribute("aria-selected", isSelected ? "true" : "false");
    item.classList.toggle("is-selected", isSelected);
    if (isSelected) {
      selectedIndex = index;
    }

    item.textContent = option.label;
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      dismiss();
      config.onSelect(option.value);
    });
    menu.append(item);
    items.push(item);
  });

  const focusItem = (index: number): void => {
    const next = items[((index % items.length) + items.length) % items.length];
    next?.focus();
  };

  const currentIndex = (): number => {
    const active = getDeepActiveElement();
    const index = items.findIndex((item) => item === active);
    return index === -1 ? selectedIndex : index;
  };

  menu.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(currentIndex() + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(currentIndex() - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      case "Tab":
        // Never strand focus in a popup the user is tabbing away from.
        event.preventDefault();
        dismiss();
        break;
      default:
        break;
    }
  });

  const panel = anchor.closest(".panel");
  if (panel) {
    panel.append(menu);
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    requestAnimationFrame(() => {
      positionMenuInPanel(menu, anchorRect, panelRect, { alignRight: true });
      focusItem(selectedIndex);
    });
  } else {
    document.body.append(menu);
    menu.style.position = "fixed";
    menu.style.zIndex = "2147483647";
    requestAnimationFrame(() => {
      positionMenuFixed(menu, anchor.getBoundingClientRect());
      focusItem(selectedIndex);
    });
  }

  const dismiss = registerMenuDismiss((): void => {
    const restoreFocus = menu.contains(getDeepActiveElement());
    menu.remove();
    anchor.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onOutside, true);
    document.removeEventListener("keydown", onEscape, true);
    if (restoreFocus) {
      (anchor as HTMLElement).focus();
    }
    config.onClose?.();
  });

  const onOutside = (event: MouseEvent): void => {
    // composedPath sees through the shadow root; event.target is retargeted
    // to the host, so a click inside the menu would otherwise read as outside.
    const path = event.composedPath();
    if (!path.includes(menu) && !path.includes(anchor)) {
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
  danger?: boolean;
  iconHtml?: string;
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
    if (item.danger) {
      button.classList.add("palette-menu__item--danger");
    }
    if (item.iconHtml) {
      button.classList.add("palette-menu__item--with-icon");
      button.innerHTML = `${item.iconHtml}<span>${item.label}</span>`;
    } else {
      button.textContent = item.label;
    }
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
