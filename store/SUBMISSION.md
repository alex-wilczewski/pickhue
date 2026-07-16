# PickHue — Chrome Web Store submission guide (v2.0.3)

Use this checklist when uploading **PickHue 2.0.3** to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

> **Status:** v2.0.2 is live on the Web Store. This guide is for the **2.0.3 update**. Listing copy can stay as for 2.0 — no store text rewrite required.

## Before you upload

```bash
npm install
npm run package          # builds dist/ and creates pickhue-2.0.3.zip
npm run typecheck        # optional sanity check
```

### Manual QA checklist (v2.0.3)

- [ ] Fresh load of `dist/` on a test profile
- [ ] Theme: light / dark / system — loupe hint and copy toast match the panel theme
- [ ] Light-mode toast and hint are slightly translucent (not opaque white)
- [ ] Save to palette → palettes greyed until a recent swatch is selected; then green pulse appears
- [ ] Gear icon visible but disabled during save flow (not hidden)
- [ ] “Add colors” confirm is green; Cancel stays grey
- [ ] Pick-toast Save to palette menu opens and dismisses correctly
- [ ] Existing 2.0.2 flows still work

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
   > What’s new in 2.0.3: Theme-aware picker overlays, Save to palette flow polish, and UI fixes.
2. **After approval:** Mention the update on https://pickhue.site or in GitHub release comments.

You do **not** need to change listing text to ship 2.0.3.

## Submit (update existing listing)

1. Dashboard → your **PickHue** item → **Package** → upload `pickhue-2.0.3.zip`
2. Confirm the draft package shows version **2.0.3**
3. Confirm privacy policy URL is current (no listing rewrite required)
4. **Submit for review**

## After approval

- Confirm Web Store users receive 2.0.3
- Optionally note the update on https://pickhue.site / GitHub release comments
