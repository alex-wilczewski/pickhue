/** Delay before showing color value — leave room for the remove control first. */
export const SWATCH_TOOLTIP_DELAY_MS = 520;

export class SwatchTooltipController {
  private readonly el: HTMLDivElement;
  private readonly root: HTMLElement;
  private showTimer = 0;
  private activeAnchor: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.el = document.createElement("div");
    this.el.className = "swatch-tooltip";
    this.el.hidden = true;
    this.el.setAttribute("role", "tooltip");
    root.append(this.el);
  }

  /** Bind hover/focus tip to an anchor; `getText` is read when the tip shows. */
  attach(anchor: HTMLElement, getText: () => string): () => void {
    const scheduleShow = (): void => {
      window.clearTimeout(this.showTimer);
      this.showTimer = window.setTimeout(() => {
        this.show(anchor, getText());
      }, SWATCH_TOOLTIP_DELAY_MS);
    };

    const hide = (): void => {
      window.clearTimeout(this.showTimer);
      this.showTimer = 0;
      if (this.activeAnchor === anchor) {
        this.hide();
      }
    };

    const onMove = (): void => {
      if (this.activeAnchor === anchor && !this.el.hidden) {
        this.position(anchor);
      }
    };

    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget;
      if (next instanceof Node && anchor.contains(next)) {
        return;
      }
      hide();
    };

    anchor.addEventListener("mouseenter", scheduleShow);
    anchor.addEventListener("mouseleave", hide);
    anchor.addEventListener("mousemove", onMove);
    anchor.addEventListener("focusin", scheduleShow);
    anchor.addEventListener("focusout", onFocusOut);

    return () => {
      window.clearTimeout(this.showTimer);
      anchor.removeEventListener("mouseenter", scheduleShow);
      anchor.removeEventListener("mouseleave", hide);
      anchor.removeEventListener("mousemove", onMove);
      anchor.removeEventListener("focusin", scheduleShow);
      anchor.removeEventListener("focusout", onFocusOut);
      if (this.activeAnchor === anchor) {
        this.hide();
      }
    };
  }

  hide(): void {
    window.clearTimeout(this.showTimer);
    this.showTimer = 0;
    this.activeAnchor = null;
    this.el.hidden = true;
    this.el.textContent = "";
  }

  dispose(): void {
    this.hide();
    this.el.remove();
  }

  private show(anchor: HTMLElement, text: string): void {
    if (!text) {
      return;
    }
    this.activeAnchor = anchor;
    this.el.textContent = text;
    this.el.hidden = false;
    this.position(anchor);
  }

  private position(anchor: HTMLElement): void {
    const rootRect = this.root.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const tipWidth = this.el.offsetWidth;
    const tipHeight = this.el.offsetHeight;
    const gap = 6;

    let left =
      anchorRect.left - rootRect.left + anchorRect.width / 2 - tipWidth / 2;
    let top = anchorRect.bottom - rootRect.top + gap;

    const maxLeft = Math.max(4, rootRect.width - tipWidth - 4);
    left = Math.max(4, Math.min(left, maxLeft));

    const maxTop = Math.max(4, rootRect.height - tipHeight - 4);
    if (top > maxTop) {
      top = anchorRect.top - rootRect.top - tipHeight - gap;
    }
    top = Math.max(4, Math.min(top, maxTop));

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }
}
