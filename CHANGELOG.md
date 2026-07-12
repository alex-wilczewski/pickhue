# Changelog

All notable changes to PickHue are documented here.

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
