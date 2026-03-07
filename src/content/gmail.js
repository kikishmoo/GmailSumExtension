(() => {
  const marker = 'gmail-summary-extension-loaded';

  if (document.documentElement.dataset[marker]) {
    return;
  }

  document.documentElement.dataset[marker] = 'true';
  console.log('Gmail Summary content script loaded on:', window.location.href);
})();
