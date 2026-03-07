chrome.runtime.onInstalled.addListener(() => {
  console.log('Gmail Summary Extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true, source: 'background' });
  }

  return false;
});
