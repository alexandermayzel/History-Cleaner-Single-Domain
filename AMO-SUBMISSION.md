# AMO submission — version 1.0.0 (AMO pending)

Working document for the first submission of **History Cleaner - Single Domain** at
[Submit a New Add-on](https://addons.mozilla.org/developers/addon/submit/).
Not part of the extension package. Mozilla submission, review, signing and AMO
publication of version 1.0.0 remain pending.

For Mozilla submission, use the local
[history-cleaner-single-domain-1.0.0.zip](../history-cleaner-single-domain-1.0.0.zip)
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
| Version | 1.0.0 |
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
Initial release

• Clean the history of the exact host in the active tab from the toolbar. All visits to previewed URLs are removed across HTTP, HTTPS, paths and ports; other domains and subdomains are kept.
• Review the host and matching URL count before confirming deletion, then follow progress and the counts of deleted, skipped and failed URLs.
• Use German, English, Spanish, French, Brazilian Portuguese or Russian, selected automatically with English as the fallback. Includes light and dark appearance, keyboard controls and screen-reader labels.
• Process history locally, without data transmission, telemetry or persistent copies.

Cleanup applies throughout the Firefox profile, including other tabs and containers. There is no age filter or undo. New URLs first visited after the preview are excluded. Cookies, site storage, passwords, bookmarks and downloaded files are kept.

Requires Firefox Desktop 142 or later. MIT License.
```

### Deutsch

```text
Erste Veröffentlichung

• Den Verlauf des exakten Hosts im aktiven Tab über die Symbolleiste bereinigen. Alle Besuche der Vorschau-URLs werden über HTTP, HTTPS, Pfade und Ports hinweg entfernt; andere Domains und Subdomains bleiben erhalten.
• Host und Anzahl passender URLs vor dem Bestätigen der Löschung prüfen. Anschließend Fortschritt und Anzahlen gelöschter, übersprungener und fehlgeschlagener URLs verfolgen.
• Deutsch, Englisch, Spanisch, Französisch, Portugiesisch (Brasilien) oder Russisch nutzen, mit automatischer Sprachwahl und Englisch als Fallback. Mit heller und dunkler Darstellung, Tastaturbedienung und Beschriftungen für Screenreader.
• Den Verlauf ausschließlich lokal verarbeiten, ohne Datenübertragung, Telemetrie oder dauerhafte Kopien.

Die Bereinigung gilt im gesamten Firefox-Profil, auch für andere Tabs und Container. Es gibt keinen Altersfilter und keine Rückgängig-Funktion. Neue URLs, die erst nach der Vorschau besucht werden, sind ausgeschlossen. Cookies, Website-Speicher, Passwörter, Lesezeichen und heruntergeladene Dateien bleiben erhalten.

Benötigt Firefox Desktop ab Version 142. MIT-Lizenz.
```

## Notes to reviewer

English, one field, plain text; kept below 3,000 characters.

```text
Deletes history only for the exact hostname selected by the active HTTP(S) tab. A toolbar preview and a separate delete button are required.

RELEASE
First release, 1.0.0. Firefox Desktop 142+ only; Android is not supported. UI: German, English, Spanish, French, Brazilian Portuguese and Russian; English fallback. No account, external service or special hardware is required.

SOURCE
ZIP contains original readable source, archived unchanged. No compilation, bundling, minification or other build step. No third-party libraries, remote code, eval() or new Function(). MIT License, copyright 2026 Alexander Mayzel.

PERMISSIONS
activeTab: obtains the active tab URL after toolbar interaction, without a tabs or host permission.
history: searches local history, checks visits and calls history.deleteUrl for matching URLs. This permission is browser-wide; the extension enforces the hostname restriction itself.

SCOPE
Exact parsed URL.hostname, HTTP/HTTPS only, all paths and ports. example.org, www.example.org and other subdomains are separate targets. Search matches from titles, paths or unrelated hosts are filtered out. The search limit increases until results are complete.
Deletion removes all visits to each previewed URL throughout the profile, including visits from other tabs/containers. No age filter, history reconstruction or deleteAll/deleteRange calls. New URLs visited after the preview are excluded. Reloading a page can add history again. No undo. Cookies, site storage, bookmarks, passwords and downloaded files are untouched.

Only this extension's popup may request deletion. Preview tokens are single-use, expire after five minutes, and are held in memory. Active tab ID and hostname are checked again before deletion. Concurrent jobs are rejected. Progress counts URLs, not visits; failed and skipped URLs are reported separately.

DATA
Manifest data_collection_permissions.required is ["none"]. No network requests, telemetry, content scripts, persistent storage or third-party recipients. Preview data and the last job result exist only in background memory and may disappear when the background restarts.

TESTING
40 automated tests passed: 27 core/background and 13 popup tests. Covers long hosts, host isolation, status polling, live-region results, six languages, plural forms and number formatting. An earlier manual Firefox check was reported successful on 2026-10-17; detailed coverage was not recorded. Screen-reader and signed-package checks are pending.
Use a disposable Firefox profile with history enabled. Visit multiple paths on example.org and a different host (e.g. example.net). On example.org, open the toolbar popup, preview and delete. Check that all previewed example.org URLs are removed and example.net is retained. Repeat with a subdomain to check exact-host isolation, and with each UI language. On about:config deletion must be unavailable. No login is needed.
```

## Package verification

### AMO validation status

On 2026-10-17, the owner reported an Android compatibility warning for the
previous package with a minimum Firefox version of 140. The current package
sets `strict_min_version` to `142.0`, meeting the version required by that check
for `data_collection_permissions`. It still targets Firefox Desktop only:
`gecko_android` is absent and `required: ["none"]` is unchanged.

The rebuilt ZIP has not yet been revalidated by AMO. Upload it and check the
complete validation result before completing the submission. The earlier warning
does not describe the current package's minimum version.

References: [Mozilla data-consent documentation](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
and [MDN platform settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings#firefox_gecko_properties).

### Prepared archive

Prepared package: **19,451 bytes**, 14 files, SHA-256:

```text
89C02AEC2E0A0DE95364C29AA0ADF1B1D2E975C43E0E6E816C6E9CF4F16F57E4
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

## Checklist — 1.0.0 (local preparation)

Preparation completed locally:

- [x] Manifest version is `1.0.0`; ZIP filename and displayed name are correct.
- [x] MIT license with copyright 2026 Alexander Mayzel is included in the ZIP.
- [x] All six locale files are included; English is the fallback.
- [x] 40 tests passed: 27 core/background and 13 popup tests.
- [x] Both release-note blocks and reviewer notes remain below 3,000 characters.
- [x] All six listing summaries match their locale messages and are below 250 characters.
- [x] ZIP contents match the source files and exclude documentation and test artifacts.
- [x] Data declaration is `none`; only `activeTab` and `history` are requested.
- [x] Repository and support URLs have been verified.
- [x] An earlier manual Firefox check was reported successful by Alexander Mayzel
      on 2026-10-17. Browser version, platform and individual language coverage
      were not recorded; this does not confirm functional testing of later UI changes.

Before submitting:

- [ ] Record any additional coverage beyond the successful manual test:
      other-domain and subdomain preservation, unsupported tabs,
      all six languages, and reopening the popup.
- [ ] Confirm in Firefox that previewing alone changes no history and that
      cookies, bookmarks and passwords remain after deletion.
- [ ] Check screen-reader announcements for progress, failed/skipped URLs and
      interrupted cleanup.
- [ ] Check the minimum supported Firefox version and the intended desktop platforms.
- [ ] Upload the rebuilt ZIP with Firefox minimum version 142.0 and review the
      complete AMO validation result, including the earlier Android warning.
      Revalidation is pending; `web-ext lint` has not been run locally.
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
the earlier manual check does not document comprehensive functional coverage.

The upload sequence follows Mozilla's
[submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/).

## GitHub release status

The GitHub release remains a draft while Mozilla review, signing and AMO
publication are pending. The owner uploads release assets manually.

- Release title: `v1.0.0`.
- Release tag: `v1.0.0`; verify that it refers to the intended source.
- Release notes: English only, taken from [CHANGELOG.md](CHANGELOG.md).
- Package filename: `history-cleaner-single-domain-1.0.0.zip`; leave the asset
  label empty so GitHub displays the filename without an alternate label.
- The owner publishes the release manually only after **both** a Mozilla-reviewed
  file is available and the add-on is live in the AMO store. Availability of this
  local unsigned ZIP does not satisfy those conditions.

The local ZIP path above is the upload artifact. Add public release/download URLs
only after their actual publication has been confirmed.
