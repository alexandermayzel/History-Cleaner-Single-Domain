"use strict";

(() => {
  const { CleanerError, getHostname, collectCandidates, cleanCandidates } = HistoryCleaner;
  const previews = new Map();
  const PREVIEW_TTL = 5 * 60 * 1000;
  let job = null;

  function publicJob() {
    return job ? { ...job } : null;
  }

  async function getContext() {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    const hostname = getHostname(tab?.url);
    if (!hostname || !Number.isInteger(tab?.id)) throw new CleanerError("UNSUPPORTED_TAB");
    return { tabId: tab.id, windowId: tab.windowId, hostname };
  }

  async function checkContext(expected) {
    const current = await getContext();
    if (current.tabId !== expected.tabId || current.hostname !== expected.hostname) {
      throw new CleanerError("TAB_CHANGED");
    }
    return current;
  }

  function checkIdle() {
    if (job?.status === "running") throw new CleanerError("BUSY");
  }

  async function handle(message) {
    // Reject obsolete requests rather than silently widening their deletion scope.
    if (message && typeof message === "object" && ("days" in message || "cutoff" in message)) {
      throw new CleanerError("INVALID_REQUEST");
    }
    switch (message?.type) {
      case "context":
        return { ok: true, context: await getContext(), job: publicJob() };
      case "state":
        return { ok: true, job: publicJob() };
      case "preview": {
        checkIdle();
        const context = await checkContext(message);
        const plan = await collectCandidates(browser.history, {
          hostname: context.hostname
        });
        await checkContext(context);
        checkIdle();
        const now = Date.now();
        for (const [key, value] of previews) {
          if (value.expiresAt <= now) previews.delete(key);
        }
        while (previews.size >= 8) previews.delete(previews.keys().next().value);
        const token = crypto.randomUUID();
        const expiresAt = now + PREVIEW_TTL;
        previews.set(token, { ...plan, ...context, expiresAt });
        return { ok: true, preview: {
          token, hostname: plan.hostname,
          count: plan.urls.length, expiresAt
        } };
      }
      case "clean": {
        checkIdle();
        const plan = previews.get(message.token);
        if (!plan || plan.expiresAt <= Date.now()) throw new CleanerError("EXPIRED");
        await checkContext(plan);
        // Recheck after await: two clicks must never start overlapping jobs.
        checkIdle();
        if (!previews.has(message.token) || plan.expiresAt <= Date.now()) {
          throw new CleanerError("EXPIRED");
        }
        previews.clear();
        job = {
          id: crypto.randomUUID(), hostname: plan.hostname,
          status: "running", total: plan.urls.length, processed: 0,
          deleted: 0, skipped: 0, failed: 0, error: null
        };
        try {
          const result = await cleanCandidates(browser.history, plan, stats => Object.assign(job, stats));
          Object.assign(job, result, { status: result.failed ? "failed" : "completed" });
        } catch {
          job.status = "failed";
          job.error = "INTERNAL_ERROR";
        }
        return { ok: true, job: publicJob() };
      }
      default:
        throw new CleanerError("INVALID_REQUEST");
    }
  }

  browser.runtime.onMessage.addListener((message, sender) => {
    // No content scripts or external pages may start history mutations.
    if (sender.id !== browser.runtime.id ||
        sender.url !== browser.runtime.getURL("popup/popup.html")) return undefined;
    // Keep the response pending until cleaning finishes, independently of the popup.
    return handle(message).catch(error => ({
      ok: false, error: error instanceof CleanerError ? error.code : "INTERNAL_ERROR"
    }));
  });
})();
