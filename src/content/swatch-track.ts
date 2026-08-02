/*
 * Shared behavior for the 44px horizontal swatch tracks (home recents and the
 * palette editor's recents strip): vertical-wheel-to-horizontal-scroll with a
 * soft settle, plus the edge fade classes the .panel__swatches-wrap gradients
 * key off. Both tracks use the same 36px swatch / 4px gap / 4px inset geometry,
 * so the snap math is shared rather than tuned twice.
 */

const PAD = 4;
const SWATCH = 36;
const GAP = 4;
const STRIDE = SWATCH + GAP;
const SNAP_IDLE_MS = 120;

/** Toggles the left/right fade classes on the track's wrap. */
export function syncTrackOverflow(scroller: HTMLElement): void {
  const wrap = scroller.closest(".panel__swatches-wrap");
  if (!(wrap instanceof HTMLElement)) {
    return;
  }

  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const hasOverflow = maxScroll > 1;

  wrap.classList.toggle("has-more-left", hasOverflow && scroller.scrollLeft > 1);
  wrap.classList.toggle(
    "has-more-right",
    hasOverflow && scroller.scrollLeft < maxScroll - 1
  );
}

export interface SwatchTrackOptions {
  /** Runs whenever the track moves — used to dismiss swatch tooltips. */
  onScroll?: () => void;
  /** Runs after each scroll step so callers can record the offset. */
  onSettle?: (scrollLeft: number) => void;
}

export function bindSwatchTrack(
  scroller: HTMLElement,
  options: SwatchTrackOptions = {}
): void {
  if (scroller.dataset.swatchTrackBound === "true") {
    return;
  }
  scroller.dataset.swatchTrackBound = "true";

  scroller.addEventListener(
    "scroll",
    () => {
      options.onScroll?.();
      syncTrackOverflow(scroller);
      options.onSettle?.(scroller.scrollLeft);
    },
    { passive: true }
  );

  let targetScroll = 0;
  let scrollRafId = 0;
  let settleTimer = 0;
  let direction = 1;
  let lastLeft = Number.NaN;

  const maxScroll = (): number =>
    Math.max(0, scroller.scrollWidth - scroller.clientWidth);

  /** Soft snap targets that preserve the 4px edge inset (no CSS mandatory snap). */
  const nearestSnap = (scrollLeft: number, dir: number): number => {
    const max = maxScroll();
    if (max <= 0) {
      return 0;
    }

    if (dir >= 0) {
      // Forward: align item end to the right inset (matches prior snap-end).
      const index = Math.round(
        (scrollLeft - SWATCH - 2 * PAD + scroller.clientWidth) / STRIDE
      );
      return Math.min(
        max,
        Math.max(0, index * STRIDE + SWATCH + 2 * PAD - scroller.clientWidth)
      );
    }

    // Backward: align item start to the left inset.
    const index = Math.round(scrollLeft / STRIDE);
    return Math.min(max, Math.max(0, index * STRIDE));
  };

  const animateScroll = (): void => {
    const diff = targetScroll - scroller.scrollLeft;
    const stuck = scroller.scrollLeft === lastLeft;
    lastLeft = scroller.scrollLeft;

    if (Math.abs(diff) <= 0.5 || (stuck && Math.abs(diff) <= 4)) {
      scroller.scrollLeft = targetScroll;
      scrollRafId = 0;
      syncTrackOverflow(scroller);
      return;
    }

    scroller.scrollLeft += diff * 0.16;
    syncTrackOverflow(scroller);
    scrollRafId = requestAnimationFrame(animateScroll);
  };

  const runToward = (next: number): void => {
    targetScroll = Math.min(maxScroll(), Math.max(0, next));
    lastLeft = Number.NaN;
    if (scrollRafId === 0) {
      scrollRafId = requestAnimationFrame(animateScroll);
    }
  };

  const scheduleSoftSnap = (): void => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      const basis = scrollRafId !== 0 ? targetScroll : scroller.scrollLeft;
      const snapped = nearestSnap(basis, direction);
      if (Math.abs(snapped - basis) > 0.5) {
        runToward(snapped);
      }
    }, SNAP_IDLE_MS);
  };

  scroller.addEventListener(
    "wheel",
    (event) => {
      const rawDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (rawDelta === 0 || maxScroll() === 0) {
        return;
      }
      event.preventDefault();

      // Soften trackpad/wheel steps; keep free-scroll until the gesture idles.
      const delta = rawDelta * 0.72;
      direction = delta > 0 ? 1 : -1;
      scroller.classList.remove("is-snapping", "snap-end");
      window.clearTimeout(settleTimer);

      if (scrollRafId === 0) {
        targetScroll = scroller.scrollLeft;
      }
      runToward(targetScroll + delta);
      scheduleSoftSnap();
    },
    { passive: false }
  );
}
