# Smart Blocker - Chrome Extension

React + TypeScript Chrome extension for blocking distracting websites.

## Development

```bash
npm install
npm run dev     # Watch mode with hot reload
npm run build   # Production build
```

## Build Output

Built files go to `../dist/` (one level up from client folder).

Load `../dist/` in Chrome to test the extension.

## Project Structure

```
client/
├── src/
│   ├── background/        # Service worker (blocking logic)
│   ├── content/          # Content script (overlay UI)
│   ├── options/          # Settings page
│   └── index.css         # Tailwind CSS
├── public/               # Static assets
├── manifest.json         # Extension manifest
└── vite.config.ts        # Build config
```

## Key Implementation Details

- **Shadow DOM**: Content script uses Shadow DOM for CSS isolation
- **Manifest V3**: Uses service worker instead of background page
- **Tailwind v4**: CSS injected inline into Shadow DOM
- **React 19**: Latest React with new JSX transform
