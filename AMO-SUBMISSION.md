# AMO submission — version 1.0.1 (planned)

Working document for the upcoming **History Cleaner - Single Domain** update.
Not part of the extension package. Version 1.0.1 has passed the owner's local test;
Mozilla submission, review, signing and publication of 1.0.1 are pending.

For Mozilla submission, use the local
[history-cleaner-single-domain-1.0.1.zip](../history-cleaner-single-domain-1.0.1.zip)
after the pre-upload checks below pass. The ZIP is unsigned; Mozilla signs the
submitted extension. No public GitHub release or download URL is assumed here.
The package is created directly in the parent `GIT` folder for the owner's manual
uploads. Packaging performs no automatic upload and leaves the existing draft unchanged.

Listing summaries, descriptions and optional privacy texts in all six languages
are in the local file `../AMO-BESCHREIBUNG-History-Cleaner-Single-Domain.md`,
outside the add-on folder and not tracked in this repository. Use those for the listing, and the blocks below for
this version's release notes and reviewer notes.

## Submission settings

| Field | Value |
| --- | --- |
| Distribution | On this site / Listed on AMO |
| Name | History Cleaner - Single Domain |
| Requested AMO URL slug | `history-cleaner-single-domain` — confirm during submission |
| Version | 1.0.1 |
| Default listing language | English (US); add German, Spanish, French, Portuguese (Brazil) and Russian |
| Compatibility | Firefox Desktop 142.0 and later; do not select Android |
| License | MIT License; copyright 2026 Alexander Mayzel |
| Payment, additional hardware or services | None required |
| Data collection | None; manifest declares `required: ["none"]` |
| Additional source-code upload | No; package contains the original, readable source |
| Support email | Leave empty |
| Support website | https://github.com/alexandermayzel/History-Cleaner-Single-Domain/issues |
| Homepage / source | https://github.com/alexandermayzel/History-Cleaner-Single-Domain |

Planned AMO page:
[History Cleaner - Single Domain](https://addons.mozilla.org/en-US/firefox/addon/history-cleaner-single-domain/).
This listing URL is not yet confirmed. Verify it during
[submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
and update the README if Mozilla assigns a different URL.

The extension ID is `history-cleaner-tab-only@local.addon`. It is a stable internal
identifier, not a contact address. Keep it unchanged for subsequent versions.

The data declaration describes transmission outside the extension/local browser.
This add-on reads and deletes history locally, without transmitting it. The
`history` API permission is still required. See Mozilla's
[data declaration guidance](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

Packaging archives the original files unchanged: no minification, transpilation,
generated application code or third-party dependencies. On that basis, a separate
source archive is not needed under Mozilla's
[source submission guidance](https://extensionworkshop.com/documentation/publish/source-code-submission/).

## Release notes

These are the AMO release notes in English and German, ready to paste as plain text.
GitHub release notes use only the English text from [CHANGELOG.md](CHANGELOG.md).
Both blocks are kept below 3,000 characters. The interface and listing descriptions
are available in all six languages; use English release notes for other locales.

### English

```text
Clearer wording and a more readable preview in all six languages: one message highlights the entry count and selected domain, with consistent section headings. The interface uses “domain” and “entries” consistently. Deletion still applies only to the exact domain shown; other domains and subdomains are kept.

Updated extension icon with a history clock and red trash can.
```

### Deutsch

```text
Verständlichere Texte und eine übersichtlichere Vorschau in allen sechs Sprachen: Eine gemeinsame Meldung hebt Anzahl und ausgewählte Domain hervor, ergänzt durch einheitliche Überschriften. Die Oberfläche verwendet einheitlich „Domain“ und „Einträge“. Die Löschung bleibt auf die exakt angezeigte Domain begrenzt; andere Domains und Subdomains bleiben erhalten.

Überarbeitetes Erweiterungssymbol mit Uhr und rotem Papierkorb.
```

## Notes to reviewer

English, one field, plain text; kept below 3,000 characters.

```text
Deletes history only for the exact hostname selected by the active HTTP(S) tab. A toolbar preview and a separate delete button are required.

RELEASE
1.0.1 clarifies all six translations, emphasizes the entry count and domain in a combined preview, and adds a history clock/red trash can icon. Deletion scope is unchanged. Firefox Desktop 142+ only; no Android. English fallback. No account, external service or special hardware is required.

SOURCE
ZIP contains original readable source, archived unchanged. No compilation, bundling, minification or other build step. No third-party libraries, remote code, eval() or new Function(). MIT License, copyright 2026 Alexander Mayzel.

PERMISSIONS
activeTab: obtains the active tab URL after toolbar interaction, without a tabs or host permission.
history: searches local history, checks visits and calls history.deleteUrl for matching URLs. This permission is browser-wide; the extension enforces the hostname restriction itself.

SCOPE
“Domain” in the UI means exact parsed URL.hostname: HTTP/HTTPS only, all paths and ports. example.org, www.example.org and other subdomains are separate targets. Search matches from titles, paths or unrelated hosts are filtered out. The search limit increases until results are complete.
Deletion removes all visits to each previewed URL throughout the profile, including visits from other tabs/containers. No age filter, history reconstruction or deleteAll/deleteRange calls. New URLs visited after the preview are excluded. Reloading a page can add history again. No undo. Cookies, site storage, bookmarks, passwords and downloaded files are untouched.

Only this extension's popup may request deletion. Preview tokens are single-use, expire after five minutes, and are held in memory. Active tab ID and hostname are checked again before deletion. Concurrent jobs are rejected. Entries count distinct URLs, not visits; failures and skips are reported separately.

DATA
Manifest data_collection_permissions.required is ["none"]. No network requests, telemetry, content scripts, persistent storage or third-party recipients. Preview data and the last job result exist only in background memory and may disappear when the background restarts.

TESTING
42 automated tests passed on 2026-10-17 (27 core/background, 15 popup), covering all six locales, preview emphasis, stale/empty previews, hostname isolation, polling and accessibility. Owner confirmed local 1.0.1 testing passed on 2026-10-17; detailed coverage and signed-package tests are not documented.
Use a disposable Firefox profile with history enabled. Visit multiple paths on example.org and a different host (e.g. example.net). On example.org, open the toolbar popup, preview and delete. Check that all previewed example.org URLs are removed and example.net is retained. Repeat with a subdomain to check exact-host isolation, and with each UI language. On about:config deletion must be unavailable. No login is needed.
```

## Package verification

### AMO validation status

During preparation of 1.0.0, the owner reported an Android compatibility warning
for a package with a minimum Firefox version of 140. The current manifest
sets `strict_min_version` to `142.0`, meeting the version required by that check
for `data_collection_permissions`. It still targets Firefox Desktop only:
`gecko_android` is absent and `required: ["none"]` is unchanged.

AMO validation of 1.0.1 is pending. Check the complete validation result when this
version is submitted. The earlier warning does not describe its minimum version.

References: [Mozilla data-consent documentation](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
and [MDN platform settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings#firefox_gecko_properties).

### Prepared archive

Prepared package: **19,910 bytes**, 14 files, SHA-256:

```text
784D8E219DB123C40B591F5C86C594CC139239ED3CDBFABCB6A243DABDDC5063
```

`manifest.json` is the only source of the extension version. To create the upload
package with a ZIP archiver:

1. Read `version` from `manifest.json` and name the archive
   `history-cleaner-single-domain-<version>.zip`.
2. Save the archive directly in the parent `GIT` directory, outside this project.
3. Add exactly these 14 files, preserving their relative paths:

```text
LICENSE
manifest.json
_locales/de/messages.json
_locales/en/messages.json
_locales/es/messages.json
_locales/fr/messages.json
_locales/pt_BR/messages.json
_locales/ru/messages.json
src/history-core.js
src/background.js
popup/popup.html
popup/popup.css
popup/popup.js
icons/icon.svg
```

The archive must contain `manifest.json` at its root, without a containing project
folder, and use forward slashes in archive paths. Exclude documentation, tests,
Git data, test profiles and logs. No dependency
installation, compilation or private tooling is needed. ZIP metadata can affect
the archive hash; verify the new archive and update the size/hash above after
repackaging.

Run the automated tests from the project folder with Node.js 22 or later:

```sh
node --test tests/*.test.cjs
```

## Checklist — 1.0.1 (local preparation)

Verify against the final 1.0.1 sources and package:

- [x] Manifest version is `1.0.1`; ZIP filename and displayed name are correct.
- [x] MIT license with copyright 2026 Alexander Mayzel is included in the ZIP.
- [x] All six locale files are included; English is the fallback.
- [x] 42 tests passed on 2026-10-17: 27 core/background and 15 popup tests.
- [x] Alexander Mayzel confirmed successful local testing of 1.0.1 on 2026-10-17.
- [x] Both release-note blocks and reviewer notes remain below 3,000 characters.
- [x] All six listing summaries match their locale messages and are below 250 characters.
- [x] ZIP contents match the source files and exclude documentation and test artifacts.
- [x] The approved clock-and-trash icon is used in the manifest and popup;
      the matching AMO PNG is 128 × 128 pixels with transparency.
- [x] Data declaration is `none`; only `activeTab` and `history` are requested.
- [ ] Confirm repository, support and AMO URLs before submission.

Alexander Mayzel reported successful local testing of the final 1.0.1 on
2026-10-17. Browser version and individual platform, language and accessibility
coverage were not specified. This confirms the owner's local test, not testing
of a Mozilla-signed package.

Before submitting:

- [ ] Record any additional coverage beyond the successful manual test:
      other-domain and subdomain preservation, unsupported tabs,
      all six languages, and reopening the popup.
- [ ] Confirm in Firefox that previewing alone changes no history and that
      cookies, bookmarks and passwords remain after deletion.
- [ ] Check screen-reader announcements for progress, failed/skipped URLs and
      interrupted cleanup.
- [ ] Check the minimum supported Firefox version and the intended desktop platforms.
- [ ] Upload the 1.0.1 ZIP and review the complete AMO validation result.
      Validation is pending; `web-ext lint` has not been run locally.
- [ ] Fill in all six listing languages from the external description file; choose categories
      and optionally add screenshots without private browsing data.
- [ ] Paste release notes for English and German, and the English reviewer notes.
- [ ] Select MIT and confirm that the AMO data declaration matches `none`.
- [ ] Keep support email empty; do not enter an unverified project/contact URL.
- [ ] Review the complete submission and submit it through AMO.

After Mozilla signs the package:

- [ ] On a regular first installation, check Firefox's native **Pin extension to
      toolbar** option, then verify the version shown at the bottom of the popup.
- [ ] Install the signed package in a disposable profile and repeat the functional
      checks. Update this document with actual results before treating them as passed.

Signed installation remains open. Automated tests use simulated browser APIs;
the owner's local test does not document comprehensive platform/language coverage.

The upload sequence follows Mozilla's
[submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/).

## GitHub release status

The owner authorized the GitHub handoff of 1.0.1 after successful local testing.
Prepared release metadata is draft-only. GitHub publication waits for Mozilla
review and the AMO listing; the owner uploads release assets and publishes manually.

- Planned release title: `v1.0.1`.
- Planned release tag: `v1.0.1`; verify that it refers to the intended source.
- Release notes: English only, taken from [CHANGELOG.md](CHANGELOG.md).
- Package filename: `history-cleaner-single-domain-1.0.1.zip`; leave the asset
  label empty so GitHub displays the filename without an alternate label.
- The owner publishes the release manually only after **both** a Mozilla-reviewed
  file is available and the add-on is live in the AMO store. Availability of this
  local unsigned ZIP does not satisfy those conditions.

The local ZIP path above is the upload artifact. Add public release/download URLs
only after their actual publication has been confirmed.
