"use strict";

// Shared by the Firefox background page and the dependency-free Node tests.
globalThis.HistoryCleaner = (() => {
  const MAX_RESULTS = 2147483647;

  class CleanerError extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }

  function getHostname(url) {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname
        ? parsed.hostname : null;
    } catch {
      return null;
    }
  }

  function validateScope(scope) {
    if (!scope || typeof scope !== "object" || !scope.hostname ||
        getHostname(`https://${scope.hostname}/`) !== scope.hostname ||
        "days" in scope || "cutoff" in scope) {
      throw new CleanerError("INVALID_REQUEST");
    }
  }

  async function collectCandidates(history, scope) {
    validateScope(scope);
    const { hostname } = scope;
    // Places searches only the first 255 URL bytes, including "https://".
    // Canonical hosts are ASCII; longer hosts need an unfiltered history read.
    const searchText = hostname.length > 247 ? "" : hostname;
    let limit = 1000;
    let items;
    // Firefox returns one row per URL.
    // Grow the result limit until the whole search fits; never silently truncate.
    for (;;) {
      try {
        items = await history.search({ text: searchText, startTime: 0, maxResults: limit });
      } catch {
        throw new CleanerError("READ_FAILED");
      }
      if (items.length < limit) break;
      if (limit === MAX_RESULTS) throw new CleanerError("READ_FAILED");
      limit = Math.min(limit * 2, MAX_RESULTS);
    }
    const urls = [...new Set(items.filter(item =>
      getHostname(item.url) === hostname
    ).map(item => item.url))];
    return { hostname, urls };
  }

  async function cleanCandidates(history, plan, onProgress = () => {}) {
    validateScope(plan);
    if (!Array.isArray(plan.urls)) {
      throw new CleanerError("INVALID_REQUEST");
    }
    const urls = [...new Set(plan.urls)];
    const stats = { total: urls.length, processed: 0, deleted: 0, skipped: 0, failed: 0 };
    for (const url of urls) {
      try {
        if (getHostname(url) !== plan.hostname) {
          stats.skipped++;
        } else {
          // Count URLs already removed since the preview as skipped.
          const visits = await history.getVisits({ url });
          if (visits.length > 0) {
            await history.deleteUrl({ url });
            stats.deleted++;
          } else {
            stats.skipped++;
          }
        }
      } catch {
        stats.failed++;
      }
      stats.processed++;
      onProgress({ ...stats });
      if (stats.processed % 25 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return stats;
  }

  return { CleanerError, getHostname, collectCandidates, cleanCandidates };
})();

if (typeof module !== "undefined") module.exports = globalThis.HistoryCleaner;
