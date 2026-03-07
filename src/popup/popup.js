const statusEl = document.getElementById('status');
const pingButton = document.getElementById('ping-button');
const loadSummaryButton = document.getElementById('load-summary-button');
const summaryOutput = document.getElementById('summary-output');

function setSummaryText(summary) {
  if (!summary) {
    summaryOutput.textContent = 'No stored summary yet.';
    return;
  }

  const lines = [
    `Threads included: ${summary.threadsIncluded ?? 0}`,
    `High priority: ${(summary.highPriority ?? []).length}`,
    '',
    summary.summaryText ?? '',
  ];

  const actions = summary.actionItems ?? [];
  if (actions.length > 0) {
    lines.push('', 'Action items:');
    actions.forEach((item) => lines.push(`- ${item}`));
  }

  summaryOutput.textContent = lines.join('\n').trim();
}

pingButton?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }

    if (response?.ok) {
      statusEl.textContent = 'Background service worker responded successfully.';
      return;
    }

    statusEl.textContent = 'No response from background service worker.';
  });
});

loadSummaryButton?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_LATEST_SUMMARY' }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }

    if (!response?.ok) {
      statusEl.textContent = 'Unable to load latest summary.';
      return;
    }

    statusEl.textContent = `Loaded latest summary for ${response.accountId}.`;
    setSummaryText(response.summary);
  });
});
