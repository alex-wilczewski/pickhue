## PickHue 2.0 — Palettes

Organize your colors. Save picks to named palettes, import from design tools, and export for your workflow — all without leaving the page.

**Free. No accounts. No tracking. Nothing leaves your machine.**

> **Early access:** This release is on GitHub while the Chrome Web Store listing is updated for review. [pickhue.site](https://pickhue.site) Web Store installs remain on 0.1.1 until approval.

---

### What's new in 2.0

#### Saved palettes
- Create and manage up to **32 named palettes** (24 colors each)
- **Saved Palettes** list with swatch previews and per-palette menu
- Full **palette editor**: rename, drag-reorder, delete, export

#### Save colors faster
- **Save to palette** on Recent Colors — multi-select swatches, tap a palette, confirm
- **Save to palette** on the copy toast right after a pick
- Create a new palette from selected recents

#### Import & export
- **Export All** — PickHue JSON, Adobe ASE, hex list
- **Import** — merge or replace from JSON, `.ase`, CSS variables, or hex lists
- Per-palette ASE export from the editor

#### Formats & settings
- **OKLCH** output alongside HEX, RGB, and HSL
- **System / light / dark** theme switcher

#### Polish
- More accurate DOM color sampling on styled elements
- Pulsing palette selection cues during save flow
- Storage quota handling with clear error messages

---

### Install (developer / early access)

1. Download **pickhue-2.0.0.zip** below
2. Unzip the archive
3. Open `chrome://extensions` or `brave://extensions`
4. Enable **Developer mode** → **Load unpacked** → select the unzipped folder
5. Pin PickHue from the toolbar puzzle menu

**Build from source:** `git checkout 2.0.0 && npm install && npm run build` → load `dist/`

---

### Upgrading from 0.1.x

- Your recent colors and settings are preserved
- Palettes are new — start fresh or import from ASE / CSS / JSON
- Uninstalling removes palettes stored in `chrome.storage`

---

### Notes

- Works on most websites; `chrome://`, `brave://`, and the Web Store are blocked by browser policy
- Settings, recents, and palettes use `chrome.storage` locally (may sync with Chrome Sync)

---

**Homepage:** https://pickhue.site  
**Full changelog:** [CHANGELOG.md](https://github.com/alex-wilczewski/pickhue/blob/main/CHANGELOG.md)  
**Issues & feedback:** https://github.com/alex-wilczewski/pickhue/issues
