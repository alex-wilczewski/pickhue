# PickHue — Chrome Web Store submission guide (v2.0.1)

Use this checklist when uploading **PickHue 2.0.1** to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

> **Status:** v2.0.0 is live on the Web Store. This guide is for the **2.0.1 polish update**.

## Before you upload

```bash
npm install
npm run package          # builds dist/ and creates pickhue-2.0.1.zip
npm run typecheck        # optional sanity check
```

### Manual QA checklist (v2.0.1)

- [ ] Fresh load of `dist/` on a test profile
- [ ] New/open palette — title looks editable without hover
- [ ] 6+ saved palettes — list scrolls, fade cue appears, page behind does not scroll while hovering the list
- [ ] Palette row menu → **Move** — drag to reorder, Escape cancels
- [ ] Preview shows at most 4 swatches (+ ellipsis when more)
- [ ] From Recents modal edges look clean at 100% and high zoom
- [ ] Existing 2.0 flows still work (save to palette, import/export, editor)

## Required URLs

| Field | Value |
|---|---|
| **Homepage** | https://pickhue.site |
| **Privacy policy** | https://pickhue.site/privacy |
| **Support** (optional) | https://github.com/alex-wilczewski/pickhue/issues |

## Store “What’s new” (2.0.1)

> Clearer palette rename field, scrollable saved palettes with a soft fade, drag-to-reorder via Move, and small UI polish.

## Submit (update existing listing)

1. Dashboard → your **PickHue** item → **Package** → upload `pickhue-2.0.1.zip`
2. Add the “What’s new” note above (listing copy can stay as for 2.0 unless you want a tweak)
3. Confirm privacy policy URL is current
4. **Submit for review**

## After approval

- Confirm Web Store users receive 2.0.1
- Optionally note the update on https://pickhue.site / GitHub release comments
