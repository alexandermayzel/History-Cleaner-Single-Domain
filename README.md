# History Cleaner - Single Domain

A Firefox extension that deletes the browsing history for the **exact host in
your current tab**. Open its toolbar menu, check the host and URL count in the
preview, then confirm deletion. History for other domains and subdomains is kept.

> **License:** MIT. Copyright (c) 2026 Alexander Mayzel. See [LICENSE](LICENSE).

**Version 1.0.0 is being prepared for distribution.** Mozilla review, AMO store
publication and testing of the signed package are still pending.

[Installation](#installation) ·
[Features](#features) ·
[Requirements](#requirements) ·
[Usage](#usage) ·
[Things to know](#things-to-know) ·
[Permissions and privacy](#permissions-and-privacy) ·
[Project layout](#project-layout) ·
[Testing and packaging](#testing-and-packaging)

---

## Installation

**Mozilla Add-ons (planned)** —
[History Cleaner - Single Domain](https://addons.mozilla.org/en-US/firefox/addon/history-cleaner-single-domain/).
The listing is not published yet. This URL is provisional until Mozilla confirms
the slug during submission.

**From source** — open `about:debugging#/runtime/this-firefox`, select
**Load Temporary Add-on…**, and choose `manifest.json` from this directory.
The temporary installation lasts until Firefox closes. After editing the
source, use **Reload** on the same page.

**For a permanent installation** — regular Firefox requires a Mozilla-signed
extension. Once a signed `.xpi` is available, it can be installed through
`about:addons` → gear icon → **Install Add-on From File…**.
The ZIP produced by this project is an unsigned submission package.

**Pin to the toolbar** — open Firefox's extensions menu and choose **Pin to
Toolbar** to keep the button next to the address bar. Firefox also offers pinning
in its confirmation panel after a regular installation.

---

## Features

- **Preview before deletion.** The popup shows the exact host and the number of
  matching URLs. Creating a preview does not delete anything.
- **Complete history for that host.** Removes every saved visit to each URL in
  the preview, across HTTP, HTTPS, all paths and all ports.
- **Progress and results.** Deleted, skipped and failed URLs are counted
  separately. Cleanup continues if the popup closes; reopening it shows the
  available progress or result.
- **Accessible, multilingual interface.** Supports light and dark appearance,
  keyboard controls and screen-reader labels. English, German, Spanish, French,
  Brazilian Portuguese and Russian are selected automatically from Firefox's
  display language, with English as the fallback. Messages, numbers and plural
  forms follow the selected language and applicable regional formatting.
- **Local processing.** No network requests, telemetry or third-party services.

## Requirements

| Requirement | Supported |
|---|---|
| Browser | Firefox Desktop **140 or newer** |
| Current page | An HTTP or HTTPS website |
| Automated tests | Node.js **22 or newer** |

No account, external service or dependency installation is needed.

## Usage

1. Open the website whose history you want to remove.
2. Open the extension from Firefox's toolbar. Pin it from the extensions menu
   if you want its icon to stay visible.
3. Select **Preview** and check the host and URL count.
4. Select **Delete _n_ URLs** to start cleanup.
5. Check the result. Skipped URLs are already absent or no longer eligible;
   failed deletions are reported separately.

The active tab and host are checked again before cleanup starts. If either
has changed, reopen the menu and create a new preview.

---

## Things to know

### Exact hostname

For `https://www.example.com/article`, the extension selects URLs on
`www.example.com`, including HTTP, HTTPS, other paths and other ports.
`example.com`, `shop.example.com` and unrelated websites are separate hosts
and are kept. International domain names may appear as Punycode in the popup.

Internal Firefox pages such as `about:config`, empty tabs and local files are
not supported.

### Profile-wide history

The current tab chooses the host. Deletion affects that host's history
throughout the **entire Firefox profile**, including visits made in other
tabs or containers. Firefox does not provide a separate history for each tab.

There are **no age or date filters**. Cookies, website storage, passwords and
bookmarks are kept. Downloaded files are also kept, although associated
history entries may be included in the cleanup.

### Preview scope and deletion

The preview captures a set of URLs. Cleanup removes **all saved visits to each
of those URLs**, including the current page and repeat visits to the same URL
made after the preview but before its deletion.

New URLs first added to history after the preview are outside that cleanup.
Create a new preview to include them. Visiting or reloading a page after
deletion can add it to history again.

A preview is valid for five minutes and can also become unavailable if the
background process restarts. Counts refer to URLs, not individual visits.
**Deletion cannot be undone with this extension.**

## Permissions and privacy

| Permission | Purpose |
|---|---|
| `activeTab` | Identifies the current website when you open the extension from the toolbar. |
| `history` | Reads history entries and deletes the matching URLs. |

Firefox grants `history` access to the entire browsing history. The extension
enforces the exact-host restriction itself.

All processing takes place locally in Firefox. The extension has no network
requests, telemetry, content scripts or external libraries, and creates no
permanent additional copy of your history. Previews and results are held only
in the background process's memory.

---

## Project layout

```text
manifest.json          Firefox extension manifest (Manifest V3)
LICENSE                MIT License
README.md              Installation, usage and development notes
CHANGELOG.md           Version notes
AMO-SUBMISSION.md      Submission checklist and Mozilla reviewer notes
_locales/<lang>/       Translations (en, de, es, fr, pt_BR, ru)
src/
  history-core.js      Exact-host matching, URL collection and deletion
  background.js        Preview tokens, context checks and cleanup jobs
popup/
  popup.html           Toolbar popup markup
  popup.js             Preview, cleanup state and localization
  popup.css            Light and dark styles
icons/                 Extension icon
tests/                 Automated tests with browser API and DOM stubs
```

## Testing and packaging

The extension runs directly from its readable source files. No compilation
or dependency installation is required.

Run the automated tests with Node.js 22 or newer:

```sh
node --test tests/*.test.cjs
```

Create `history-cleaner-single-domain-1.0.0.zip` with these files and directories:

- `LICENSE`
- `manifest.json`
- `_locales/` — all six translation catalogs
- `src/` — background scripts
- `popup/` — popup markup, logic and styles
- `icons/` — extension icon

Place `manifest.json` at the archive root, with no enclosing project directory,
and use forward slashes in archive entry paths. Exclude tests, documentation,
Git metadata, local artifacts and browser profiles. No build step is required;
the extension scripts are packaged as written.

Validation results and the checks required for Mozilla submission are recorded
in [AMO-SUBMISSION.md](AMO-SUBMISSION.md). Version notes are in
[CHANGELOG.md](CHANGELOG.md).

The ZIP is the unsigned submission artifact; the Mozilla-signed `.xpi` is the
installable package.

## License

[MIT License](LICENSE). Copyright (c) 2026 Alexander Mayzel.

## Technical references

- [Mozilla: history.deleteUrl](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/history/deleteUrl)
- [Mozilla: history.search](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/history/search)
- [Mozilla: temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
- [Mozilla: signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Mozilla: pinning option in the installation confirmation (Firefox 140)](https://bugzilla.mozilla.org/show_bug.cgi?id=1948261)
