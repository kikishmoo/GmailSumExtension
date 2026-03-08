const statusEl = document.getElementById('status');
const pingButton = document.getElementById('ping-button');
const summarizeButton = document.getElementById('summarize-button');
const categoriesForm = document.getElementById('categories-form');
const summaryMetaEl = document.getElementById('summary-meta');
const summaryListEl = document.getElementById('summary-list');

const CATEGORY_ORDER = ['Primary', 'Social', 'Promotions', 'Updates', 'Forums'];

function setStatus(message) {
  statusEl.textContent = message;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderSummary(summary, extractedAt) {
  if (!summaryListEl || !summaryMetaEl) {
    return;
  }

  summaryListEl.innerHTML = '';

  const timestamp = extractedAt ? new Date(extractedAt).toLocaleString() : 'unknown time';
  summaryMetaEl.textContent = `${summary.totalUnread} unread thread(s) summarized. Last extract: ${timestamp}.`;

  if (!summary.items.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No unread threads matched the selected categories.';
    summaryListEl.append(empty);
    return;
  }

  summary.items.forEach((item) => {
    const li = document.createElement('li');
    const subject = escapeHtml(item.subject || '(no subject)');
    const snippet = escapeHtml(item.snippet || '');

    li.innerHTML = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${subject}</a><br><small>${snippet}</small>`
      : `${subject}<br><small>${snippet}</small>`;

    summaryListEl.append(li);
  });
}

function renderCategoryOptions(selectedCategories) {
  if (!categoriesForm) {
    return;
  }

  const selectedSet = new Set(selectedCategories);

  categoriesForm.innerHTML = '';
  CATEGORY_ORDER.forEach((category) => {
    const label = document.createElement('label');
    label.className = 'category-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = category;
    input.checked = selectedSet.has(category);

    input.addEventListener('change', async () => {
      const selected = Array.from(categoriesForm.querySelectorAll('input[type="checkbox"]:checked')).map(
        (checkbox) => checkbox.value
      );

      try {
        const response = await sendMessage({ type: 'SET_SELECTED_CATEGORIES', selectedCategories: selected });
        if (response?.ok) {
          setStatus(`Tracking: ${response.selectedCategories.join(', ')}`);
        } else {
          setStatus(`Unable to save categories: ${response?.error || 'Unknown error'}`);
        }
      } catch (error) {
        setStatus(`Unable to save categories: ${error.message}`);
      }
    });

    const text = document.createElement('span');
    text.textContent = category;

    label.append(input, text);
    categoriesForm.append(label);
  });
}

async function initializePopup() {
  try {
    const response = await sendMessage({ type: 'GET_SELECTED_CATEGORIES' });
    const categories = response?.selectedCategories || CATEGORY_ORDER;
    renderCategoryOptions(categories);
    setStatus(`Tracking: ${categories.join(', ')}`);
  } catch (error) {
    setStatus(`Error loading categories: ${error.message}`);
  }
}

pingButton?.addEventListener('click', async () => {
  try {
    const response = await sendMessage({ type: 'PING' });

    if (response?.ok) {
      setStatus('Background service worker responded successfully.');
      return;
    }

    setStatus('No response from background service worker.');
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
});

summarizeButton?.addEventListener('click', async () => {
  setStatus('Generating summary from latest unread extraction...');

  try {
    const response = await sendMessage({ type: 'SUMMARIZE_LATEST_EXTRACTION' });

    if (!response?.ok) {
      setStatus(`Unable to summarize: ${response?.error || 'Unknown error'}`);
      return;
    }

    renderSummary(response.summary, response.extractedAt);
    setStatus('Summary generated successfully.');
  } catch (error) {
    setStatus(`Unable to summarize: ${error.message}`);
  }
});

initializePopup();
