# Focus Shield - Chrome Extension

The extension half of [Focus Shield](../README.md). See the root README for what it does and how to install it.

## Development

```bash
npm install
npm run dev     # watch mode, points the bouncer at http://localhost:8000
npm run build   # production build, points at the deployed server
```

## Build output

Everything goes to `../dist/` (the repo root, not `client/dist`). Load that folder in Chrome via `chrome://extensions` -> Developer mode -> Load unpacked.

## Project structure

```
client/
├── src/
│   ├── background/       # service worker: blocking, storage, alarms, badge
│   │   ├── utils/blocking.ts     # hostname matching + the block decision
│   │   └── services/             # storage helpers, bouncer API client
│   ├── blocked/          # the block page (reason form, AI conversation)
│   ├── options/          # settings, access history, to-do reminders
│   ├── onboarding/       # first-install walkthrough
│   ├── components/ui/    # shadcn components
│   └── index.css         # Tailwind v4
├── public/               # icons, onboarding screenshots
├── manifest.json
└── vite.config.ts
```

## Key implementation details

- **Manifest V3.** A service worker, not a background page. It is torn down when idle, so anything that must survive belongs in `chrome.storage`, not a module-level variable.
- **No content scripts.** Blocking happens by intercepting tab navigation in the worker and redirecting to an extension page, so nothing is injected into the sites you visit.
- **React 19 + Tailwind v4**, one Vite entry per surface (blocked, options, onboarding).
