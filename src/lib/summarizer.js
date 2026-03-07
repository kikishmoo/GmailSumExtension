const MAX_BULLETS = 6;

const PRIORITY_KEYWORDS = ['urgent', 'asap', 'deadline', 'action required', 'follow up', 'approval'];
const ACTION_KEYWORDS = ['please', 'can you', 'review', 'approve', 'reply', 'confirm', 'send', 'complete'];

function normalizeThread(thread = {}) {
  return {
    id: String(thread.id ?? thread.threadId ?? ''),
    subject: String(thread.subject ?? 'No subject').trim(),
    snippet: String(thread.snippet ?? '').trim(),
    sender: String(thread.sender ?? thread.from ?? 'Unknown sender').trim(),
    category: String(thread.category ?? 'Uncategorized').trim(),
    unread: Boolean(thread.unread),
    important: Boolean(thread.important),
    timestamp: Number(thread.timestamp ?? thread.internalDate ?? 0),
  };
}

function scorePriority(thread) {
  const text = `${thread.subject} ${thread.snippet}`.toLowerCase();
  const keywordHit = PRIORITY_KEYWORDS.some((keyword) => text.includes(keyword));

  if (thread.important || keywordHit) {
    return 2;
  }

  if (thread.unread) {
    return 1;
  }

  return 0;
}

function priorityMarker(score) {
  if (score >= 2) {
    return '🔴';
  }

  if (score === 1) {
    return '🟡';
  }

  return '⚪';
}

function conciseSnippet(snippet) {
  if (!snippet) {
    return 'No preview available';
  }

  return snippet.length > 100 ? `${snippet.slice(0, 97)}...` : snippet;
}

function groupThreads(threads) {
  return threads.reduce(
    (acc, thread) => {
      const categoryKey = thread.category || 'Uncategorized';
      const senderKey = thread.sender || 'Unknown sender';

      acc.byCategory[categoryKey] = (acc.byCategory[categoryKey] ?? 0) + 1;
      acc.bySender[senderKey] = (acc.bySender[senderKey] ?? 0) + 1;
      return acc;
    },
    { byCategory: {}, bySender: {} }
  );
}

function collectActionItems(threads) {
  const items = [];

  for (const thread of threads) {
    const text = `${thread.subject} ${thread.snippet}`.toLowerCase();
    const hasActionLanguage = ACTION_KEYWORDS.some((keyword) => text.includes(keyword));

    if (hasActionLanguage || scorePriority(thread) >= 2) {
      items.push(`${thread.sender}: ${thread.subject}`);
    }

    if (items.length >= MAX_BULLETS) {
      break;
    }
  }

  return items;
}

export function summarizeThreadsLocal(rawThreads = []) {
  const normalizedThreads = rawThreads
    .map((thread) => normalizeThread(thread))
    .filter((thread) => thread.id || thread.subject || thread.snippet)
    .sort((a, b) => {
      const scoreDelta = scorePriority(b) - scorePriority(a);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const timeDelta = b.timestamp - a.timestamp;
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return a.subject.localeCompare(b.subject);
    });

  const grouped = groupThreads(normalizedThreads);

  const bulletLines = normalizedThreads.slice(0, MAX_BULLETS).map((thread) => {
    const marker = priorityMarker(scorePriority(thread));
    return `- ${marker} ${thread.sender} — ${thread.subject}: ${conciseSnippet(thread.snippet)}`;
  });

  if (bulletLines.length === 0) {
    bulletLines.push('- ⚪ No threads available to summarize.');
  }

  return {
    summaryText: bulletLines.join('\n'),
    highPriority: normalizedThreads.filter((thread) => scorePriority(thread) >= 2).map((thread) => thread.id),
    actionItems: collectActionItems(normalizedThreads),
    threadsIncluded: normalizedThreads.length,
    groups: grouped,
  };
}

export function normalizeSummaryOutput(summary = {}, fallbackThreadsCount = 0) {
  const summaryText = String(summary.summaryText ?? '').trim();

  return {
    summaryText: summaryText || '- ⚪ No threads available to summarize.',
    highPriority: Array.isArray(summary.highPriority) ? summary.highPriority : [],
    actionItems: Array.isArray(summary.actionItems) ? summary.actionItems : [],
    threadsIncluded: Number(summary.threadsIncluded ?? fallbackThreadsCount),
  };
}
