## What this changes

<!-- One or two sentences. If it fixes an issue, "Fixes #123". -->

## Why

<!-- The problem, not the patch. What was wrong for the person using PickHue? -->

## How it was checked

<!--
Tests are the floor, not the ceiling — colour bugs are page-specific. Say what
you pointed PickHue at: images, gradients, canvases, dark pages, light pages,
a PDF viewer, both themes.
-->

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] Tests added or updated, if this touches colour maths, the DOM probe,
      palette import/export, or the accent system
- [ ] Screenshots below, if this changes the UI (light and dark)
- [ ] No new permissions, and no new network calls
