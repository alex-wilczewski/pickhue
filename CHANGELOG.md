# Changelog

All notable changes to PickHue are documented here.

## [3.2.0] — 2026-11-21

**The green is back.** The brand default returns to the original PickHue green, and near-neutral picks now actually take over the UI instead of snapping to a fallback.

- **Original green restored** — the default accent returns to the 1.x/2.x green (`#87d624`, OKLCH hue 132) as an homage to the original identity; the 3.0 coral default is retired
- **Neutral picks take over properly** — picking white, black, or a gray used to discard the pick and fall back to the brand default, which read as the UI ignoring you. Near-gray picks now drive an achromatic accent whose lightness tracks the pick: white lightens the UI, black darkens it, and the chrome tint drops to zero chroma instead of wearing a hue the pick never had. Accent lightness is held clear of the panel background so the CTA never dissolves into it
- **New palette is a `+`** — the Saved Palettes action matches the Recent Colors button instead of a text label, with its name in the tooltip
- **No more "read and change all your data on all websites"** — PickHue no longer requests `<all_urls>`. It runs on `activeTab` alone, which Chrome grants when you click the icon or press the shortcut and revokes when the tab navigates, so installing it now shows **no site-access warning at all**. See [store/PERMISSIONS.md](store/PERMISSIONS.md)
- **Correct colors over images, gradients and canvases** — the CSS probe used to walk *past* an element that painted its own pixels and report an ancestor's background instead, so a gradient panel, a photo, a `<canvas>` or an SVG icon could report the page background rather than what you were pointing at. It now defers to the captured pixel whenever something paints over the stack
- **Calmer scroll recapture** — the loupe steps aside as soon as the page starts moving, instead of showing stale pixels and then blinking once scrolling stops, and fades back in when the fresh capture lands. Captures are also spaced to stay under Chrome's 2-per-second limit, which stop-start scrolling could previously exceed, silently leaving the loupe stale

## [3.1.1] — 2026-09-04

Patch release: picker performance on media-heavy pages, and a store-listing copy fix.

- **Picker performance** — the loupe no longer redraws while the cursor is still, and reads its magnified neighbourhood in a single canvas readback instead of 121 per frame. The colour under the crosshair is now resolved once per frame rather than twice, which also halves the work of 3×3 / 5×5 area averaging. Fixes stuttering on pages with playing audio or video
- Store listing: reworded the "Copy as anything" line, which Chrome Web Store review flagged as keyword spam

## [3.1.0] — 2026-09-03

**Pro tools release.** The UX-audit round: a Color Card for every palette color, WCAG contrast checking, page-palette extraction, area-average sampling, and four new color formats.

- **Color Card** — every palette swatch opens a card with OKLCH tune sliders (gradient tracks, a thumb that wears the current color), the 10-step shades & tints ramp, and actions. Ramp steps **stage** on tap (recents-style ring) and commit together with your tuned color via a single **Add** — nothing writes until you say so
- **Contrast checker** — a collapsed-by-default section of the Color Card: WCAG ratios with AAA / AA / AA·L grades against white, black, and every other color in the palette, updating live as you tune
- **Palette from this page** — the sparkle action in Saved Palettes gathers the page's colors grouped by role (backgrounds, text, borders), with near-duplicates merged perceptually; toggle what to keep, name it, save
- **Area-average sampling** — press `S` while picking to cycle 1×1 / 3×3 / 5×5 averaging; the reticle grows to cover exactly the sampled pixels
- **Copy as anything** — right-click any swatch for a menu of live values: HEX, RGB, HSL, OKLCH, and the new **LCH, OKLAB, HWB** (also available as the global format)
- **Clear recent colors** — a hover-revealed action in the Recent Colors header; undoable via the toast, no confirm dialog
- Eyedropper opens instantly — the screen capture now races the overlay instead of blocking it
- The loupe clips at screen edges like a physical lens, keeping the reticle on the exact edge pixel while the value chip stays readable
- Editor swatch badges are easier to hit; panel height no longer shifts when recents empty out

## [3.0.0] — 2026-08-15

**Dynamic accent release.** PickHue now wears your colors: the whole UI derives its accent from your last pick, plus a full UX overhaul of the picker, toasts, and palette editor.

- **Dynamic accent** — panel, toasts, menus, and picker hint take their accent from your most recent pick, derived in OKLCH with chroma-aware lightness and contrast-guaranteed text. Near-neutral picks fall back to the new **coral** default; the lime green accent is retired
- **Tinted chrome** — panel and overlay surfaces carry a whisper of the accent hue in both themes
- **Loupe**: the glass ring previews the hovered color, the zoom badge lives on the glass, and the hint pill reads as a clean three-verb sentence
- **Keyboard**: `Alt+Shift+P` starts the eyedropper (remappable — shown in Extension Settings), arrow keys nudge the sample point one pixel (`Shift` = 10), `Enter` picks
- **Copy toast**: compact concentric shell (radius = swatch + inset), **+** icon save action that morphs into a check with "Added to *palette*", hover pauses auto-dismiss, tinted save menu (wider, name truncation, **+** New palette)
- **Panel**: Save to palette is a **+** icon action with tooltip; palette row gear is now a filled ellipsis with color-only hover; text-only toasts render as rounded rectangles instead of pills
- **Palette editor overhaul**: name + meta row (color count, promoted Export, **⋯** menu with new **Duplicate** and Delete), bottom actions row removed, insertion-bar drag reorder (also on saved palette rows in move mode), **keyboard reorder** (arrows move a focused swatch, Shift jumps to ends), live paste-input validation, **+** Add icon, icons across both export menus
- **Shades & tints** — every palette swatch opens a 10-step Tailwind-scale OKLCH ramp; click a step to copy, hover **+** to add it to the palette
- **Tailwind config export** alongside hex list, CSS variables, ASE, and JSON
- What's-new page opens once after the 3.0 update; uninstall feedback link; `prefers-reduced-motion` fallbacks across all animations

## [2.0.4] — 2026-08-01

Chrome Web Store compliance fix and settings / picker UX polish.

- **Removed unused `tabs` permission** (Chrome Web Store rejection: Purple Potassium). Capture and messaging continue via `activeTab` + host access
- Format setting is a **dropdown** (HEX / RGB / HSL / OKLCH) instead of a segmented control, with full keyboard support — arrows, Home/End, Enter, Escape
- Export All and Import are **icon buttons** with tooltips, and settings rows now read Theme → Palettes → Format
- Palette editor: recent colors are an **inline strip** — one click adds a color, clicking it again removes it, and colors already in the palette are marked with a check. Replaces the "From Recents" modal
- Palette editor: the color well holds a **fixed height** whether it is empty or filled, so the panel no longer jumps when the first color lands
- **Escape** closes an open menu before it closes the panel
- Empty Recent Colors hint acts as **Select Color**
- Loupe color chip stays **above** the magnifier by default and flips below near the top edge so it remains visible at the bottom of the page
- Copy toast lifts clear of the loupe hint while the picker is open, and auto-dismisses after 3s instead of 4s
- Copy toast, confirm/import modals, and loupe chip polish for light and dark themes (live theme sync while overlays are open)

## [2.0.3] — 2026-07-15

Theme-aware picker UI and Save to palette flow polish.

- Loupe instructions and copy toast follow the selected theme (system / light / dark)
- Light-mode toast and picker hint use the same subtle translucency as dark
- Save to palette: palettes stay greyed until a recent swatch is selected; gear menu shows disabled instead of vanishing
- Palette pick pulse uses an inset ring so the animation is not clipped in the scroll list
- “Add colors” confirm uses accent green (matches Select Color); palettes inactive until selection is ready

## [2.0.2] — 2026-07-12

UI polish and reliability follow-up to 2.0.1.

- Custom swatch tooltips (PickHue-styled) with delayed show so remove controls appear first
- Restore hover-to-remove on Recent Colors swatches
- Unified outline icon set; palette row menu icons for Rename, Export, Move, and Delete
- Broader export options: hex list, CSS variables, Adobe ASE, and PickHue JSON
- Empty palette editor “Select Color” inline shortcut
- Wheel scrolling fixes for import textarea / internal scroll regions; smoother Recent Colors horizontal scroll (no snap jerk)
- Toast palette-menu dismiss reliability and recent-color storage normalization
- Format label optical centering and recent-colors well padding restored
- Concentric swatch / track radii (11 + 4 = 15) across Recent Colors, palette editor, and From Recents
- Compact, centered swatch remove badges; From Recents button and Add confirm polish
- Palette row hover stroke; stronger accent hover in dark mode; gear icon optical sizing
- Fix pick-toast “Save to palette” menu (toast mounts on `documentElement`)

## [2.0.1] — 2026-07-11

Minor polish and fixes on top of the 2.0 palettes release.

- Palette title reads as an editable field at rest (clearer rename cue)
- Saved Palettes list scrolls after five rows, with a soft fade hint and contained wheel scrolling
- **Move** action in the palette row menu to drag-reorder saved palettes
- Saved palette preview capped at four swatches
- Delete and settings icons use filled glyphs; swatch remove control centering and contrast polish
- Recents picker dialog edge/bleed fixes at high zoom

## [2.0.0] — 2026-07-08

**Palettes release.** Organize colors into named palettes, import from design tools, and save picks without leaving the page.

> **Shipped:** Palettes release. Chrome Web Store and GitHub both carry 2.0.x.

### Saved palettes

- Create and manage up to **32 named palettes** (24 colors each)
- **Saved Palettes** list on the home panel with swatch previews and per-palette actions
- **New palette** action in the section header
- Tap a palette to open the full **palette editor**

### Palette editor

- Rename palettes inline (Enter saves and exits edit; Back/Escape leaves the editor)
- Drag-and-drop to **reorder** swatches
- **From Recents** — multi-select recent colors to add in one step
- Paste hex values to add colors quickly
- **Export** palette as Adobe ASE + copy hex list to clipboard
- **Delete** palette with confirmation

### Save colors to palettes

- **Save to palette** on Recent Colors — select one or more swatches, then tap a saved palette
- Pulsing accent outline guides palette selection; only the chosen palette keeps highlighting once selected
- Confirm modal before colors are added (no accidental writes)
- **Save to palette** on the pick toast — save the color you just copied without opening the panel
- **New palette** flow from selection mode creates a palette from selected recents

### Import & export

- **Export All** — PickHue JSON, Adobe ASE, or hex list (clipboard)
- **Import** — merge or replace from PickHue JSON, `.ase`, CSS variables, or plain hex lists
- Per-palette export from the editor

### Color formats & settings

- **OKLCH** output format alongside HEX, RGB, and HSL
- **System / light / dark** theme switcher (follows OS when set to System)

### Picker & panel polish

- DOM color probing for more accurate sampling on styled elements
- Repaint wait before tab capture so the magnifier does not sample the panel overlay
- Pick-from-editor flow: add a color to a palette directly from the eyedropper
- Scrollable panel body, refined footer CTA, and settings layout updates
- Storage quota handling with clear error toasts

### Developer install

```bash
git clone https://github.com/alex-wilczewski/pickhue.git
cd pickhue
git checkout 2.0.0
npm install && npm run build
# chrome://extensions → Developer mode → Load unpacked → dist/
```

Or download **pickhue-2.0.0.zip** from the [2.0.0 release](https://github.com/alex-wilczewski/pickhue/releases/tag/2.0.0) and load the unzipped `dist/` folder.

---

## [0.1.1] — 2026-06-14

- Loupe scroll fix — magnifier reloads after page scroll
- Secondary scroll behavior fix for loupe movement
- OKLCH color format
- Picker zoom and Esc dismiss
- Persisted color format preference

## [0.1.0] — 2026-06-09

- First public release
- In-page panel with Shadow DOM
- Pixel-precise eyedropper magnifier
- HEX / RGB / HSL copy formats
- Recent colors history
- Light and dark themes
