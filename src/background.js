const CATEGORY_ORDER = ['Primary', 'Social', 'Promotions', 'Updates', 'Forums'];
const DEFAULT_SELECTED_CATEGORIES = [...CATEGORY_ORDER];
let latestUnreadExtraction = null;

if (typeof importScripts === 'function') {
  importScripts('./lib/summarizer.js');
}

function normalizeCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) {
    return [...DEFAULT_SELECTED_CATEGORIES];
  }

  const categories = rawCategories
    .map((value) => String(value || '').trim())
    .filter((value) => CATEGORY_ORDER.includes(value));

  return categories.length > 0 ? [...new Set(categories)] : [...DEFAULT_SELECTED_CATEGORIES];
}

function normalizeThreadCategory(threadCategory, extractionCategory) {
  const candidates = [threadCategory, extractionCategory, 'Primary'];
  return candidates.find((value) => CATEGORY_ORDER.includes(value)) || 'Primary';
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ selectedCategories: DEFAULT_SELECTED_CATEGORIES }, () => {
    if (chrome.runtime.lastError) {
      console.warn('Unable to initialize selected categories:', chrome.runtime.lastError.message);
    }
  });

  console.log('Gmail Summary Extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true, source: 'background' });
    return false;
  }

  if (message?.type === 'GET_SELECTED_CATEGORIES') {
    chrome.storage.sync.get({ selectedCategories: DEFAULT_SELECTED_CATEGORIES }, (result) => {
      sendResponse({ selectedCategories: normalizeCategories(result.selectedCategories) });
    });
    return true;
  }

  if (message?.type === 'SET_SELECTED_CATEGORIES') {
    const selectedCategories = normalizeCategories(message.selectedCategories);
    chrome.storage.sync.set({ selectedCategories }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ ok: true, selectedCategories });
    });
    return true;
  }

  if (message?.type === 'UNREAD_THREADS_EXTRACTED') {
    latestUnreadExtraction = {
      ...message,
      tabId: sender?.tab?.id ?? null,
      url: sender?.tab?.url ?? null
    };

    console.debug('Unread thread payload received:', {
      category: message.category,
      threads: Array.isArray(message.threads) ? message.threads.length : 0,
      tabId: sender?.tab?.id
    });

    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'GET_LATEST_EXTRACTION') {
    sendResponse({ ok: true, payload: latestUnreadExtraction });
    return false;
  }

  if (message?.type === 'SUMMARIZE_LATEST_EXTRACTION') {
    chrome.storage.sync.get({ selectedCategories: DEFAULT_SELECTED_CATEGORIES }, (result) => {
      const selectedCategories = normalizeCategories(result.selectedCategories);
      const rawThreads = Array.isArray(latestUnreadExtraction?.threads) ? latestUnreadExtraction.threads : [];

      const threads = rawThreads.map((thread, index) => ({
        unread: true,
        threadId: thread?.threadUrl || `thread-${index}`,
        subject: thread?.subject || '',
        category: normalizeThreadCategory(thread?.category, latestUnreadExtraction?.category),
        snippet: thread?.snippet || '',
        url: thread?.threadUrl || ''
      }));

      const summarize = globalThis.summarizeUnreadEmails;
      if (typeof summarize !== 'function') {
        sendResponse({ ok: false, error: 'Summarizer unavailable in background worker.' });
        return;
      }

      const summary = summarize(threads, { selectedCategories });
      sendResponse({ ok: true, summary, extractedAt: latestUnreadExtraction?.extractedAt || null });
    });
    return true;
  }

  return false;
});
