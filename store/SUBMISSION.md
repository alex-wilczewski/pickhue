# PickHue — Chrome Web Store submission guide (v2.0.2)

Use this checklist when uploading **PickHue 2.0.2** to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

> **Status:** v2.0.1 is live on the Web Store. This guide is for the **2.0.2 polish update**. Listing copy can stay as for 2.0 — no store text rewrite required.

## Before you upload

```bash
npm install
npm run package          # builds dist/ and creates pickhue-2.0.2.zip
npm run typecheck        # optional sanity check
```

### Manual QA checklist (v2.0.2)

- [ ] Fresh load of `dist/` on a test profile
- [ ] Hover a recent color — remove control appears, then custom tooltip below after a short delay
- [ ] Remove a recent color; empty strip / selection mode still behave
- [ ] Palette row menu shows Rename / Export / Move / Delete with outline icons
- [ ] Export All / Export… offer hex list, CSS, ASE, JSON
- [ ] Empty palette editor — “Select Color” link starts the picker
- [ ] Import dialog textarea scrolls with the wheel
- [ ] Existing 2.0 / 2.0.1 flows still work

## Required URLs

| Field | Value |
|---|---|
| **Homepage** | https://pickhue.site |
| **Privacy policy** | https://pickhue.site/privacy |
| **Support** (optional) | https://github.com/alex-wilczewski/pickhue/issues |

## Store “What’s new” (2.0.2)

> Custom swatch tooltips, unified icons, clearer export options, and small reliability polish.

## Submit (update existing listing)

1. Dashboard → your **PickHue** item → **Package** → upload `pickhue-2.0.2.zip`
2. Add the “What’s new” note above (listing description can stay as for 2.0)
3. Confirm privacy policy URL is current
4. **Submit for review**

## After approval

- Confirm Web Store users receive 2.0.2
- Optionally note the update on https://pickhue.site / GitHub release comments
