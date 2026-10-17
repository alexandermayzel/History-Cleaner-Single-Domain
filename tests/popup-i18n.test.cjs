"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const popupSource = fs.readFileSync(path.join(root, "popup/popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(root, "popup/popup.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const locales = ["de", "en", "es", "fr", "pt_BR", "ru"];
const catalogs = Object.fromEntries(locales.map(locale => [locale,
  JSON.parse(fs.readFileSync(path.join(root, "_locales", locale, "messages.json"), "utf8"))
]));
const countGroups = ["previewSummary", "deleteCount", "urlCount", "jobDeleted", "jobSkipped", "jobFailed"];

function translated(locale, key, substitutions = []) {
  const entry = catalogs[locale][key] || catalogs.en[key];
  if (!entry) return "";
  return entry.message.replace(/\$([a-z]+)\$/gi, (_, name) => {
    const position = Number(entry.placeholders[name.toLowerCase()].content.slice(1)) - 1;
    return substitutions[position] ?? "";
  });
}

function settle() {
  return new Promise(resolve => setImmediate(resolve));
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function makeClock() {
  let now = 0, nextId = 0;
  const timers = new Map();
  const errors = [];
  return {
    timers,
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    async advance(milliseconds) {
      const target = now + milliseconds;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.due <= target)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.due;
        timers.delete(id);
        Promise.resolve(timer.callback()).catch(error => errors.push(error));
        await settle();
        if (errors.length) throw errors.shift();
      }
      now = target;
      await settle();
      if (errors.length) throw errors.shift();
    }
  };
}

function runningJob(overrides = {}) {
  return {
    id: "job", hostname: "example.org", status: "running", total: 21,
    processed: 0, deleted: 0, skipped: 0, failed: 0, error: null, ...overrides
  };
}

async function makePopup(locale, browserLanguage = locale.replace("_", "-"), unsupported = false, options = {}) {
  const nodes = [], parents = [];
  for (const [tag] of popupHtml.matchAll(/<\/?[a-z][^>]*>/gi)) {
    if (tag.startsWith("</")) { parents.pop(); continue; }
    const tagName = /^<([a-z][\w-]*)/i.exec(tag)[1].toLowerCase();
    const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(([, name, value]) => [name, value]));
    const dataset = {};
    if (attributes["data-i18n"]) dataset.i18n = attributes["data-i18n"];
    if (attributes["data-i18n-aria-label"]) dataset.i18nAriaLabel = attributes["data-i18n-aria-label"];
    const node = {
      attributes, dataset, tagName, parent: parents.at(-1), listeners: {},
      hidden: /\shidden(?:\s|>)/.test(tag), disabled: /\sdisabled(?:\s|>)/.test(tag),
      text: "", writes: [], childNodes: [],
      get textContent() { return this.text + this.childNodes.map(child => child.textContent).join(""); },
      set textContent(value) { this.childNodes = []; this.text = value; this.writes.push(value); },
      replaceChildren(...children) {
        this.text = "";
        this.childNodes = children.map(child => typeof child === "string" ? { textContent: child } : child);
        this.writes.push(this.textContent);
      },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, listener) { this.listeners[name] = listener; }
    };
    nodes.push(node);
    if (!["meta", "link", "img", "input", "br", "hr"].includes(tagName)) parents.push(node);
  }
  const byId = Object.fromEntries(nodes.filter(node => node.attributes.id)
    .map(node => [node.attributes.id, node]));
  const document = {
    documentElement: { lang: "en" },
    createElement: tagName => ({ tagName, textContent: "" }),
    getElementById: id => byId[id],
    querySelectorAll: selector => nodes.filter(node => selector === "[data-i18n]"
      ? node.dataset.i18n : node.dataset.i18nAriaLabel)
  };
  const messages = [];
  const clock = makeClock();
  const windowListeners = {};
  const context = vm.createContext({
    Intl, Date, document,
    window: { addEventListener(name, listener) { windowListeners[name] = listener; } },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    browser: {
      i18n: {
        getUILanguage: () => browserLanguage,
        getMessage: (key, values) => translated(locale, key, values)
      },
      runtime: { getManifest: () => manifest, async sendMessage(message) {
        messages.push(JSON.parse(JSON.stringify(message)));
        if (options.sendMessage) {
          const response = options.sendMessage(message);
          if (response !== undefined) return response;
        }
        switch (message.type) {
          case "context": return unsupported
            ? { ok: false, error: "UNSUPPORTED_TAB" }
            : { ok: true, context: { tabId: 7, hostname: "example.org" }, job: options.job || null };
          case "state": return { ok: true, job: null };
          case "preview": return { ok: true, preview: {
            token: "preview-token", count: 21, hostname: "example.org", expiresAt: Date.now() + 60000
          } };
          case "clean": return { ok: true, job: {
            id: "job", hostname: "example.org", status: "failed", total: 21,
            processed: 21, deleted: 18, skipped: 2, failed: 1, error: null
          } };
          default: assert.fail(`Unexpected request: ${message.type}`);
        }
      } }
    }
  });
  vm.runInContext(popupSource, context, { filename: "popup.js" });
  await settle();
  return { nodes, byId, document, messages, context, clock,
    close: () => windowListeners.pagehide() };
}

test("all six catalogs provide complete messages and preserve placeholder meanings", () => {
  for (const locale of locales) {
    const catalog = catalogs[locale];
    for (const key of Object.keys(catalogs.en)) assert.ok(catalog[key], `${locale}: missing ${key}`);
    assert.ok(catalog.extensionDescription.message.length <= 250, locale);
    assert.equal(Intl.getCanonicalLocales(catalog.uiLanguage.message)[0], catalog.uiLanguage.message);
    for (const [key, entry] of Object.entries(catalog)) {
      assert.ok(entry.message.trim(), `${locale}.${key}: empty message`);
      const reference = catalogs.en[key] || catalogs.en[key.replace(/Few$|Many$/, "Other")];
      assert.ok(reference, `${locale}.${key}: unexpected key`);
      const placeholderPositions = value => Object.fromEntries(Object.entries(value.placeholders || {})
        .map(([name, placeholder]) => [name, placeholder.content]));
      assert.deepEqual(placeholderPositions(entry), placeholderPositions(reference), `${locale}.${key}`);
      const used = [...entry.message.matchAll(/\$([a-z]+)\$/gi)].map(match => match[1].toLowerCase()).sort();
      assert.deepEqual(used, Object.keys(entry.placeholders || {}).sort(), `${locale}.${key}: placeholders`);
    }
  }
});

test("all six popup languages localize labels and complete preview/delete without changing request scope", async () => {
  for (const locale of locales) {
    const app = await makePopup(locale);
    assert.equal(app.document.documentElement.lang, catalogs[locale].uiLanguage.message);
    for (const node of app.nodes.filter(node => node.dataset.i18n)) {
      assert.ok(node.textContent, `${locale}: ${node.dataset.i18n}`);
    }
    assert.equal(app.byId["job-progress"].attributes["aria-label"], translated(locale, "jobProgressLabel"));
    assert.equal(app.byId["hostname"].textContent, "example.org");
    assert.equal(app.byId["preview-button"].disabled, false);
    await app.byId["preview-form"].listeners.submit({ preventDefault() {} });
    assert.deepEqual(app.messages, [
      { type: "context" }, { type: "preview", tabId: 7, hostname: "example.org" }
    ]);
    assert.equal(app.byId["clean-button"].disabled, false);
    assert.match(app.byId["preview-summary"].textContent, /21/);
    await app.byId["clean-button"].listeners.click();
    assert.deepEqual(app.messages.at(-1), { type: "clean", token: "preview-token" });
    assert.equal(app.byId["job-heading"].textContent, translated(locale, "jobWithErrors"));
    assert.match(app.byId["job-summary"].textContent, /18/);
    assert.match(app.byId["job-detail"].textContent, /2/);
    assert.match(app.byId["job-detail"].textContent, /1/);
    const announcement = app.byId["job-announcement"].textContent;
    assert.ok(announcement.includes(translated(locale, "jobWithErrors")));
    assert.ok(announcement.includes("example.org"));
    assert.ok(announcement.includes(app.byId["job-summary"].textContent));
    const skippedKey = locale === "ru" ? "jobSkippedFew" : "jobSkippedOther";
    assert.ok(announcement.includes(translated(locale, skippedKey, ["2"])), locale);
    assert.ok(announcement.includes(translated(locale, "jobFailedOne", ["1"])));
    for (const node of app.nodes) assert.doesNotMatch(node.textContent, /\$[a-z]+\$|undefined/);
  }
});

test("the combined preview uses its own domain and entry count in every language, including zero", async () => {
  const domain = "news42.preview.example";
  for (const locale of locales) {
    let count = 0;
    const app = await makePopup(locale, locale.replace("_", "-"), false, {
      job: runningJob({ id: "previous-job", hostname: "previous.example", status: "completed" }),
      sendMessage(message) {
        if (message.type === "preview") return { ok: true, preview: {
          token: "domain-preview", count, hostname: domain, expiresAt: Date.now() + 60000
        } };
      }
    });
    const summary = app.byId["preview-summary"];
    assert.equal(summary.textContent, "", `${locale}: no warning without a preview`);
    assert.equal(app.byId["clean-button"].attributes["aria-describedby"], "preview-summary");
    assert.equal(app.byId["hostname"].textContent, "example.org");
    assert.equal(app.byId["job-target"].textContent, "previous.example");
    for (count of [0, 1, 2, 5, 21, 42, 1234]) {
      await app.byId["preview-form"].listeners.submit({ preventDefault() {} });
      assert.equal(app.byId["preview-panel"].hidden, false);
      assert.equal(app.byId["clean-button"].disabled, count === 0);
      assert.equal(summary.textContent.split(domain).length, 2, `${locale}: show the preview domain once`);
      assert.doesNotMatch(summary.textContent, /example\.org|previous\.example|\$[a-z]+\$|undefined/);
      const emphasized = summary.childNodes.filter(node => node.tagName === "strong").map(node => node.textContent);
      if (count === 0) {
        assert.deepEqual(emphasized, [domain], `${locale}: emphasize only the domain when no entries match`);
        assert.equal(summary.textContent, translated(locale, "previewEmpty", [domain]));
        await app.byId["clean-button"].listeners.click();
        assert.equal(app.messages.filter(message => message.type === "clean").length, 0);
      } else {
        const formatted = new Intl.NumberFormat(catalogs[locale].uiLanguage.message).format(count);
        assert.deepEqual(emphasized.slice().sort(), [formatted, domain].sort(), `${locale}: emphasize the complete count and domain`);
        assert.ok(summary.textContent.includes(formatted), `${locale}: missing entry count`);
        assert.ok(app.byId["clean-button"].textContent.includes(formatted));
        if (locale === "en") {
          const noun = count === 1 ? "entry" : "entries";
          assert.equal(summary.textContent, `${formatted} ${noun} for “${domain}” will be deleted. This cannot be undone.`);
          assert.equal(app.byId["clean-button"].textContent, `Delete ${formatted} ${noun}`);
        }
      }
    }
    await app.byId["clean-button"].listeners.click();
    assert.equal(summary.textContent, "", `${locale}: warning must clear when the preview is consumed`);
    assert.equal(summary.childNodes.length, 0, `${locale}: emphasis must clear with the preview`);
  }
});

test("refreshing, failing or expiring a preview clears its domain warning", async () => {
  const preview = {
    token: "preview-token", count: 1, hostname: "preview.example", expiresAt: Date.now() + 60000
  };
  let previewResponse = { ok: true, preview };
  const app = await makePopup("en", "en-US", false, {
    sendMessage(message) {
      if (message.type === "preview") return previewResponse;
    }
  });
  const note = app.byId["preview-summary"];
  const submit = () => app.byId["preview-form"].listeners.submit({ preventDefault() {} });
  await submit();
  assert.ok(note.textContent.includes(preview.hostname));

  const replacement = deferred();
  previewResponse = replacement.promise;
  const refreshing = submit();
  assert.equal(app.byId["preview-panel"].hidden, true);
  assert.equal(note.textContent, "", "The old domain must disappear while the new preview is pending");
  replacement.resolve({ ok: false, error: "READ_FAILED" });
  await refreshing;
  assert.equal(note.textContent, "");
  assert.equal(app.byId["error"].textContent, translated("en", "errorReadFailed"));

  previewResponse = { ok: true, preview: { ...preview, expiresAt: Date.now() - 1 } };
  await submit();
  assert.ok(note.textContent.includes(preview.hostname));
  await app.byId["clean-button"].listeners.click();
  assert.equal(note.textContent, "", "An expired preview must not leave a domain warning behind");
  assert.equal(app.byId["preview-panel"].hidden, true);
  assert.equal(app.byId["error"].textContent, translated("en", "errorExpired"));
  assert.equal(app.messages.filter(message => message.type === "clean").length, 0);
});

test("Russian counts use one, few and many across preview, buttons and results", async () => {
  const app = await makePopup("ru", "ru-RU");
  const cases = [[0, "Many"], [1, "One"], [2, "Few"], [4, "Few"], [5, "Many"],
    [11, "Many"], [12, "Many"], [14, "Many"], [21, "One"], [22, "Few"],
    [25, "Many"], [101, "One"], [111, "Many"]];
  for (const prefix of countGroups) {
    for (const [count, suffix] of cases) {
      assert.ok(catalogs.ru[`${prefix}${suffix}`], `${prefix}${suffix}`);
      assert.equal(vm.runInContext(`countMessage("${prefix}", ${count})`, app.context),
        translated("ru", `${prefix}${suffix}`, [String(count)]));
    }
  }
});

test("French and Brazilian Portuguese use their singular form for zero", async () => {
  for (const locale of ["fr", "pt_BR"]) {
    const app = await makePopup(locale);
    for (const prefix of countGroups) {
      assert.equal(vm.runInContext(`countMessage("${prefix}", 0)`, app.context),
        translated(locale, `${prefix}One`, ["0"]));
    }
  }
});

test("large counts fall back to Other when a catalog has no dedicated plural category", async () => {
  for (const locale of ["es", "fr", "pt_BR"]) {
    const app = await makePopup(locale);
    const formatted = new Intl.NumberFormat(locale.replace("_", "-")).format(1000000);
    assert.equal(vm.runInContext('countMessage("jobDeleted", 1000000)', app.context),
      translated(locale, "jobDeletedOther", [formatted]));
  }
});

test("regional number formats and English fallback stay consistent with the selected translation", async () => {
  for (const [locale, browserLanguage, expected] of [
    ["de", "de-CH", "de-CH"], ["en", "en-GB", "en-GB"], ["es", "es-MX", "es-MX"],
    ["fr", "fr-CA", "fr-CA"], ["pt_BR", "pt-BR", "pt-BR"], ["ru", "ru-RU", "ru-RU"],
    ["en", "it-IT", "en"]
  ]) {
    const app = await makePopup(locale, browserLanguage);
    assert.equal(vm.runInContext("number(1234567)", app.context), new Intl.NumberFormat(expected).format(1234567));
    assert.equal(app.byId["preview-button"].textContent, translated(locale, "previewButton"));
  }
});

test("unsupported-tab errors are translated and cannot enable deletion in any locale", async () => {
  for (const locale of locales) {
    const app = await makePopup(locale, locale.replace("_", "-"), true);
    assert.equal(app.byId["error"].textContent, translated(locale, "errorUnsupportedTab"));
    assert.equal(app.byId["preview-button"].disabled, true);
    assert.equal(app.byId["clean-button"].disabled, true);
    assert.deepEqual(app.messages, [{ type: "context" }, { type: "state" }]);
  }
});

test("the result live region exists before cleanup and announces failures without a second progress region", async () => {
  const app = await makePopup("en", "en-US", false, {
    sendMessage(message) {
      if (message.type === "clean") return { ok: true, job: runningJob({
        status: "failed", total: 1, processed: 1, failed: 1
      }) };
    }
  });
  const announcement = app.byId["job-announcement"];
  assert.equal(announcement.attributes.role, "status");
  assert.equal(announcement.attributes["aria-live"], "polite");
  assert.equal(announcement.attributes["aria-atomic"], "true");
  assert.equal(announcement.textContent, "");
  assert.equal(app.byId["job-panel"].hidden, true);
  for (let node = announcement; node; node = node.parent) {
    assert.equal(node.hidden, false, "Live region must not have a hidden ancestor");
    assert.notEqual(node.attributes["aria-hidden"], "true");
  }
  assert.equal(app.byId["job-summary"].attributes.role, undefined);
  assert.equal(app.byId["job-summary"].attributes["aria-live"], undefined);
  await app.byId["preview-form"].listeners.submit({ preventDefault() {} });
  await app.byId["clean-button"].listeners.click();
  assert.ok(announcement.textContent.includes(translated("en", "jobWithErrors")));
  assert.ok(announcement.textContent.includes(translated("en", "jobDeletedOther", ["0"])));
  assert.ok(announcement.textContent.includes(translated("en", "jobFailedOne", ["1"])));
});

test("controlled polling shows progress once, ignores unchanged counts and announces the complete result", async () => {
  const cleaning = deferred();
  const progress = runningJob({ processed: 4, deleted: 3, failed: 1 });
  const app = await makePopup("en", "en-US", false, {
    sendMessage(message) {
      if (message.type === "clean") return cleaning.promise;
      if (message.type === "state") return { ok: true, job: progress };
    }
  });
  await app.byId["preview-form"].listeners.submit({ preventDefault() {} });
  const pending = app.byId["clean-button"].listeners.click();
  assert.equal(app.byId["preview-button"].disabled, true);
  assert.equal(app.clock.timers.size, 1);
  await app.clock.advance(499);
  assert.equal(app.messages.filter(message => message.type === "state").length, 0);
  await app.clock.advance(1);
  assert.equal(app.byId["job-progress"].value, 4);
  assert.ok(app.byId["job-announcement"].textContent.includes(translated("en", "jobProgressSummary", [
    "4", translated("en", "urlCountOther", ["21"]), "3"
  ])));
  const progressWrites = app.byId["job-announcement"].writes.length;
  await app.clock.advance(500);
  assert.equal(app.byId["job-announcement"].writes.length, progressWrites);
  cleaning.resolve({ ok: true, job: runningJob({
    status: "failed", processed: 21, deleted: 18, skipped: 2, failed: 1
  }) });
  await pending;
  assert.equal(app.byId["job-progress"].hidden, true);
  assert.equal(app.byId["preview-button"].disabled, false);
  assert.equal(app.clock.timers.size, 0);
  const result = app.byId["job-announcement"].textContent;
  assert.ok(result.includes(translated("en", "jobWithErrors")));
  assert.ok(result.includes(translated("en", "jobDeletedOther", ["18"])));
  assert.ok(result.includes(translated("en", "jobSkippedOther", ["2"])));
  assert.ok(result.includes(translated("en", "jobFailedOne", ["1"])));
  assert.equal(app.byId["job-announcement"].writes.filter(value => value === result).length, 1);
});

test("a delayed poll cannot restore a running job or erase a new preview after cleanup completes", async () => {
  const cleaning = deferred(), state = deferred();
  const app = await makePopup("en", "en-US", false, {
    sendMessage(message) {
      if (message.type === "clean") return cleaning.promise;
      if (message.type === "state") return state.promise;
    }
  });
  await app.byId["preview-form"].listeners.submit({ preventDefault() {} });
  const pending = app.byId["clean-button"].listeners.click();
  await app.clock.advance(500);
  await app.clock.advance(5000);
  assert.equal(app.messages.filter(message => message.type === "state").length, 1);
  cleaning.resolve({ ok: true, job: runningJob({ status: "completed", processed: 21, deleted: 21 }) });
  await pending;
  const finalAnnouncement = app.byId["job-announcement"].textContent;
  await app.byId["preview-form"].listeners.submit({ preventDefault() {} });
  assert.equal(app.byId["preview-panel"].hidden, false);
  state.resolve({ ok: true, job: runningJob({ processed: 1, deleted: 1 }) });
  await settle();
  assert.equal(app.byId["preview-panel"].hidden, false);
  assert.equal(app.byId["clean-button"].disabled, false);
  assert.equal(app.byId["job-heading"].textContent, translated("en", "jobCompleted"));
  assert.equal(app.byId["job-announcement"].textContent, finalAnnouncement);
  assert.equal(app.clock.timers.size, 0);
});

test("a reopened job resumes polling after a temporary status error and stops on completion", async () => {
  let reads = 0;
  const app = await makePopup("en", "en-US", false, {
    job: runningJob({ processed: 2, deleted: 2 }),
    sendMessage(message) {
      if (message.type !== "state") return;
      reads++;
      if (reads === 1) throw new Error("Temporary status failure");
      return { ok: true, job: reads === 2
        ? runningJob({ processed: 9, deleted: 9 })
        : runningJob({ status: "completed", processed: 21, deleted: 21 }) };
    }
  });
  const initialAnnouncement = app.byId["job-announcement"].textContent;
  await app.clock.advance(500);
  assert.equal(app.byId["job-announcement"].textContent, initialAnnouncement);
  assert.equal(app.byId["preview-button"].disabled, true);
  assert.equal(app.clock.timers.size, 1);
  await app.clock.advance(500);
  assert.equal(app.byId["job-progress"].value, 9);
  await app.clock.advance(500);
  assert.equal(reads, 3);
  assert.equal(app.byId["preview-button"].disabled, false);
  assert.ok(app.byId["job-announcement"].textContent.includes(translated("en", "jobCompleted")));
  assert.ok(app.byId["job-announcement"].textContent.includes(translated("en", "jobDeletedOther", ["21"])));
  assert.equal(app.clock.timers.size, 0);
});

test("a missing background job announces interruption and permits a new preview", async () => {
  const app = await makePopup("en", "en-US", false, {
    job: runningJob({ processed: 3, deleted: 3 })
  });
  await app.clock.advance(500);
  assert.equal(app.byId["job-heading"].textContent, translated("en", "jobWithErrors"));
  assert.ok(app.byId["job-announcement"].textContent.includes(translated("en", "errorInterrupted")));
  assert.ok(app.byId["job-announcement"].textContent.includes(translated("en", "jobDeletedOther", ["3"])));
  assert.equal(app.byId["preview-button"].disabled, false);
  assert.equal(app.clock.timers.size, 0);
  await app.byId["preview-form"].listeners.submit({ preventDefault() {} });
  assert.equal(app.byId["clean-button"].disabled, false);
});

test("closing the popup cancels scheduled polling and ignores pending cleanup and poll responses", async () => {
  const cleaning = deferred(), state = deferred();
  const app = await makePopup("en", "en-US", false, {
    sendMessage(message) {
      if (message.type === "clean") return cleaning.promise;
      if (message.type === "state") return state.promise;
    }
  });
  await app.byId["preview-form"].listeners.submit({ preventDefault() {} });
  const pending = app.byId["clean-button"].listeners.click();
  await app.clock.advance(500);
  app.close();
  const writes = app.nodes.map(node => node.writes.length);
  const messageCount = app.messages.length;
  state.resolve({ ok: true, job: runningJob({ processed: 8, deleted: 8 }) });
  cleaning.resolve({ ok: true, job: runningJob({ status: "completed", processed: 21, deleted: 21 }) });
  await pending;
  await settle();
  await app.clock.advance(5000);
  assert.deepEqual(app.nodes.map(node => node.writes.length), writes);
  assert.equal(app.messages.length, messageCount);
  assert.equal(app.clock.timers.size, 0);

  const reopened = await makePopup("en", "en-US", false, { job: runningJob() });
  assert.equal(reopened.clock.timers.size, 1);
  reopened.close();
  await reopened.clock.advance(1000);
  assert.equal(reopened.clock.timers.size, 0);
  assert.deepEqual(reopened.messages.map(message => message.type), ["context"]);
});
