## PickHue 2.0.4 — Store compliance & UX polish

Chrome Web Store permission fix plus settings and picker UX improvements.

**Free. No accounts. No tracking. Nothing leaves your machine.**

---

### What's new in 2.0.4

- Removed the unnecessary `tabs` permission (Chrome Web Store: Purple Potassium)
- Color format setting is now a dropdown (HEX / RGB / HSL / OKLCH), fully keyboard-navigable
- Export All and Import are compact icon buttons with tooltips
- Recent colors now sit inline in the palette editor — one click to add, click again to remove, no modal
- The palette color well no longer resizes when you add your first color
- Escape closes an open menu before it closes the panel
- Empty Recent Colors hint starts the eyedropper (same as Select Color)
- Loupe color chip stays above the magnifier and flips below near the top edge so it never clips
- Copy toast clears the loupe hint while picking, and fades a little sooner
- Copy toast, confirm dialogs, and loupe chip follow light / dark themes more cleanly

---

### Install (developer)

1. Download **pickhue-2.0.4.zip** below
2. Unzip the archive
3. Open `chrome://extensions` or `brave://extensions`
4. Enable **Developer mode** → **Load unpacked** → select the unzipped folder
5. Pin PickHue from the toolbar puzzle menu

**Build from source:** `git checkout 2.0.4 && npm install && npm run build` → load `dist/`

---

**Homepage:** https://pickhue.site  
**Full changelog:** [CHANGELOG.md](https://github.com/alex-wilczewski/pickhue/blob/main/CHANGELOG.md)  
**Issues & feedback:** https://github.com/alex-wilczewski/pickhue/issues
