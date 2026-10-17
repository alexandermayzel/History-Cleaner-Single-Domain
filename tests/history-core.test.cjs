"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getHostname, collectCandidates, cleanCandidates
} = require("../src/history-core.js");

const NOW = 2000000000000;
const HOST = "example.com";

function makeHistory(items = [], visitsByUrl = new Map()) {
  const searches = [];
  const deleted = [];
  const checked = [];
  const history = {
    async search(query) {
      searches.push(query);
      const terms = query.text.toLowerCase().split(/\s+/).filter(Boolean);
      return items.filter(item => {
        // Model Places' URL/title search window for these ASCII search terms.
        // The HTTP(S) scheme remains part of the first 255 bytes.
        const fields = [item.url, item.title].map(value =>
          Buffer.from(value || "").subarray(0, 255).toString("utf8").toLowerCase()
        );
        return terms.every(term => fields.some(value => value.includes(term)));
      }).slice(0, query.maxResults);
    },
    async getVisits({ url }) {
      checked.push(url);
      return visitsByUrl.get(url) ?? [{ visitTime: NOW }];
    },
    async deleteUrl({ url }) { deleted.push(url); },
    async deleteAll() { assert.fail("A site cleanup must never delete all history"); },
    async deleteRange() { assert.fail("A site cleanup must never delete a global range"); }
  };
  return { history, searches, deleted, checked };
}

function longHostname(length) {
  const prefix = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.`;
  const suffix = ".example.com";
  return prefix + "d".repeat(length - prefix.length - suffix.length) + suffix;
}

test("the website is an exact HTTP(S) hostname, including IDN and IPv6", () => {
  assert.equal(getHostname("https://EXAMPLE.com:8443/path?q=1#part"), HOST);
  assert.equal(getHostname("http://user:password@example.com:8080/"), HOST);
  assert.equal(getHostname("https://bücher.example/"), "xn--bcher-kva.example");
  assert.equal(getHostname("http://[::1]:8080/"), "[::1]");
  for (const url of ["about:blank", "file:///example.com", "ftp://example.com/",
    "ws://example.com/", "javascript:alert(1)", "https://", "not a URL", null]) {
    assert.equal(getHostname(url), null, String(url));
  }
});

test("search matches in titles, credentials, paths, suffixes, and subdomains cannot widen deletion", async () => {
  const allowed = [
    "https://example.com/one", "http://example.com/two",
    "https://example.com:8443/three", "http://user:pass@example.com:8080/four"
  ];
  const rejected = [
    "https://www.example.com/", "https://sub.example.com/", "https://notexample.com/",
    "https://example.com.evil.test/", "https://example.com@evil.test/",
    "https://evil.test/example.com", "https://evil.test/?next=https://example.com/",
    "https://unrelated.test/", "ftp://example.com/", "file:///example.com"
  ];
  const { history, deleted } = makeHistory([...allowed, ...rejected].map(url => ({
    url, title: "example.com", lastVisitTime: NOW
  })));
  const plan = await collectCandidates(history, { hostname: HOST });
  assert.deepEqual(plan.urls, allowed);
  const result = await cleanCandidates(history, plan);
  assert.deepEqual(deleted, allowed);
  assert.equal(result.deleted, allowed.length);
});

test("selection includes every age and searches the entire history", async () => {
  const items = [
    { url: "https://example.com/old", lastVisitTime: 1 },
    { url: "https://example.com/new", lastVisitTime: NOW },
    { url: "https://example.com/unknown" },
    { url: "https://example.com/invalid", lastVisitTime: NaN }
  ];
  const { history, searches } = makeHistory(items);
  const plan = await collectCandidates(history, { hostname: HOST });
  assert.deepEqual(plan, { hostname: HOST, urls: items.map(item => item.url) });
  assert.equal(searches[0].startTime, 0);
  assert.equal(searches[0].text, HOST);
  assert.equal("endTime" in searches[0], false);
});

for (const length of [247, 248]) {
  test(`a ${length}-character host includes HTTP and HTTPS without deleting other hosts`, async () => {
    const hostname = longHostname(length);
    const allowed = [
      `http://${hostname}/one`, `https://${hostname}/two`,
      `https://${hostname}:8443/three`
    ];
    const rejected = [
      `https://sub.${hostname}/`, "https://example.com/", "https://unrelated.test/",
      `https://z${hostname.slice(1)}/`, `ftp://${hostname}/`
    ];
    const { history, searches, deleted } = makeHistory([...allowed, ...rejected].map(url => ({
      url, title: "Saved page", lastVisitTime: NOW
    })));
    const plan = await collectCandidates(history, { hostname });
    assert.deepEqual(plan.urls, allowed);
    if (length === 247) {
      assert.equal(searches[0].text, hostname, "hosts that fit must keep the targeted search");
    }
    const result = await cleanCandidates(history, plan);
    assert.deepEqual(deleted, allowed);
    assert.equal(result.deleted, allowed.length);
  });
}

test("long-host fallback finds matching URLs after more than 1000 unrelated entries", async () => {
  const hostname = longHostname(252);
  const allowed = [`http://${hostname}/one`, `https://${hostname}/two`];
  const items = [
    ...Array.from({ length: 1000 }, (_, index) => ({ url: `https://other.test/${index}` })),
    ...allowed.map(url => ({ url, title: "Saved page" }))
  ];
  const { history, searches, deleted } = makeHistory(items);
  const plan = await collectCandidates(history, { hostname });
  assert.deepEqual(plan.urls, allowed);
  assert.deepEqual(searches.map(query => query.maxResults), [1000, 2000]);
  await cleanCandidates(history, plan);
  assert.deepEqual(deleted, allowed);
});

test("all-time selection includes recent URLs and deduplicates them", async () => {
  const url = "https://example.com/recent";
  const { history, deleted } = makeHistory([{ url, lastVisitTime: NOW }, { url }]);
  const plan = await collectCandidates(history, { hostname: HOST });
  assert.deepEqual(plan.urls, [url]);
  history.getVisits = async () => [{ visitTime: NOW }];
  const result = await cleanCandidates(history, { ...plan, urls: [url, url] });
  assert.deepEqual(deleted, [url]);
  assert.equal(result.total, 1);
});

test("large histories expand the result limit and include entries beyond 1000", async () => {
  const items = Array.from({ length: 2501 }, (_, index) => ({
    url: `https://example.com/page/${index}`, lastVisitTime: NOW
  }));
  const { history, searches } = makeHistory(items);
  const plan = await collectCandidates(history, { hostname: HOST });
  assert.equal(plan.urls.length, items.length);
  assert.equal(plan.urls.at(-1), items.at(-1).url);
  assert.deepEqual(searches.map(query => query.maxResults), [1000, 2000, 4000]);
});

test("a full search page is not mistaken for a complete result set", async () => {
  const items = Array.from({ length: 1000 }, (_, index) => ({
    url: `https://example.com/${index}`, lastVisitTime: NOW
  }));
  const { history, searches } = makeHistory(items);
  assert.equal((await collectCandidates(history, { hostname: HOST })).urls.length, 1000);
  assert.deepEqual(searches.map(query => query.maxResults), [1000, 2000]);
});

test("bad requests and failed history reads do not become partial successful plans", async () => {
  const { history, searches } = makeHistory();
  for (const hostname of ["", "example.com/path", "example.com@evil.test", "example.com:8443"]) {
    await assert.rejects(collectCandidates(history, { hostname }), { code: "INVALID_REQUEST" });
  }
  assert.equal(searches.length, 0);
  history.search = async () => { throw new Error("database unavailable"); };
  await assert.rejects(collectCandidates(history, { hostname: HOST }), { code: "READ_FAILED" });
});

test("legacy age-filter requests fail before reading or deleting history", async () => {
  const { history, searches, checked, deleted } = makeHistory();
  for (const legacy of [
    { days: 30 }, { days: null }, { days: undefined },
    { cutoff: NOW }, { cutoff: null }, { cutoff: undefined }
  ]) {
    await assert.rejects(collectCandidates(history, { hostname: HOST, ...legacy }), { code: "INVALID_REQUEST" });
    await assert.rejects(cleanCandidates(history, {
      hostname: HOST, urls: ["https://example.com/keep"], ...legacy
    }), { code: "INVALID_REQUEST" });
  }
  assert.equal(searches.length, 0);
  assert.equal(checked.length, 0);
  assert.equal(deleted.length, 0);
});

test("old, recent, and mixed-age visits are all removed while already-gone URLs are skipped", async () => {
  const urls = ["old", "revisited", "recent", "unknown", "gone"].map(path => `https://example.com/${path}`);
  const visits = new Map([
    [urls[0], [{ visitTime: 1 }, { visitTime: 2 }]],
    [urls[1], [{ visitTime: 1 }, { visitTime: NOW }]],
    [urls[2], [{ visitTime: NOW }]],
    [urls[3], [{}]],
    [urls[4], []]
  ]);
  const { history, deleted } = makeHistory(urls.map(url => ({ url, lastVisitTime: 1 })), visits);
  const plan = await collectCandidates(history, { hostname: HOST });
  assert.equal(plan.urls.length, urls.length);
  const result = await cleanCandidates(history, plan);
  assert.deepEqual(deleted, urls.slice(0, 4));
  assert.deepEqual(result, { total: 5, processed: 5, deleted: 4, skipped: 1, failed: 0 });
});

test("deletion rechecks host scope even if the candidate plan contains unrelated URLs", async () => {
  const url = "https://example.com/allowed";
  const { history, deleted, checked } = makeHistory();
  const result = await cleanCandidates(history, {
    hostname: HOST,
    urls: [url, "https://sub.example.com/", "https://evil.test/example.com", "ftp://example.com/"]
  });
  assert.deepEqual(checked, [url]);
  assert.deepEqual(deleted, [url]);
  assert.equal(result.skipped, 3);
});

test("read and deletion failures are counted while successful entries still finish", async () => {
  const urls = ["read-fails", "delete-fails", "works"].map(path => `https://example.com/${path}`);
  const { history, deleted } = makeHistory();
  history.getVisits = async ({ url }) => {
    if (url === urls[0]) throw new Error("read failure");
    return [{ visitTime: NOW }];
  };
  history.deleteUrl = async ({ url }) => {
    if (url === urls[1]) throw new Error("write failure");
    deleted.push(url);
  };
  const progress = [];
  const result = await cleanCandidates(history, { hostname: HOST, urls }, stats => progress.push(stats));
  assert.deepEqual(result, { total: 3, processed: 3, deleted: 1, skipped: 0, failed: 2 });
  assert.deepEqual(deleted, [urls[2]]);
  assert.deepEqual(progress.map(stats => stats.processed), [1, 2, 3]);
});
