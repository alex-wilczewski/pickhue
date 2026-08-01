## PickHue 2.0.4 — Store compliance & UX polish

Chrome Web Store permission fix plus Recent Colors and picker UX improvements.

**Free. No accounts. No tracking. Nothing leaves your machine.**

---

### What's new in 2.0.4

- Removed the unnecessary `tabs` permission (Chrome Web Store: Purple Potassium)
- Clear all recent colors, with a confirm step
- Color format setting is now a dropdown (HEX / RGB / HSL / OKLCH)
- Empty Recent Colors hint starts the eyedropper (same as Select Color)
- Loupe color chip stays above the magnifier and flips below near the top edge so it never clips
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
