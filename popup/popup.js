"use strict";

const elements = {
  hostname: document.getElementById("hostname"),
  form: document.getElementById("preview-form"),
  previewButton: document.getElementById("preview-button"),
  previewPanel: document.getElementById("preview-panel"),
  previewSummary: document.getElementById("preview-summary"),
  cleanButton: document.getElementById("clean-button"),
  jobPanel: document.getElementById("job-panel"),
  jobHeading: document.getElementById("job-heading"),
  jobTarget: document.getElementById("job-target"),
  jobProgress: document.getElementById("job-progress"),
  jobSummary: document.getElementById("job-summary"),
  jobDetail: document.getElementById("job-detail"),
  jobAnnouncement: document.getElementById("job-announcement"),
  error: document.getElementById("error"),
  version: document.getElementById("addon-version"),
};

const errors = {
  UNSUPPORTED_TAB: "errorUnsupportedTab",
  TAB_CHANGED: "errorTabChanged",
  BUSY: "errorBusy",
  EXPIRED: "errorExpired",
  INVALID_REQUEST: "errorInvalidRequest",
  READ_FAILED: "errorReadFailed",
  INTERRUPTED: "errorInterrupted",
  INTERNAL_ERROR: "errorInternal",
};

function t(key, substitutions = []) {
  return browser.i18n.getMessage(key, substitutions);
}

const uiLanguage = t("uiLanguage");
const browserLanguage = browser.i18n.getUILanguage();
const numberLocale = browserLanguage.split("-")[0].toLowerCase() === uiLanguage.split("-")[0].toLowerCase()
  ? browserLanguage
  : uiLanguage;
const numberFormatter = new Intl.NumberFormat(numberLocale);
// Grammar follows the translated text, even when Firefox uses another region.
const pluralRules = new Intl.PluralRules(uiLanguage);

function localizeDocument() {
  document.documentElement.lang = uiLanguage;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }
  elements.version.textContent = t("addonVersion", [browser.runtime.getManifest().version]);
}

let context = null;
let preview = null;
let job = null;
let phase = "loading";
let errorMessage = "";
let previewRequest = 0;
let jobRevision = 0;
let pollTimer = null;
let pollInFlight = false;
let ownCleanPending = false;
let ignoredJobId = null;
let closed = false;

function number(value) {
  return numberFormatter.format(Number(value || 0));
}

function countMessage(key, count) {
  const category = pluralRules.select(count);
  const suffix = category[0].toUpperCase() + category.slice(1);
  const substitutions = [number(count)];
  return t(`${key}${suffix}`, substitutions) || t(`${key}Other`, substitutions);
}

function urls(count) {
  return countMessage("urlCount", count);
}

function errorText(code) {
  return t(errors[code] || errors.INTERNAL_ERROR);
}

async function request(message) {
  const response = await browser.runtime.sendMessage(message);
  if (!response || typeof response.ok !== "boolean") {
    throw new Error("INTERNAL_ERROR");
  }
  if (!response.ok) {
    throw new Error(response.error || "INTERNAL_ERROR");
  }
  return response;
}

function render() {
  const running = phase === "cleaning" || ownCleanPending || job?.status === "running";
  const busy = phase === "loading" || phase === "previewing" || running;
  elements.hostname.textContent = context?.hostname || t(phase === "loading" ? "hostLoading" : "hostUnsupported");
  elements.previewButton.disabled = !context || busy;
  elements.previewButton.textContent = t(phase === "previewing" ? "previewLoading" : "previewButton");
  elements.form.setAttribute("aria-busy", String(phase === "previewing"));

  elements.previewPanel.hidden = !preview;
  elements.cleanButton.disabled = !preview || preview.count === 0 || busy;
  if (preview) {
    elements.previewSummary.textContent = preview.count === 0
      ? t("previewEmpty")
      : countMessage("previewSummary", preview.count);
    elements.cleanButton.textContent = countMessage("deleteCount", preview.count);
  }

  elements.jobPanel.hidden = !job;
  if (job) {
    const runningJob = job.status === "running";
    const hasProblems = job.status === "failed" || job.failed > 0;
    elements.jobHeading.textContent = t(runningJob ? "jobRunning" : hasProblems ? "jobWithErrors" : "jobCompleted");
    elements.jobTarget.textContent = job.hostname;
    elements.jobProgress.hidden = !runningJob;
    elements.jobProgress.max = Math.max(1, job.total);
    elements.jobProgress.value = job.processed;
    elements.jobSummary.textContent = runningJob
      ? t("jobProgressSummary", [number(job.processed), urls(job.total), number(job.deleted)])
      : countMessage("jobDeleted", job.deleted);

    const details = [];
    if (job.skipped > 0) {
      details.push(countMessage("jobSkipped", job.skipped));
    }
    if (job.failed > 0) {
      details.push(countMessage("jobFailed", job.failed));
    }
    if (job.error) {
      details.push(errorText(job.error));
    }
    if (runningJob) {
      details.push(t("jobMayClose"));
    } else if (!hasProblems && job.skipped === 0) {
      details.push(t("jobAllProcessed"));
    }
    elements.jobDetail.textContent = details.join(" ");
    // Keep one live region present from page load. Only announce changed
    // progress; the final result also includes skipped URLs and every error.
    const announcement = [
      elements.jobHeading.textContent,
      job.hostname,
      elements.jobSummary.textContent,
      ...(runningJob ? [] : details),
    ].join(" ");
    if (elements.jobAnnouncement.textContent !== announcement) {
      elements.jobAnnouncement.textContent = announcement;
    }
  } else if (elements.jobAnnouncement.textContent) {
    elements.jobAnnouncement.textContent = "";
  }

  elements.error.hidden = !errorMessage;
  elements.error.textContent = errorMessage;
}

function cancelPoll() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll() {
  cancelPoll();
  if (!closed && (ownCleanPending || job?.status === "running")) {
    pollTimer = setTimeout(poll, 500);
  }
}

function applyJob(nextJob) {
  if (!nextJob) {
    return;
  }
  jobRevision += 1;
  job = nextJob;
  phase = nextJob.status === "running" ? "cleaning" : "idle";
  preview = null;
  render();
  schedulePoll();
}

async function poll() {
  pollTimer = null;
  if (closed || pollInFlight) {
    return;
  }
  pollInFlight = true;
  const revision = jobRevision;
  try {
    const response = await request({ type: "state" });
    if (closed || revision !== jobRevision) {
      return;
    }
    if (response.job && (!ownCleanPending || response.job.id !== ignoredJobId)) {
      applyJob(response.job);
    } else if (!response.job && !ownCleanPending && job?.status === "running") {
      applyJob({ ...job, status: "failed", error: "INTERRUPTED" });
    }
  } catch {
    // A failed status read does not cancel a background operation.
    // The next poll recovers without replacing the last known result.
  } finally {
    pollInFlight = false;
    schedulePoll();
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!context || phase !== "idle" || ownCleanPending || job?.status === "running") {
    return;
  }
  const requestId = ++previewRequest;
  jobRevision += 1;
  phase = "previewing";
  preview = null;
  errorMessage = "";
  render();

  try {
    const response = await request({
      type: "preview",
      tabId: context.tabId,
      hostname: context.hostname,
    });
    if (requestId !== previewRequest || closed) {
      return;
    }
    preview = response.preview;
  } catch (error) {
    if (requestId !== previewRequest || closed) {
      return;
    }
    errorMessage = errorText(error.message);
  } finally {
    if (requestId === previewRequest && !closed) {
      phase = "idle";
      render();
    }
  }
});

elements.cleanButton.addEventListener("click", async () => {
  if (!preview || preview.count === 0 || phase !== "idle" || ownCleanPending || job?.status === "running") {
    return;
  }
  const candidate = preview;
  if (candidate.expiresAt <= Date.now()) {
    preview = null;
    errorMessage = errorText("EXPIRED");
    render();
    return;
  }

  ignoredJobId = job?.id || null;
  const previousJob = job;
  ownCleanPending = true;
  previewRequest += 1;
  jobRevision += 1;
  preview = null;
  errorMessage = "";
  phase = "cleaning";
  job = {
    id: null,
    hostname: candidate.hostname,
    status: "running",
    total: candidate.count,
    processed: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    error: null,
  };
  render();
  schedulePoll();

  try {
    const response = await request({ type: "clean", token: candidate.token });
    ownCleanPending = false;
    if (!closed) {
      applyJob(response.job);
    }
  } catch (error) {
    ownCleanPending = false;
    if (closed) {
      return;
    }
    phase = "idle";
    job = previousJob;
    jobRevision += 1;
    errorMessage = errorText(error.message);
    render();
    // Another popup may have started a job, or the message channel may
    // have closed after the background accepted this request.
    const revision = jobRevision;
    try {
      const response = await request({ type: "state" });
      if (!closed && revision === jobRevision && response.job) {
        applyJob(response.job);
      }
    } catch {
      // Keep the error and the last known result visible.
    }
  } finally {
    if (!closed) {
      render();
      schedulePoll();
    }
  }
});

window.addEventListener("pagehide", () => {
  closed = true;
  cancelPoll();
});

async function initialize() {
  localizeDocument();
  render();
  try {
    const response = await request({ type: "context" });
    if (closed) {
      return;
    }
    context = response.context;
    phase = "idle";
    if (response.job) {
      applyJob(response.job);
    }
  } catch (error) {
    if (closed) {
      return;
    }
    phase = "idle";
    errorMessage = errorText(error.message);
    // The active tab can be unsupported while a previous job still runs.
    try {
      const response = await request({ type: "state" });
      if (!closed && response.job) {
        applyJob(response.job);
      }
    } catch {
      // The initial actionable error remains visible.
    }
  }
  if (!closed) {
    render();
  }
}

initialize();
