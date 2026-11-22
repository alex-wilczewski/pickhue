# Contributing to PickHue

PickHue is open source under the [MIT licence](./LICENSE). Bug reports, ideas,
and pull requests are all welcome.

It is also a small, opinionated tool maintained by one person, so the fastest
way to get a change merged is to open an issue first and check the direction
fits. Nobody enjoys having a finished pull request turned down.

## Getting it running

```bash
git clone https://github.com/alex-wilczewski/pickhue.git
cd pickhue
npm install
npm run dev        # rebuilds dist/ on change
```

Then open `chrome://extensions` (or `brave://extensions`), enable **Developer
mode**, choose **Load unpacked**, and select the `dist/` folder. After a
rebuild, hit the reload icon on the PickHue card and refresh the page you are
testing on — content scripts do not hot-reload.

```bash
npm test           # vitest, once
npm run test:watch # vitest, watching
npm run typecheck  # tsc --noEmit
npm run build      # production build (icons + content script included)
npm run package    # build, verify the manifest, zip for the Web Store
```

## Before you open a pull request

- `npm run typecheck && npm test` both pass. CI runs them plus a build.
- Colour maths, the DOM probe, palette import/export, and the accent system are
  covered by tests. Changing any of them means changing or adding tests —
  these are the parts where a quiet mistake copies the wrong value to someone's
  clipboard or loses their saved palettes.
- UI changes get a screenshot in the pull request, light theme and dark.
- Describe what you checked by hand. "Picked on a `<canvas>`, a gradient, and a
  PDF viewer" is worth more than "tested".

## Things that are deliberate

Some code looks odd until you know why. If a change touches one of these,
please say so explicitly in the pull request:

- **No `host_permissions`.** PickHue runs on `activeTab` alone so that
  installing it shows no site-access warning. CI fails if the built manifest
  asks for anything more. See [store/PERMISSIONS.md](store/PERMISSIONS.md).
- **The captured bitmap wins.** The DOM probe is an accuracy aid for text and
  antialiased edges. Anything that paints its own pixels — images, canvases,
  gradients, SVG — falls back to the screenshot, which is ground truth.
- **Copied values are bare.** `31, 111, 235`, not `rgb(31, 111, 235)`, so the
  string drops straight into a design tool's input.
- **The panel lives in a shadow root.** Host page CSS must never reach it, and
  PickHue's CSS must never leak out.
- **Nothing leaves the machine.** No analytics, no remote code, no network
  calls. A dependency that phones home will not be merged.

## Reporting a bug

Use the issue template — the browser, the extension version, and the URL where
it happened are usually what makes a colour bug reproducible. If a picked
colour was wrong, the most useful thing you can include is a screenshot with
the loupe visible and what the value should have been.

## Security

Found something with security or privacy implications? Please do not open a
public issue — email the address on the GitHub profile instead, and give it a
few days before disclosing.
