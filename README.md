# Smart Blocker

Chrome extension to block distracting websites with temporary unblock functionality.

## Project Structure

```
smart-blocker/
├── client/         # Chrome extension
├── server/         # Backend API (TBD - AI bouncer)
└── dist/          # Built extension (load in Chrome)
```

## Quick Start

### Build Extension

```bash
npm install
npm run build
```

Built extension will be in `dist/` folder.

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

### Development

```bash
npm run dev    # Watch mode
npm run build  # Production build
```

## Features

### Current
- Block distracting sites with allowlist/blocklist
- Temporary unblock with timer (default: 5 minutes)
- React + Tailwind UI with Shadow DOM
- Settings page for managing sites

### Planned
- **AI Bouncer**: Server-side validation of unblock reasons using OpenAI API
- Analytics and usage tracking
- Scheduled blocking (time-based rules)

## Configuration

Settings available at: `chrome-extension://<id>/src/options/options.html`

**Always Allowed Sites** (prefix with `+`):
```
+remnote.com
+claude.ai
+calendar.google.com
```

**Blocked Sites**:
```
https://www.youtube.com/
https://www.tiktok.com/
https://www.facebook.com/
```

## Tech Stack

**Client:**
- TypeScript + React 19
- Tailwind CSS v4
- Vite + Chrome Extension Manifest v3

**Server:** TBD (Node.js/Bun + OpenAI API)
