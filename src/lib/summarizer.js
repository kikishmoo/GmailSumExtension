function truncateSnippet(snippet, maxLength = 140) {
  const normalizedSnippet = typeof snippet === 'string' ? snippet.trim() : '';

  if (normalizedSnippet.length <= maxLength) {
    return normalizedSnippet;
  }

  return `${normalizedSnippet.slice(0, maxLength - 1)}…`;
}

function summarizeUnreadEmails(threads, options = {}) {
  const {
    selectedCategories = [],
    maxSnippetLength = 140,
  } = options;

  const allowedCategories = new Set(selectedCategories);
  const dedupedThreadIds = new Set();

  const items = (Array.isArray(threads) ? threads : [])
    .filter((thread) => thread?.unread)
    .filter((thread) => {
      if (!allowedCategories.size) {
        return true;
      }

      return allowedCategories.has(thread.category);
    })
    .filter((thread) => {
      if (!thread?.threadId || dedupedThreadIds.has(thread.threadId)) {
        return false;
      }

      dedupedThreadIds.add(thread.threadId);
      return true;
    })
    .map((thread) => ({
      threadId: thread.threadId,
      subject: thread.subject || '(no subject)',
      category: thread.category || 'unknown',
      snippet: truncateSnippet(thread.snippet, maxSnippetLength),
      url: thread.url || '',
    }));

  return {
    totalUnread: items.length,
    selectedCategories: [...allowedCategories],
    items,
  };
}

module.exports = {
  summarizeUnreadEmails,
  truncateSnippet,
};
