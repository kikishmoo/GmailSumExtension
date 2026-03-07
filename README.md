# GmailSumExtension

A starter Chrome Extension (Manifest V3) scaffold for Gmail integration.

## Project structure

```text
.
├── manifest.json
└── src
    ├── background.js
    ├── content
    │   └── gmail.js
    ├── lib
    │   ├── README.md
    │   └── summarizer.js
    └── popup
        ├── index.html
        ├── popup.css
        └── popup.js
```

## Load as unpacked extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select this repository root folder (`GmailSumExtension`) that contains `manifest.json`.
5. Confirm the extension appears in your extensions list.

## Verify it works

1. Open `https://mail.google.com/` in Chrome.
2. Open DevTools on the Gmail tab and check the Console for:
   - `Gmail Summary content script loaded on: ...`
3. Click the extension icon in the toolbar to open the popup.
4. Click **Ping Background** in the popup.
5. If connected correctly, the popup status updates to:
   - `Background service worker responded successfully.`

## Test the summarizer logic

Run the fixture-based unit tests:

```bash
npm test
```

## Manual QA checklist

- [ ] Load the extension in Chrome via `chrome://extensions`.
- [ ] Open Gmail with unread messages in the inbox.
- [ ] Select one or more categories in the popup UI.
- [ ] Run summarization from the extension popup.
- [ ] Verify the summarized output text and Gmail thread links are correct.

## Known limitations

- Gmail DOM structure is volatile and can change without notice, which may break DOM selectors.
- Account switching (multiple Gmail accounts) can change URL/session context and impact extraction reliability.
- If an external summarization provider is enabled, API rate limits can throttle or block summary generation.

## Notes

- `src/content/gmail.js` is only injected on `https://mail.google.com/*`.
- `src/lib/` is reserved for shared logic used by the background worker, popup, and content scripts.
