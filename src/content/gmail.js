(() => {
  const marker = 'gmail-summary-extension-loaded';

  if (document.documentElement.dataset[marker]) {
    return;
  }

  document.documentElement.dataset[marker] = 'true';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'COLLECT_UNREAD_THREADS') {
      return false;
    }

    try {
      const { categories = [], maxThreads = 8 } = message.payload || {};
      const threads = collectUnreadThreads({ categories, maxThreads });

      sendResponse({ ok: true, threads });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || 'Failed to collect unread threads.' });
    }

    return false;
  });

  console.log('Gmail Summary content script loaded on:', window.location.href);
})();

function collectUnreadThreads({ categories, maxThreads }) {
  const selectedCategories = Array.isArray(categories) ? categories : [];
  const unreadRows = Array.from(document.querySelectorAll('tr.zA.zE'));
  const threads = [];

  for (const row of unreadRows) {
    if (threads.length >= maxThreads) {
      break;
    }

    const subject = cleanText(row.querySelector('span.bog')?.textContent || 'No subject');
    const snippet = cleanText(row.querySelector('span.y2')?.textContent || '');
    const threadAnchor = row.querySelector('a[href*="#inbox/"]');
    const threadUrl = threadAnchor ? new URL(threadAnchor.getAttribute('href'), window.location.origin).toString() : null;

    const category = inferCategory(`${subject} ${snippet}`);

    if (selectedCategories.length > 0 && !selectedCategories.includes(category)) {
      continue;
    }

    threads.push({
      subject,
      snippet,
      category,
      threadUrl,
    });
  }

  return threads;
}

function inferCategory(text) {
  const normalized = text.toLowerCase();

  if (/(invoice|payment|receipt|bank|transaction|statement)/.test(normalized)) {
    return 'finance';
  }

  if (/(team|project|meeting|deadline|client|action item|review)/.test(normalized)) {
    return 'work';
  }

  if (/(sale|offer|deal|discount|promo|shop|save now)/.test(normalized)) {
    return 'promotions';
  }

  if (/(friend|social|invite|comment|mention|follow)/.test(normalized)) {
    return 'social';
  }

  return 'primary';
}

function cleanText(value) {
  return value.replace(/^\s*-\s*/, '').replace(/\s+/g, ' ').trim();
}
