const statusEl = document.getElementById('status');
const pingButton = document.getElementById('ping-button');

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
