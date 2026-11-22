# PickHue — permissions

**Short version:** PickHue asks for three permissions, none of which show a
warning when you install it. It cannot read any page until you click its icon
or press its shortcut, and that access ends the moment the tab navigates away.
Nothing is ever sent anywhere.

## What PickHue declares

```json
"permissions": ["storage", "activeTab", "scripting"]
```

There are **no `host_permissions`**. PickHue does not declare `<all_urls>`, does
not declare the `tabs` permission, and requests no optional permissions.

| Permission | Why it is needed |
|---|---|
| `activeTab` | Grants temporary access to the one tab you invoked PickHue on, so it can screenshot the visible area and sample the pixel under your cursor. Granted on your click (or `Alt+Shift+P`) and revoked when that tab navigates away or closes. |
| `scripting` | Injects the picker overlay and panel into that tab, on demand. PickHue declares no automatic content scripts, so nothing runs on any page until you ask for it. |
| `storage` | Saves your settings, recent colors, and palettes. Uses `chrome.storage.sync`, so palettes follow your Chrome profile across devices. Nothing leaves Google's sync for your own account. |

## Why there is no `<all_urls>`

Through 3.1.x, PickHue also declared `host_permissions: ["<all_urls>"]`, which
makes Chrome warn at install that the extension can **"read and change all your
data on all websites."** That warning overstated what PickHue does, and it
contradicted the product's own promise.

`activeTab` is an alternative to host access, not a companion to it. Per
Chrome's documentation, `tabs.captureVisibleTab` requires *"either the
`<all_urls>` permission or the activeTab permission"*, and
`scripting.executeScript` may run on the active tab under `activeTab` when
`scripting` is also declared. Both of PickHue's entry points — the toolbar
action and the `start-picker` command — are listed `activeTab` invocation
triggers, so each one re-grants access to the current tab.

The result: identical capability, and `activeTab` *"displays no warning message
during installation."*

### The trade-off

An `activeTab` grant ends when the tab navigates. If you leave the panel open
and navigate to a different page in the same tab, PickHue needs invoking again
(click the icon or press the shortcut) before it can sample that new page. This
is the intended cost: access is scoped to the moment you asked for it.

## Dashboard justification fields (paste as-is)

The Web Store's **Privacy practices** tab asks for one justification per
permission, max 1,000 characters each. Since 3.2.0 there is no host permission
field — removing `<all_urls>` removed the box with it.

### storage

```
Stores PickHue's own settings and data in Chrome's extension storage: theme preference, preferred color format, recent color picks, and saved palettes — named sets of colors the user chooses to keep. This is what lets preferences and palettes persist between sessions and follow the user across devices where they are signed into Chrome. PickHue has no backend: nothing is sent to any server we operate or to any third party, and there is no analytics or tracking.
```

### activeTab

```
Required to read the single tab the user invokes PickHue on. When the user clicks the toolbar icon or presses the keyboard shortcut (Alt+Shift+P), PickHue captures the visible area of that tab with tabs.captureVisibleTab and samples the pixel under the cursor, which is how the eyedropper reports an accurate color. PickHue declares no host permissions: activeTab is its only page access, it is granted only by that explicit user gesture, and it ends when the tab navigates away or closes. Page content is never stored or transmitted — the capture is held in memory while picking and discarded as soon as it stops.
```

### scripting

```
Required to inject PickHue's panel and eyedropper overlay into the active tab when the user invokes the extension. PickHue declares no automatic content scripts, so nothing runs on any page until the user asks for it. The script is bundled in the package and injected on demand; no remote code is loaded.
```

### Single purpose

```
PickHue lets users pick colors from webpages using an on-page eyedropper magnifier and copy them to the clipboard.
```

Palettes and recent colors are supporting functionality for that one purpose,
so they do not belong in this field — Chrome wants it narrow.

## What PickHue cannot do

- It cannot run on browser-internal pages (`chrome://`, `brave://`, `edge://`,
  `about:`) or on the Chrome Web Store. Chrome forbids scripting there.
- It cannot read a page you have not invoked it on.
- It cannot read a page after that tab has navigated, until you invoke it again.
- It cannot see anything on a tab you have never opened PickHue on.

## What PickHue does with what it reads

It samples a screenshot of the visible tab area to find the color under your
cursor, and reads computed CSS at that point so solid fills and text match what
DevTools reports. Both happen locally, in the page, and the screenshot is
discarded as soon as you stop picking.

No analytics. No accounts. No remote code — the entire bundle ships in the
package. No network requests of any kind, other than opening `pickhue.site` in a
new tab if you click a link or uninstall.
