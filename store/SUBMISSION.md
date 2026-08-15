# PickHue — Chrome Web Store submission guide (v3.0.0)

Use this checklist when uploading **PickHue 3.0.0** to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

> **Status:** 2.0.4 shipped clean after the 2.0.3 `tabs`-permission rejection (Purple Potassium). 3.0.0 keeps the same permission set — no new warnings, so existing users auto-update without a re-consent prompt.

## Before you upload

```bash
npm install
npm run package          # builds dist/ and creates pickhue-3.0.0.zip
npm run typecheck        # optional sanity check
```

### Permission check (required)

Open `dist/manifest.json` and confirm:

- `permissions` is exactly: `storage`, `activeTab`, `scripting`
- There is **no** `"tabs"` permission
- `host_permissions` still includes `<all_urls>` (needed for capture / inject)
- `commands` declares `start-picker` (`Alt+Shift+P`) — this key needs **no** permission and triggers **no** new install warning

### What changed vs 2.0.4 (permissions view)

| Manifest field | 2.0.4 | 3.0.0 |
|---|---|---|
| `permissions` | storage, activeTab, scripting | **unchanged** |
| `host_permissions` | `<all_urls>` | **unchanged** |
| `commands` | — | `start-picker` (new, no warning) |

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
- [ ] A near-neutral / gray pick falls back to the coral default
- [ ] Loupe: ring previews the hovered color, zoom badge sits on the glass
- [ ] Copy toast: `+` saves to a palette and morphs into ✓ with the palette name; hover pauses auto-dismiss
- [ ] Palette editor: count + Export in the meta row, `⋯` menu offers Duplicate and Delete
- [ ] Palette editor: drag reorder shows the insertion bar; arrow keys reorder a focused swatch (Shift jumps to ends)
- [ ] Shades & tints: a swatch opens the 10-step ramp; click copies, `+` adds
- [ ] Tailwind export produces a pasteable `tailwind.config.js` snippet
- [ ] Theme: light / dark / system across panel, toasts, modals, loupe chip
- [ ] `prefers-reduced-motion` enabled — animations degrade, nothing breaks
- [ ] Import / export of existing palettes still works after upgrading from 2.0.4

## Required URLs

| Field | Value |
|---|---|
| **Homepage** | https://pickhue.site |
| **Privacy policy** | https://pickhue.site/privacy |
| **Support** (optional) | https://github.com/alex-wilczewski/pickhue/issues |

## Store listing notes — "What's new"

**There is no dedicated "What's new" field** when you upload an extension update. You upload a new zip on the **Package** tab and submit for review; users do not see a separate release-notes box for extensions.

Because 3.0.0 is a major redesign, it *is* worth refreshing the listing this time:

1. **Store listing → Detailed description** — lead with the 3.0 headline, e.g.
   > New in 3.0: PickHue now wears your colors — the whole UI tints itself to your last pick. Plus an Alt+Shift+P keyboard eyedropper, shades & tints ramps, Tailwind export, and a rebuilt palette editor.
2. **Screenshots** — the accent-tinted UI looks materially different from the 2.x shots; consider recapturing.
3. Editing listing text is optional for approval, but the old screenshots will misrepresent the new UI.

## Submit (update existing listing)

1. Dashboard → your **PickHue** item → **Package** → upload `pickhue-3.0.0.zip`
2. Confirm the draft package shows version **3.0.0**
3. Confirm privacy policy URL is current
4. On the permissions review screen, confirm `tabs` is **not** listed and the set still reads storage / activeTab / scripting + `<all_urls>`
5. Optionally refresh Store listing description and screenshots (see above)
6. **Submit for review**

## After approval

- Confirm Web Store users receive 3.0.0 and the what's-new tab fires once on upgrade
- Verify https://pickhue.site/whats-new and /goodbye are live before the rollout reaches users
- Optionally note the update on https://pickhue.site / GitHub release comments
