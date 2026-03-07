(() => {
  const marker = 'gmail-summary-extension-loaded';

  if (document.documentElement.dataset[marker]) {
    return;
  }

  document.documentElement.dataset[marker] = 'true';

  const STORAGE_KEYS = {
    selectedCategories: 'selectedCategories'
  };

  const CATEGORY_ORDER = ['Primary', 'Social', 'Promotions', 'Updates', 'Forums'];
  const DEFAULT_SELECTED_CATEGORIES = [...CATEGORY_ORDER];

  const SELECTORS = {
    appShell: ['div[role="main"]', 'table[role="grid"]', 'tr.zA'],
    categoryTabs: ['div[role="tablist"] [role="tab"]', 'div[gh="tl"] [role="tab"]'],
    threadRows: ['tr.zA', 'tr[role="row"][class*="zA"]'],
    unreadRows: ['tr.zA.zE', 'tr.zA[aria-label*="Unread"]', 'tr.zA[aria-label*="unread"]'],
    sender: ['.yW span[email]', '.yW', '.yP', '.zF'],
    subject: ['.bog', 'span[data-thread-id] .bog', '.xS .bog'],
    snippet: ['.y2', '.y6 span'],
    timestamp: ['td.xW span[title]', 'td.xW span', 'span.xW']
  };

  /**
   * @typedef {'Primary'|'Social'|'Promotions'|'Updates'|'Forums'} GmailCategory
   */

  /**
   * @typedef {Object} UnreadThreadMetadata
   * @property {string} sender
   * @property {string} subject
   * @property {string} snippet
   * @property {string} timestamp
   * @property {string} threadUrl
   */

  /**
   * @typedef {Object} UnreadThreadsExtractedMessage
   * @property {'UNREAD_THREADS_EXTRACTED'} type
   * @property {GmailCategory|null} category
   * @property {GmailCategory[]} selectedCategories
   * @property {UnreadThreadMetadata[]} threads
   * @property {string} extractedAt
   */

  /** @type {GmailCategory[]} */
  let selectedCategories = [...DEFAULT_SELECTED_CATEGORIES];
  let observer = null;
  let retryCount = 0;
  let scanTimer = null;

  function dedupeAndNormalizeCategories(rawCategories) {
    if (!Array.isArray(rawCategories)) {
      return [...DEFAULT_SELECTED_CATEGORIES];
    }

    const normalized = rawCategories
      .map((value) => String(value || '').trim())
      .filter((value) => CATEGORY_ORDER.includes(value));

    return normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULT_SELECTED_CATEGORIES];
  }

  function queryFirst(selectors, root = document) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return null;
  }

  function queryAll(selectors, root = document) {
    for (const selector of selectors) {
      const nodes = root.querySelectorAll(selector);
      if (nodes.length > 0) {
        return Array.from(nodes);
      }
    }

    return [];
  }

  function textFromSelectors(root, selectors) {
    const element = queryFirst(selectors, root);
    if (!element) {
      return '';
    }

    const attributeText = element.getAttribute('title') || element.getAttribute('aria-label');
    return (attributeText || element.textContent || '').trim();
  }

  function resolveThreadUrl(row) {
    const link =
      row.querySelector('a[href*="#inbox/"]') ||
      row.querySelector('a[href*="#all/"]') ||
      row.querySelector('a[href*="#"]');

    if (!link) {
      return '';
    }

    try {
      return new URL(link.getAttribute('href') || '', window.location.origin).toString();
    } catch (_error) {
      return link.href || '';
    }
  }

  function detectCurrentCategory() {
    const tabs = queryAll(SELECTORS.categoryTabs);

    for (const tab of tabs) {
      const tabLabel = (tab.textContent || tab.getAttribute('aria-label') || '').trim();
      if (!tabLabel) {
        continue;
      }

      const matchingCategory = CATEGORY_ORDER.find((category) =>
        tabLabel.toLowerCase().includes(category.toLowerCase())
      );

      if (!matchingCategory) {
        continue;
      }

      if (tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('byl')) {
        return matchingCategory;
      }
    }

    return null;
  }

  function isUnreadRow(row) {
    if (row.classList.contains('zE')) {
      return true;
    }

    const rowLabel = (row.getAttribute('aria-label') || '').toLowerCase();
    return rowLabel.includes('unread');
  }

  /** @returns {UnreadThreadMetadata[]} */
  function collectUnreadThreads() {
    const rows = queryAll(SELECTORS.threadRows);

    if (rows.length === 0) {
      return [];
    }

    const unreadRows = rows.filter(isUnreadRow);

    if (unreadRows.length === 0) {
      return [];
    }

    return unreadRows.map((row) => ({
      sender: textFromSelectors(row, SELECTORS.sender),
      subject: textFromSelectors(row, SELECTORS.subject),
      snippet: textFromSelectors(row, SELECTORS.snippet),
      timestamp: textFromSelectors(row, SELECTORS.timestamp),
      threadUrl: resolveThreadUrl(row)
    }));
  }

  function sendThreadsPayload() {
    const activeCategory = detectCurrentCategory();

    if (activeCategory && !selectedCategories.includes(activeCategory)) {
      return;
    }

    const threads = collectUnreadThreads();

    /** @type {UnreadThreadsExtractedMessage} */
    const payload = {
      type: 'UNREAD_THREADS_EXTRACTED',
      category: activeCategory,
      selectedCategories: selectedCategories.slice(),
      threads,
      extractedAt: new Date().toISOString()
    };

    chrome.runtime.sendMessage(payload, () => {
      if (chrome.runtime.lastError) {
        console.debug('Gmail Summary sendMessage warning:', chrome.runtime.lastError.message);
      }
    });
  }

  function queueScan(delay = 250) {
    if (scanTimer) {
      window.clearTimeout(scanTimer);
    }

    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      sendThreadsPayload();
    }, delay);
  }

  function isGmailDomReady() {
    return SELECTORS.appShell.every((selector) => document.querySelector(selector));
  }

  function initializeObserver() {
    if (observer) {
      return;
    }

    observer = new MutationObserver((mutations) => {
      const hasRelevantChanges = mutations.some(
        (mutation) =>
          mutation.type === 'childList' ||
          (mutation.type === 'attributes' && ['class', 'aria-selected', 'aria-label'].includes(mutation.attributeName || ''))
      );

      if (hasRelevantChanges) {
        queueScan(300);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-label', 'aria-selected']
    });
  }

  function waitForGmailDom() {
    if (isGmailDomReady()) {
      retryCount = 0;
      initializeObserver();
      queueScan(50);
      return;
    }

    retryCount += 1;

    if (retryCount > 20) {
      console.warn('Gmail Summary: Gmail DOM readiness not detected after retries.');
      initializeObserver();
      queueScan(500);
      return;
    }

    const retryDelay = Math.min(2000, 200 + retryCount * 150);
    window.setTimeout(waitForGmailDom, retryDelay);
  }

  function loadCategorySelection() {
    chrome.storage.sync.get({ [STORAGE_KEYS.selectedCategories]: DEFAULT_SELECTED_CATEGORIES }, (result) => {
      if (chrome.runtime.lastError) {
        console.warn('Gmail Summary: unable to read selected categories, using defaults.');
        selectedCategories = [...DEFAULT_SELECTED_CATEGORIES];
      } else {
        selectedCategories = dedupeAndNormalizeCategories(result[STORAGE_KEYS.selectedCategories]);
      }

      waitForGmailDom();
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[STORAGE_KEYS.selectedCategories]) {
      return;
    }

    selectedCategories = dedupeAndNormalizeCategories(changes[STORAGE_KEYS.selectedCategories].newValue);
    queueScan(0);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      queueScan(100);
    }
  });

  loadCategorySelection();
  console.log('Gmail Summary content script loaded on:', window.location.href);
})();
