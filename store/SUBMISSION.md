# PickHue — Chrome Web Store submission guide (v2.0.4)

Use this checklist when uploading **PickHue 2.0.4** to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

> **Status:** Previous 2.0.3 draft was rejected for requesting the unnecessary `tabs` permission (Purple Potassium). This build removes it and adds Recent Colors / picker polish.

## Before you upload

```bash
npm install
npm run package          # builds dist/ and creates pickhue-2.0.4.zip
npm run typecheck        # optional sanity check
```

### Permission check (required)

Open `dist/manifest.json` and confirm:

- `permissions` is exactly: `storage`, `activeTab`, `scripting`
- There is **no** `"tabs"` permission
- `host_permissions` still includes `<all_urls>` (needed for capture / inject)

### Manual QA checklist (v2.0.4)

- [ ] Fresh load of `dist/` on a test profile
- [ ] Toolbar click toggles panel on a normal https page
- [ ] Eyedropper captures and copies a color (activeTab + host access, no `tabs`)
- [ ] Format setting is a dropdown; changing it updates copied / recent labels
- [ ] Clear all removes recent colors after confirm
- [ ] Empty Recent Colors text starts the picker
- [ ] Loupe color chip stays visible at the bottom of a tall page; flips below near the top
- [ ] Theme: light / dark / system — panel toast, copy toast, confirm modals, loupe chip
- [ ] Existing Save to palette / import / export flows still work

## Required URLs

| Field | Value |
|---|---|
| **Homepage** | https://pickhue.site |
| **Privacy policy** | https://pickhue.site/privacy |
| **Support** (optional) | https://github.com/alex-wilczewski/pickhue/issues |

## Store listing notes — “What’s new”

**There is no dedicated “What’s new” field** when you upload an extension update in the Chrome Web Store Developer Dashboard. You upload a new zip on the **Package** tab and submit for review; users do not see a separate release-notes box for extensions (unlike some mobile app stores).

If you want store visitors to see update copy, your only options are:

1. **Optional:** Edit the **Store listing** → **Detailed description** and prepend a line such as:
   > What’s new in 2.0.4: Removed unused tabs permission; Clear all recent colors; format dropdown; loupe chip stays on-screen; empty-state Select Color shortcut.
2. **After approval:** Mention the update on https://pickhue.site or in GitHub release comments.

You do **not** need to change listing text to ship 2.0.4.

## Submit (update existing listing)

1. Dashboard → your **PickHue** item → **Package** → upload `pickhue-2.0.4.zip`
2. Confirm the draft package shows version **2.0.4**
3. Confirm privacy policy URL is current (no listing rewrite required)
4. On the permissions review screen, confirm `tabs` is **not** listed
5. **Submit for review**

## After approval

- Confirm Web Store users receive 2.0.4
- Optionally note the update on https://pickhue.site / GitHub release comments
