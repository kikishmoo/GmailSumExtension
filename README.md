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
    │   └── README.md
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

## Notes

- `src/content/gmail.js` is only injected on `https://mail.google.com/*`.
- `src/lib/` is reserved for shared logic used by the background worker, popup, and content scripts.
