const DEFAULT_PREFERENCES = {
  categories: ['primary', 'work'],
  maxThreads: 8,
  summaryLength: 'medium',
};

const STORAGE_KEY = 'popupPreferences';

const CATEGORY_LABELS = {
  primary: 'Primary',
  work: 'Work',
  promotions: 'Promotions',
  social: 'Social',
  finance: 'Finance',
};

const statusEl = document.getElementById('status');
const summarizeButton = document.getElementById('summarize-button');
const categoriesSelect = document.getElementById('categories');
const maxThreadsInput = document.getElementById('max-threads');
const summaryLengthSelect = document.getElementById('summary-length');
const summaryOutputEl = document.getElementById('summary-output');

initPopup();

async function initPopup() {
  const prefs = await loadPreferences();
  applyPreferencesToUI(prefs);

  categoriesSelect?.addEventListener('change', persistPreferencesFromUI);
  maxThreadsInput?.addEventListener('change', persistPreferencesFromUI);
  summaryLengthSelect?.addEventListener('change', persistPreferencesFromUI);
  summarizeButton?.addEventListener('click', runSummarizeFlow);
}

async function runSummarizeFlow() {
  setLoadingState(true);
  setStatus('Collecting unread Gmail threads...');
  summaryOutputEl.hidden = true;

  try {
    const prefs = getPreferencesFromUI();
    await savePreferences(prefs);

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab?.id || !activeTab.url?.startsWith('https://mail.google.com/')) {
      throw new Error('Open Gmail in the active tab to summarize unread threads.');
    }

    const collectResponse = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'COLLECT_UNREAD_THREADS',
      payload: {
        categories: prefs.categories,
        maxThreads: prefs.maxThreads,
      },
    });

    if (!collectResponse?.ok) {
      throw new Error(collectResponse?.error || 'Failed to collect unread threads from Gmail.');
    }

    if (!Array.isArray(collectResponse.threads) || collectResponse.threads.length === 0) {
      setStatus('No unread threads match your selected filters.');
      renderEmptyState('Try broadening categories or increasing max threads.');
      return;
    }

    setStatus(`Summarizing ${collectResponse.threads.length} thread(s)...`);

    const summarizeResponse = await chrome.runtime.sendMessage({
      type: 'SUMMARIZE_THREADS',
      payload: {
        summaryLength: prefs.summaryLength,
        categories: prefs.categories,
        threads: collectResponse.threads,
      },
    });

    if (!summarizeResponse?.ok || !summarizeResponse.summary) {
      throw new Error(summarizeResponse?.error || 'Background summarization failed.');
    }

    setStatus('Summary ready.');
    renderSummary(summarizeResponse.summary);
  } catch (error) {
    setStatus(`Error: ${error?.message || 'Unknown error.'}`);
    renderEmptyState('Unable to generate a summary right now.');
  } finally {
    setLoadingState(false);
  }
}

function renderSummary(summary) {
  const { overview, categories } = summary;

  const categoryBlocks = categories
    .map((categorySummary) => {
      const items = categorySummary.items
        .map((item) => {
          if (item.threadUrl) {
            return `<li>${escapeHtml(item.text)} <a href="${item.threadUrl}" target="_blank" rel="noopener noreferrer">Open</a></li>`;
          }

          return `<li>${escapeHtml(item.text)}</li>`;
        })
        .join('');

      return `
        <article class="category-summary">
          <h3>${escapeHtml(CATEGORY_LABELS[categorySummary.category] || categorySummary.category)}</h3>
          <ul>${items}</ul>
        </article>
      `;
    })
    .join('');

  summaryOutputEl.innerHTML = `
    <section class="overview">
      <h2>Overview</h2>
      <p>${escapeHtml(overview)}</p>
    </section>
    <section class="category-list">
      ${categoryBlocks}
    </section>
  `;

  summaryOutputEl.hidden = false;
}

function renderEmptyState(message) {
  summaryOutputEl.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
  summaryOutputEl.hidden = false;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setLoadingState(isLoading) {
  summarizeButton.disabled = isLoading;
  summarizeButton.textContent = isLoading ? 'Summarizing…' : 'Summarize unread';
}

function getPreferencesFromUI() {
  const selectedCategories = Array.from(categoriesSelect.selectedOptions).map((option) => option.value);
  const maxThreadsRaw = Number.parseInt(maxThreadsInput.value, 10);

  return {
    categories: selectedCategories.length > 0 ? selectedCategories : [...DEFAULT_PREFERENCES.categories],
    maxThreads: Number.isFinite(maxThreadsRaw)
      ? Math.min(50, Math.max(1, maxThreadsRaw))
      : DEFAULT_PREFERENCES.maxThreads,
    summaryLength: summaryLengthSelect.value || DEFAULT_PREFERENCES.summaryLength,
  };
}

function applyPreferencesToUI(prefs) {
  const categories = prefs.categories?.length ? prefs.categories : DEFAULT_PREFERENCES.categories;

  Array.from(categoriesSelect.options).forEach((option) => {
    option.selected = categories.includes(option.value);
  });

  maxThreadsInput.value = String(prefs.maxThreads || DEFAULT_PREFERENCES.maxThreads);
  summaryLengthSelect.value = prefs.summaryLength || DEFAULT_PREFERENCES.summaryLength;
}

async function persistPreferencesFromUI() {
  const prefs = getPreferencesFromUI();
  await savePreferences(prefs);
}

async function loadPreferences() {
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    return {
      ...DEFAULT_PREFERENCES,
      ...(stored?.[STORAGE_KEY] || {}),
    };
  } catch (error) {
    console.warn('Failed to load preferences from sync storage.', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

async function savePreferences(preferences) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: preferences });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
