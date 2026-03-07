const DEFAULT_PREFERENCES = {
  categories: ['primary', 'work'],
  maxThreads: 8,
  summaryLength: 'medium',
};

const STORAGE_KEY = 'popupPreferences';
const SUMMARY_LENGTHS = new Set(['short', 'medium', 'long']);
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
  setStatus('loading', 'Collecting unread Gmail threads...');
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
      setStatus('success', 'No unread threads match your selected filters.');
      renderEmptyState('Try broadening categories or increasing max threads.');
      return;
    }

    setStatus('loading', `Summarizing ${collectResponse.threads.length} thread(s)...`);

    const summarizeResponse = await chrome.runtime.sendMessage({
      type: 'SUMMARIZE_THREADS',
      payload: {
        summaryLength: prefs.summaryLength,
        threads: collectResponse.threads,
      },
    });

    if (!summarizeResponse?.ok || !summarizeResponse.summary) {
      throw new Error(summarizeResponse?.error || 'Background summarization failed.');
    }

    setStatus('success', 'Summary ready.');
    renderSummary(summarizeResponse.summary);
  } catch (error) {
    const message = normalizeErrorMessage(error);
    setStatus('error', `Error: ${message}`);
    renderEmptyState('Unable to generate a summary right now.');
  } finally {
    setLoadingState(false);
  }
}

function normalizeErrorMessage(error) {
  if (!error?.message) {
    return 'Unknown error.';
  }

  if (error.message.includes('Could not establish connection. Receiving end does not exist.')) {
    return 'Gmail is open, but the page may still be loading. Wait a moment and try again.';
  }

  return error.message;
}

function renderSummary(summary) {
  summaryOutputEl.replaceChildren();

  const overviewSection = document.createElement('section');
  overviewSection.className = 'overview';

  const overviewHeading = document.createElement('h2');
  overviewHeading.textContent = 'Overview';
  const overviewText = document.createElement('p');
  overviewText.textContent = String(summary.overview || 'No overview available.');
  overviewSection.append(overviewHeading, overviewText);

  const categoryList = document.createElement('section');
  categoryList.className = 'category-list';

  const categories = Array.isArray(summary.categories) ? summary.categories : [];
  categories.forEach((categorySummary) => {
    const article = document.createElement('article');
    article.className = 'category-summary';

    const heading = document.createElement('h3');
    heading.textContent = CATEGORY_LABELS[categorySummary.category] || categorySummary.category || 'Other';

    const list = document.createElement('ul');
    const items = Array.isArray(categorySummary.items) ? categorySummary.items : [];

    items.forEach((item) => {
      const li = document.createElement('li');
      li.append(document.createTextNode(String(item.text || '')));

      if (item.threadUrl) {
        const link = document.createElement('a');
        link.href = String(item.threadUrl);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open';
        li.append(' ', link);
      }

      list.append(li);
    });

    article.append(heading, list);
    categoryList.append(article);
  });

  summaryOutputEl.append(overviewSection, categoryList);
  summaryOutputEl.hidden = false;
}

function renderEmptyState(message) {
  summaryOutputEl.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = String(message || 'No results to display.');
  summaryOutputEl.append(empty);
  summaryOutputEl.hidden = false;
}

function setStatus(state, text) {
  statusEl.dataset.state = state;
  statusEl.textContent = text;
}

function setLoadingState(isLoading) {
  summarizeButton.disabled = isLoading;
  categoriesSelect.disabled = isLoading;
  maxThreadsInput.disabled = isLoading;
  summaryLengthSelect.disabled = isLoading;
  summarizeButton.textContent = isLoading ? 'Summarizing…' : 'Summarize unread';
}

function getPreferencesFromUI() {
  const selectedCategories = Array.from(categoriesSelect.selectedOptions).map((option) => option.value);
  const maxThreadsRaw = Number.parseInt(maxThreadsInput.value, 10);
  const rawSummaryLength = summaryLengthSelect.value;

  return sanitizePreferences({
    categories: selectedCategories.length > 0 ? selectedCategories : [...DEFAULT_PREFERENCES.categories],
    maxThreads: maxThreadsRaw,
    summaryLength: rawSummaryLength,
  });
}

function applyPreferencesToUI(prefs) {
  const normalized = sanitizePreferences(prefs);

  Array.from(categoriesSelect.options).forEach((option) => {
    option.selected = normalized.categories.includes(option.value);
  });

  maxThreadsInput.value = String(normalized.maxThreads);
  summaryLengthSelect.value = normalized.summaryLength;
}

function sanitizePreferences(rawPrefs) {
  const availableCategories = Array.from(categoriesSelect.options).map((option) => option.value);
  const categories = Array.isArray(rawPrefs?.categories)
    ? rawPrefs.categories.filter((category) => availableCategories.includes(category))
    : [];
  const summaryLength = SUMMARY_LENGTHS.has(rawPrefs?.summaryLength)
    ? rawPrefs.summaryLength
    : DEFAULT_PREFERENCES.summaryLength;
  const maxThreads = Number.isFinite(rawPrefs?.maxThreads)
    ? Math.min(50, Math.max(1, Math.round(rawPrefs.maxThreads)))
    : DEFAULT_PREFERENCES.maxThreads;

  return {
    categories: categories.length > 0 ? categories : [...DEFAULT_PREFERENCES.categories],
    maxThreads,
    summaryLength,
  };
}

async function persistPreferencesFromUI() {
  await savePreferences(getPreferencesFromUI());
}

async function loadPreferences() {
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    return sanitizePreferences(stored?.[STORAGE_KEY] || DEFAULT_PREFERENCES);
  } catch (error) {
    console.warn('Failed to load preferences from sync storage.', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

async function savePreferences(preferences) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: sanitizePreferences(preferences) });
}
