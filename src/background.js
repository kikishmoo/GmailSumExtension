chrome.runtime.onInstalled.addListener(() => {
  console.log('Gmail Summary Extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SUMMARIZE_THREADS') {
    const { threads = [], summaryLength = 'medium' } = message.payload || {};

    const summary = buildSummary(threads, summaryLength);
    sendResponse({ ok: true, summary });
    return false;
  }

  if (message?.type === 'PING') {
    sendResponse({ ok: true, source: 'background' });
    return false;
  }

  return false;
});

function buildSummary(threads, summaryLength) {
  const grouped = groupByCategory(threads);
  const categoryEntries = Object.entries(grouped)
    .map(([category, items]) => {
      const maxBullets = getMaxBullets(summaryLength);
      const categoryItems = items.slice(0, maxBullets).map((thread) => ({
        text: `${thread.subject} — ${thread.snippet}`,
        threadUrl: thread.threadUrl,
      }));

      return {
        category,
        total: items.length,
        items: categoryItems,
      };
    })
    .sort((a, b) => b.total - a.total);

  const overview = createOverview(threads, categoryEntries);

  return {
    overview,
    categories: categoryEntries,
  };
}

function groupByCategory(threads) {
  return threads.reduce((acc, thread) => {
    const category = thread.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push(thread);
    return acc;
  }, {});
}

function getMaxBullets(summaryLength) {
  if (summaryLength === 'short') {
    return 2;
  }

  if (summaryLength === 'long') {
    return 6;
  }

  return 4;
}

function createOverview(threads, categoryEntries) {
  const total = threads.length;
  const topCategories = categoryEntries
    .slice(0, 3)
    .map((entry) => `${entry.total} ${entry.category}`)
    .join(', ');

  if (!topCategories) {
    return 'No unread activity was found.';
  }

  return `Found ${total} unread thread${total === 1 ? '' : 's'} across ${categoryEntries.length} categor${
    categoryEntries.length === 1 ? 'y' : 'ies'
  }: ${topCategories}.`;
}
