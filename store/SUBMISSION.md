# PickHue — Chrome Web Store submission guide (v3.2.0)

Use this checklist when uploading **PickHue 3.2.0** to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

> **Status:** 3.1.1 shipped after the 3.1.0 listing was rejected for keyword spam (Yellow Argon) — the fix was listing copy, not code. 3.2.0 *removes* a permission: `host_permissions: ["<all_urls>"]` is gone. Dropping a permission never triggers a re-consent prompt, so existing users auto-update silently and simply stop seeing the site-access warning on the extension's card.

## Before you upload

The zip is built by CI from the tagged commit, so the file attached to the
[GitHub release](https://github.com/alex-wilczewski/pickhue/releases/latest) is
the one to upload — no local build needed. To make an identical one by hand:

```bash
npm install
npm run package          # build + permission gate + pickhue-3.2.0.zip
npm test                 # the suite CI runs
```

`npm run package` runs `scripts/check-manifest.mjs`, the same gate CI uses, so a
zip with the wrong permission set cannot be produced either way.

### Permission check (required)

Open `dist/manifest.json` and confirm:

- `permissions` is exactly: `storage`, `activeTab`, `scripting`
- There is **no** `"tabs"` permission
- `host_permissions` is **absent** — PickHue runs on `activeTab` alone (see PERMISSIONS.md)
- `commands` declares `start-picker` (`Alt+Shift+P`) — this key needs **no** permission and triggers **no** new install warning

### What changed vs 3.1.x (permissions view)

| Manifest field | 3.1.x | 3.2.0 |
|---|---|---|
| `permissions` | storage, activeTab, scripting | **unchanged** |
| `host_permissions` | `<all_urls>` | **removed** — activeTab alone, no install warning |
| `commands` | `start-picker` | **unchanged** |

On the dashboard this means the **host permission justification field disappears**
from the Privacy practices tab. The three remaining justifications (activeTab,
scripting, storage) are in `store/PERMISSIONS.md`, written to be pasted straight
into those boxes.

Nothing on the **Privacy practices** tab needs to change: no remote code, no analytics, no data collection. Palettes and settings live in `chrome.storage.sync`; the only outbound navigation is opening `pickhue.site` in a tab.

### New in 3.0.0 that reviewers may look at

- **Post-update tab** — `chrome.runtime.onInstalled` opens https://pickhue.site/whats-new **once**, only when upgrading from a major version below 3. Fresh installs open nothing.
- **Uninstall URL** — `chrome.runtime.setUninstallURL` points at https://pickhue.site/goodbye (a static page, no form, no tracking).
- **Shortcuts link** — the settings row opens `chrome://extensions/shortcuts` via `chrome.tabs.create`, which is allowed without the `tabs` permission.

### Manual QA checklist (v3.0.0)

- [ ] Fresh load of `dist/` on a test profile
- [ ] Toolbar click toggles panel on a normal https page
- [ ] `Alt+Shift+P` starts the eyedropper directly, with no panel open
- [ ] Arrow keys nudge the sample point 1px (`Shift` = 10px); `Enter` picks
- [ ] Settings shows the live shortcut and the row opens `chrome://extensions/shortcuts`
- [ ] Accent follows the last pick across panel, toasts, menus, and picker hint
- [ ] A near-white / near-black / gray pick drives a colorless accent that tracks its lightness — it must *not* snap back to the brand green
- [ ] Loupe: ring previews the hovered color, zoom badge sits on the glass
- [ ] Copy toast: `+` saves to a palette and morphs into ✓ with the palette name; hover pauses auto-dismiss
- [ ] Palette editor: count + Export in the meta row, `⋯` menu offers Duplicate and Delete
- [ ] Palette editor: drag reorder shows the insertion bar; arrow keys reorder a focused swatch (Shift jumps to ends)
- [ ] Shades & tints: a swatch opens the 10-step ramp; click copies, `+` adds
- [ ] Tailwind export produces a pasteable `tailwind.config.js` snippet
- [ ] Theme: light / dark / system across panel, toasts, modals, loupe chip
- [ ] `prefers-reduced-motion` enabled — animations degrade, nothing breaks
- [ ] Import / export of existing palettes still works after upgrading from 2.0.4

### Additional QA for 3.1.0

- [ ] Right-click a swatch (recents + editor) shows the copy-as menu with live values in all 7 formats
- [ ] `S` while picking cycles 1×1 / 3×3 / 5×5; the reticle grows and the badge reads e.g. "3×3 · 120%"
- [ ] Color Card: sliders tune live, ramp steps stage/unstage, Add commits staged + tuned in one write
- [ ] Color Card: Contrast is collapsed by default and expands without touching the action buttons
- [ ] Replace swaps the color in place and closes; × / Esc / outside-click cancel without writing
- [ ] Sparkle action extracts this page's palette grouped by role; excluded swatches don't save
- [ ] Clear Recent Colors appears on hover, clears, and Undo restores the exact list
- [ ] Loupe clips at all four screen edges; the value chip stays fully on-screen

### Additional QA for 3.2.0 — the permission change is the risky part

These all exercise paths that used to be covered by `<all_urls>`:

- [ ] Cold start: install on a fresh profile, open a page, click the icon — panel appears with no prior injection
- [ ] A tab that was already open *before* the install still works on first click
- [ ] `Alt+Shift+P` works as a first action on a page the panel has never opened
- [ ] Navigate to a new page with the panel open, then click the icon — it recovers (this is the documented trade-off, not a bug)
- [ ] Switch tabs and come back mid-pick; the capture refreshes rather than going stale
- [ ] Scroll while picking: the loupe steps aside immediately and fades back in on the fresh capture
- [ ] Rapid stop-start scrolling never leaves the loupe showing stale pixels (captures are spaced for Chrome's 2/second cap)
- [ ] Point at a CSS gradient, a photo, a `<canvas>` and an SVG icon — the value matches the pixel, not the surface behind it
- [ ] `chrome://extensions` shows PickHue with **no** "Site access" section and no "read and change" warning

## Required URLs

| Field | Value |
|---|---|
| **Homepage** | https://pickhue.site |
| **Privacy policy** | https://pickhue.site/privacy |
| **Support** (optional) | https://github.com/alex-wilczewski/pickhue/issues |

## Store listing notes — "What's new"

**There is no dedicated "What's new" field** when you upload an extension update. You upload a new zip on the **Package** tab and submit for review; users do not see a separate release-notes box for extensions.

For 3.2.0:

1. **Detailed description** — replace with `store/DESCRIPTION.md`, which now leads
   on the permission change. Keep the "any of seven color formats" phrasing: the
   earlier rejection (Yellow Argon) was for listing the format names in a row.
2. **Screenshots** — they show the 3.0 coral accent, and the default is green
   again. The UI wears whatever the user picked, so the shots are not *wrong*,
   but they no longer match a first run. Worth recapturing when there is time;
   not a blocker for approval.
3. A listing edit and a package upload are reviewed together — expect one review,
   not two.

## Submit (update existing listing)

1. Dashboard → your **PickHue** item → **Package** → upload `pickhue-3.2.0.zip`
2. Confirm the draft package shows version **3.2.0**
3. **Privacy practices** → the host permission justification is gone; confirm the remaining three read as in `store/PERMISSIONS.md`
4. On the permissions review screen, confirm the set reads storage / activeTab / scripting with **no host permissions** and no `tabs`
5. **Store listing → Detailed description** — paste `store/DESCRIPTION.md`
6. Confirm privacy policy URL is current
7. **Submit for review**

## After approval

- Confirm Web Store users receive 3.2.0, and that the extension's card no longer lists site access
- The what's-new tab does **not** fire on a 3.1 → 3.2 update (it only opens when crossing a major version), so https://pickhue.site/whats-new is reached from the site and the listing rather than automatically
- Verify https://pickhue.site/whats-new and /goodbye are live before the rollout reaches users
