import { normalizeSummaryOutput, summarizeThreadsLocal } from './lib/summarizer.js';
import { summarizeWithOpenAI } from './lib/providers/openai.js';

const FEATURE_FLAGS = {
  enableExternalProvider: false,
};

const MESSAGE_TYPES = {
  PING: 'PING',
  SUMMARIZE_THREADS: 'SUMMARIZE_THREADS',
  EXTRACTED_THREADS: 'EXTRACTED_THREADS',
  GET_LATEST_SUMMARY: 'GET_LATEST_SUMMARY',
  // Backward-compatible aliases used by older popup/content integrations.
  LEGACY_SUMMARIZE_THREADS: 'SUMMARIZE',
  LEGACY_GET_LATEST_SUMMARY: 'GET_SUMMARY',
};

function getSummaryStorageKey(accountId = 'default') {
  return `latestSummary:${accountId}`;
}

function getSummaryLookupKeys(accountId = 'default') {
  const accountKey = getSummaryStorageKey(accountId);

  // Maintain compatibility with earlier key formats used by in-flight branches.
  const fallbackKeys = ['latestSummary'];
  if (accountId === 'default') {
    fallbackKeys.push('latestSummary:default');
  }

  return [accountKey, ...fallbackKeys];
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result);
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

function extractThreadsFromMessage(message = {}) {
  if (Array.isArray(message.threads)) {
    return message.threads;
  }

  if (Array.isArray(message.payload?.threads)) {
    return message.payload.threads;
  }

  if (Array.isArray(message.data?.threads)) {
    return message.data.threads;
  }

  return [];
}

function deriveAccountId(message = {}, sender = {}) {
  if (message.accountId) {
    return String(message.accountId);
  }

  if (message.payload?.accountId) {
    return String(message.payload.accountId);
  }

  if (message.data?.accountId) {
    return String(message.data.accountId);
  }

  const explicitGmailUrl = message.gmailUrl ?? message.payload?.gmailUrl;
  if (explicitGmailUrl) {
    try {
      const parsed = new URL(String(explicitGmailUrl));
      const authUser = parsed.searchParams.get('authuser');
      if (authUser) {
        return `gmail:${authUser}`;
      }

      const userPathMatch = parsed.pathname.match(/\/u\/(\d+)\//);
      if (userPathMatch) {
        return `gmail:${userPathMatch[1]}`;
      }
    } catch (_error) {
      // continue to sender URL fallback
    }
  }

  const senderUrl = sender?.url;
  if (!senderUrl) {
    return 'default';
  }

  try {
    const parsed = new URL(senderUrl);
    const authUser = parsed.searchParams.get('authuser');
    if (authUser) {
      return `gmail:${authUser}`;
    }

    const userPathMatch = parsed.pathname.match(/\/u\/(\d+)\//);
    if (userPathMatch) {
      return `gmail:${userPathMatch[1]}`;
    }
  } catch (_error) {
    return 'default';
  }

  return 'default';
}

async function summarizeWithProvider(threads) {
  const config = await storageGet(['summarySettings']);
  const settings = config.summarySettings ?? {};
  const shouldUseExternal = FEATURE_FLAGS.enableExternalProvider && settings.useExternalProvider === true;

  if (shouldUseExternal) {
    try {
      const providerSummary = await summarizeWithOpenAI({
        apiKey: settings.openAIApiKey,
        model: settings.openAIModel,
        threads,
      });

      if (providerSummary) {
        return providerSummary;
      }
    } catch (error) {
      console.warn('OpenAI provider failed, falling back to local summarizer.', error);
    }
  }

  return normalizeSummaryOutput(summarizeThreadsLocal(threads), threads.length);
}

async function handleThreadSummaryMessage(message, sender) {
  const threads = extractThreadsFromMessage(message);
  const accountId = deriveAccountId(message, sender);

  const summary = await summarizeWithProvider(threads);
  const storageKey = getSummaryStorageKey(accountId);
  await storageSet({
    [storageKey]: {
      accountId,
      generatedAt: new Date().toISOString(),
      ...summary,
    },
  });

  return { ok: true, accountId, summary };
}

async function getLatestSummary(message, sender) {
  const accountId = deriveAccountId(message, sender);
  const lookupKeys = getSummaryLookupKeys(accountId);
  const stored = await storageGet(lookupKeys);

  const matchedKey = lookupKeys.find((key) => stored[key]);
  return {
    ok: true,
    accountId,
    summary: matchedKey ? stored[matchedKey] : null,
    storageKeyUsed: matchedKey ?? null,
  };
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Gmail Summary Extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.PING) {
    sendResponse({ ok: true, source: 'background' });
    return false;
  }

  if (
    message?.type === MESSAGE_TYPES.SUMMARIZE_THREADS ||
    message?.type === MESSAGE_TYPES.EXTRACTED_THREADS ||
    message?.type === MESSAGE_TYPES.LEGACY_SUMMARIZE_THREADS
  ) {
    handleThreadSummaryMessage(message, sender)
      .then((payload) => sendResponse(payload))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (
    message?.type === MESSAGE_TYPES.GET_LATEST_SUMMARY ||
    message?.type === MESSAGE_TYPES.LEGACY_GET_LATEST_SUMMARY
  ) {
    getLatestSummary(message, sender)
      .then((payload) => sendResponse(payload))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
