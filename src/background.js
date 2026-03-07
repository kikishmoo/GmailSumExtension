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
};

function getSummaryStorageKey(accountId = 'default') {
  return `latestSummary:${accountId}`;
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

async function summarizeWithProvider({ threads, accountId }) {
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

  const localSummary = summarizeThreadsLocal(threads);
  return normalizeSummaryOutput(localSummary, threads.length);
}

async function handleThreadSummaryMessage(message) {
  const threads = Array.isArray(message?.threads) ? message.threads : [];
  const accountId = message?.accountId ?? 'default';

  const summary = await summarizeWithProvider({ threads, accountId });
  const storageKey = getSummaryStorageKey(accountId);
  await storageSet({
    [storageKey]: {
      ...summary,
      accountId,
      generatedAt: new Date().toISOString(),
    },
  });

  return { ok: true, accountId, summary };
}

async function getLatestSummary(message) {
  const accountId = message?.accountId ?? 'default';
  const storageKey = getSummaryStorageKey(accountId);
  const stored = await storageGet([storageKey]);
  return { ok: true, accountId, summary: stored[storageKey] ?? null };
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Gmail Summary Extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.PING) {
    sendResponse({ ok: true, source: 'background' });
    return false;
  }

  if (message?.type === MESSAGE_TYPES.SUMMARIZE_THREADS || message?.type === MESSAGE_TYPES.EXTRACTED_THREADS) {
    handleThreadSummaryMessage(message)
      .then((payload) => sendResponse(payload))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message?.type === MESSAGE_TYPES.GET_LATEST_SUMMARY) {
    getLatestSummary(message)
      .then((payload) => sendResponse(payload))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
