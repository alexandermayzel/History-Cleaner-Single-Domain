"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourceDir = path.join(__dirname, "..", "src");
const coreSource = fs.readFileSync(path.join(sourceDir, "history-core.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(sourceDir, "background.js"), "utf8");
const INITIAL_TIME = 2000000000000;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function makeBackground() {
  let time = INITIAL_TIME;
  let tab = { id: 7, windowId: 3, url: "https://example.com/current" };
  let listener;
  let nextId = 0;
  const deleted = [];
  const queries = [];
  const searchCalls = [];
  const runtime = {
    id: "history-cleaner-test@example.invalid",
    getURL: relative => `moz-extension://test-extension/${relative}`,
    onMessage: { addListener(callback) { listener = callback; } }
  };
  const history = {
    async search(query) {
      searchCalls.push(query);
      return [{ url: "https://example.com/old", lastVisitTime: 1 }];
    },
    async getVisits() { return [{ visitTime: 1 }, { visitTime: time }]; },
    async deleteUrl({ url }) { deleted.push(url); },
    async deleteAll() { assert.fail("Global deletion is forbidden"); },
    async deleteRange() { assert.fail("Global time-range deletion is forbidden"); }
  };
  const browser = {
    runtime, history,
    tabs: { async query(query) { queries.push(query); return tab ? [{ ...tab }] : []; } }
  };
  class ClockDate extends Date { static now() { return time; } }
  const context = vm.createContext({
    browser, URL, Date: ClockDate, setTimeout,
    crypto: { randomUUID: () => `test-token-${++nextId}` }
  });
  vm.runInContext(coreSource, context, { filename: "history-core.js" });
  vm.runInContext(backgroundSource, context, { filename: "background.js" });
  const sender = { id: runtime.id, url: runtime.getURL("popup/popup.html") };
  return {
    browser, history, deleted, queries, searchCalls, sender,
    send: (message, suppliedSender = sender) => listener(message, suppliedSender),
    setTab(value) { tab = value; },
    advance(ms) { time += ms; },
    async preview() {
      return listener({ type: "preview", tabId: 7, hostname: "example.com" }, sender);
    }
  };
}

test("only messages from this extension's exact popup URL are accepted", async () => {
  const app = makeBackground();
  const rejected = [
    {}, { ...app.sender, id: "other-extension" },
    { ...app.sender, url: "https://example.com/" },
    { ...app.sender, url: "moz-extension://test-extension/popup/popup.html?forged=1" },
    { ...app.sender, url: "moz-extension://test-extension/other.html" }
  ];
  for (const sender of rejected) assert.equal(app.send({ type: "context" }, sender), undefined);
  assert.equal(app.queries.length, 0);
  assert.equal(app.searchCalls.length, 0);
  assert.equal((await app.send({ type: "context" })).ok, true);
});

test("context reads the active tab and rejects internal pages or missing tabs", async () => {
  const app = makeBackground();
  const response = await app.send({ type: "context" });
  assert.equal(response.context.hostname, "example.com");
  assert.equal(response.context.tabId, 7);
  assert.equal(app.queries[0].active, true);
  assert.equal(app.queries[0].lastFocusedWindow, true);
  for (const tab of [null, { id: 7, url: "about:addons" }, { id: 7 }, { url: "https://example.com/" }]) {
    app.setTab(tab);
    assert.equal((await app.send({ type: "context" })).error, "UNSUPPORTED_TAB");
  }
});

test("preview cannot select a different tab or hostname", async () => {
  const app = makeBackground();
  for (const change of [{ tabId: 8 }, { hostname: "other.test" }]) {
    const response = await app.send({ type: "preview", tabId: 7, hostname: "example.com", ...change });
    assert.equal(response.error, "TAB_CHANGED");
  }
  assert.equal(app.searchCalls.length, 0);
  assert.equal(app.deleted.length, 0);
});

test("navigation while a preview is loading invalidates its result", async () => {
  const app = makeBackground();
  const searching = deferred();
  const started = deferred();
  app.history.search = async () => { started.resolve(); return searching.promise; };
  const result = app.preview();
  await started.promise;
  app.setTab({ id: 7, windowId: 3, url: "https://different.test/" });
  searching.resolve([{ url: "https://example.com/old", lastVisitTime: 1 }]);
  assert.equal((await result).error, "TAB_CHANGED");
  assert.equal(app.deleted.length, 0);
});

test("changing tab or hostname between preview and clean prevents deletion", async () => {
  for (const changed of [
    { id: 8, windowId: 3, url: "https://example.com/current" },
    { id: 7, windowId: 3, url: "https://other.test/" }
  ]) {
    const app = makeBackground();
    const { preview } = await app.preview();
    app.setTab(changed);
    const result = await app.send({ type: "clean", token: preview.token });
    assert.equal(result.error, "TAB_CHANGED");
    assert.equal(app.deleted.length, 0);
  }
});

test("the server-owned preview controls cleanup, regardless of forged message fields", async () => {
  const app = makeBackground();
  const { preview } = await app.preview();
  assert.equal(preview.count, 1);
  assert.equal("urls" in preview, false);
  assert.deepEqual(Object.keys(preview).sort(), ["count", "expiresAt", "hostname", "token"]);
  const result = await app.send({
    type: "clean", token: preview.token, hostname: "evil.test",
    urls: ["https://evil.test/"]
  });
  assert.equal(result.ok, true);
  assert.equal(result.job.status, "completed");
  assert.equal("days" in result.job, false);
  assert.equal("cutoff" in result.job, false);
  assert.deepEqual(app.deleted, ["https://example.com/old"]);
  assert.equal((await app.send({ type: "clean", token: preview.token })).error, "EXPIRED");
});

test("legacy filter fields in preview and clean requests are rejected without consuming the preview", async () => {
  const app = makeBackground();
  for (const legacy of [{ days: 30 }, { days: null }, { cutoff: INITIAL_TIME }, { cutoff: null }]) {
    const result = await app.send({ type: "preview", tabId: 7, hostname: "example.com", ...legacy });
    assert.equal(result.error, "INVALID_REQUEST");
  }
  assert.equal(app.searchCalls.length, 0);
  const { preview } = await app.preview();
  for (const legacy of [{ days: 30 }, { days: null }, { cutoff: INITIAL_TIME }, { cutoff: null }]) {
    const result = await app.send({ type: "clean", token: preview.token, ...legacy });
    assert.equal(result.error, "INVALID_REQUEST");
  }
  assert.equal(app.deleted.length, 0);
  assert.equal((await app.send({ type: "clean", token: preview.token })).job.status, "completed");
  assert.deepEqual(app.deleted, ["https://example.com/old"]);
});

test("unknown and expired preview tokens cannot delete history", async () => {
  const app = makeBackground();
  assert.equal((await app.send({ type: "clean", token: "unknown" })).error, "EXPIRED");
  const { preview } = await app.preview();
  assert.equal(preview.expiresAt, INITIAL_TIME + 5 * 60 * 1000);
  app.advance(5 * 60 * 1000);
  assert.equal((await app.send({ type: "clean", token: preview.token })).error, "EXPIRED");
  assert.equal(app.deleted.length, 0);
});

test("a preview that expires while the active tab is being checked is rejected", async () => {
  const app = makeBackground();
  const { preview } = await app.preview();
  const querying = deferred();
  const started = deferred();
  app.browser.tabs.query = async () => { started.resolve(); return querying.promise; };
  const result = app.send({ type: "clean", token: preview.token });
  await started.promise;
  app.advance(5 * 60 * 1000);
  querying.resolve([{ id: 7, windowId: 3, url: "https://example.com/current" }]);
  assert.equal((await result).error, "EXPIRED");
  assert.equal(app.deleted.length, 0);
});

test("running cleanup rejects duplicate clean and preview requests and exposes progress", async () => {
  const app = makeBackground();
  const { preview } = await app.preview();
  const visiting = deferred();
  const started = deferred();
  app.history.getVisits = async () => { started.resolve(); return visiting.promise; };
  const running = app.send({ type: "clean", token: preview.token });
  await started.promise;
  assert.equal((await app.send({ type: "state" })).job.status, "running");
  assert.equal((await app.send({ type: "clean", token: preview.token })).error, "BUSY");
  assert.equal((await app.preview()).error, "BUSY");
  visiting.resolve([{ visitTime: INITIAL_TIME }]);
  assert.equal((await running).job.status, "completed");
  assert.deepEqual(app.deleted, ["https://example.com/old"]);
  assert.equal((await app.send({ type: "state" })).job.processed, 1);
});

test("two simultaneous confirmations cannot both consume one preview", async () => {
  const app = makeBackground();
  const { preview } = await app.preview();
  const results = await Promise.all([
    app.send({ type: "clean", token: preview.token }),
    app.send({ type: "clean", token: preview.token })
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.ok(results.some(result => ["BUSY", "EXPIRED"].includes(result.error)));
  assert.deepEqual(app.deleted, ["https://example.com/old"]);
});

test("partial failures are reported in the persistent job result", async () => {
  const app = makeBackground();
  const { preview } = await app.preview();
  app.history.deleteUrl = async () => { throw new Error("write unavailable"); };
  const result = await app.send({ type: "clean", token: preview.token });
  assert.equal(result.ok, true);
  assert.equal(result.job.status, "failed");
  assert.equal(result.job.failed, 1);
  assert.equal(result.job.deleted, 0);
  assert.equal((await app.send({ type: "state" })).job.failed, 1);
});

test("invalid requests and failed reads return errors without exposing internal details", async () => {
  const app = makeBackground();
  assert.equal((await app.send({ type: "arbitrary" })).error, "INVALID_REQUEST");
  app.history.search = async () => { throw new Error("private profile path"); };
  const response = await app.preview();
  assert.equal(response.error, "READ_FAILED");
  assert.equal(JSON.stringify(response).includes("private profile path"), false);
  assert.equal(app.deleted.length, 0);
});
