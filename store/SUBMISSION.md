# PickHue — Chrome Web Store submission guide (v2.0)

Use this checklist when uploading **PickHue 2.0** to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

> **Status:** v0.1.1 is live on the Web Store. Use this guide for the **2.0 update** (palettes). GitHub [release 2.0.0](https://github.com/alex-wilczewski/pickhue/releases/tag/2.0.0) is available for early developer install while review is pending.

## Before you upload

```bash
npm install
npm run package          # builds dist/ and creates pickhue-2.0.0.zip
npm run typecheck        # optional sanity check
npm run screenshots      # regenerates store/screenshots/*.png (update scenes for palettes first)
```

### Manual QA checklist (v2.0)

- [ ] Fresh load of `dist/` on a test profile
- [ ] Pick a color → copy toast → **Save to palette** works
- [ ] **Save to palette** from Recent Colors (multi-select → choose palette → confirm)
- [ ] Create / rename / reorder / delete palette in editor
- [ ] **From Recents** in editor adds colors
- [ ] Import merge + replace (JSON, ASE, CSS, hex list)
- [ ] Export All (JSON, ASE, hex clipboard)
- [ ] OKLCH format copies correctly
- [ ] Theme switcher (system / light / dark)
- [ ] Privacy policy live at https://pickhue.site/privacy (includes palettes + OKLCH)
- [ ] Landing page mentions palettes (pickhue.site)

## Required URLs

| Field | Value |
|---|---|
| **Homepage** | https://pickhue.site |
| **Privacy policy** | https://pickhue.site/privacy |
| **Support** (optional) | https://github.com/alex-wilczewski/pickhue/issues |

> Deploy updated `store/privacy.html` to `https://pickhue.site/privacy` **before** submitting the 2.0 update.

## Store listing copy (updated for 2.0)

**Name:** PickHue

**Summary** (max 132 characters):

> Pick colors from any page with a magnifier. Palettes, HEX/RGB/HSL/OKLCH. Import ASE & CSS. Private — nothing leaves your device.

**Description:**

> PickHue is an elegant color picker for Chrome and Brave.
>
> Click the toolbar icon to open a clean panel right on the page. Hit **Select Color** to activate a circular magnifier that follows your cursor — click any pixel to copy it instantly.
>
> **Features**
> - Pixel-precise eyedropper with magnifier loupe
> - Copy as HEX, RGB, HSL, or OKLCH
> - Recent colors with one-click re-copy
> - **Saved palettes** — name, organize, reorder, and batch-save from recents
> - **Import & export** — PickHue JSON, Adobe ASE, CSS variables, hex lists
> - System, light, and dark themes
> - Fully local — no accounts, no servers, no tracking
>
> **Privacy**
> PickHue does not collect or transmit personal data. Settings, recent colors, and saved palettes are stored only in your browser.
>
> **Note**
> Color picking is not available on browser-internal pages (e.g. chrome://) or the Chrome Web Store, per browser security policy.

**Category:** Productivity

**Language:** English

**Pricing:** Free

## Screenshots

Upload PNGs from `store/screenshots/` (1280×800). **Update or add scenes** for v2.0:

| File | Suggested content |
|---|---|
| `01-panel-dark.png` | Home panel with Saved Palettes visible |
| `02-panel-light.png` | Light theme panel |
| `03-magnifier.png` | Eyedropper loupe |
| `04-copied.png` | Copy toast with Save to palette |
| *(new, optional)* | Palette editor with swatches |

Regenerate: `npm run screenshots` after editing the HTML scenes in `store/screenshots/`.

## Privacy practices (dashboard form)

| Question | Answer |
|---|---|
| Single purpose | Color picking from web pages |
| Collects user data? | **No** (no transmission to developer servers) |
| Uses chrome.storage? | **Yes** — theme, format, recent colors, saved palettes (local/sync only) |
| Host permission justification | Required to inject the picker UI and sample pixel colors from the visible page when the user activates the eyedropper. PickHue only runs when the user clicks the toolbar icon. |

## Permission justifications (if prompted)

- **`activeTab`** — Access the current tab when the user clicks the extension icon.
- **`scripting`** — Inject the panel and eyedropper into the active page.
- **`storage`** — Save theme, color format, recent colors, and saved palettes locally.
- **`host_permissions: <all_urls>`** — Allow the eyedropper to run on pages the user chooses to pick colors from.

## Submit (update existing listing)

1. Dashboard → your **PickHue** item → **Package** → upload `pickhue-2.0.0.zip`
2. Update listing description, summary, and screenshots for palettes
3. Confirm privacy policy URL is current
4. Complete privacy practices questionnaire (note palette storage)
5. **Submit for review** (typically 1–3 business days; broad host permissions may take longer)

## After approval

- Update https://pickhue.site with v2.0 features and store link
- Publish GitHub release `2.0.0` as **latest** (remove pre-release flag if set)
- Announce on README / release notes that Web Store is live

## Landing page prep (separate repo)

Suggested sections for pickhue.site:

- Hero: mention **palettes** alongside the eyedropper
- Feature grid: Saved palettes, Import/Export (ASE, CSS, JSON), OKLCH
- Install CTA: Chrome Web Store button (primary) + GitHub early access link (secondary until store approval)
- Privacy link unchanged
- Optional: short GIF of Save to palette flow
