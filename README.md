# Smart Blocker

Chrome extension to block distracting websites with temporary unblock functionality.

## Project Structure

```
smart-blocker/
├── client/         # Chrome extension
├── server/         # Backend API (AI bouncer)
└── dist/          # Built extension (load in Chrome)
```

## Quick Start

### 1. Build Extension

```bash
cd client
npm install
npm run build
```

Built extension will be in `dist/` folder.

### 2. Start AI Validation Server

```bash
cd server
cp .env.example .env  # Add your OPENAI_API_KEY
deno install         # Cache dependencies
deno run --allow-net --allow-read --allow-env main.ts
```

Server runs on `http://localhost:8000`

### 3. Load in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `client/dist` folder

### Development

**Client:**
```bash
cd client
npm run dev    # Watch mode
npm run build  # Production build
```

**Server:**
```bash
cd server
deno run --allow-net --allow-read --allow-env main.ts
```

## Features

### Current

- **AI Bouncer**: Uses GPT-4o-mini to validate unblock reasons (e.g., "Check Facebook Marketplace" vs "just bored")
- **Block distracting sites** with allowlist/blocklist
- **Allow-Only Mode**: Block everything except allowed sites
- **Temporary unblock** with AI-determined duration (1-60 minutes)
- **Todo Reminders**: Save blocked sites to check later
- **Dark mode support** (system preference)
- **Instant blocking** at tab navigation level
- Settings page with live unblock countdown

### Planned

- Analytics and usage tracking
- Scheduled blocking (time-based rules)
- Custom AI prompts for different sites

## Configuration

Settings available at: `chrome-extension://<id>/src/options/options.html`

**Always Allowed Sites**:

```
remnote.com
claude.ai
calendar.google.com
```

**Blocked Sites**:

```
https://www.youtube.com/
https://www.tiktok.com/
https://www.facebook.com/
```

**Allow-Only Mode**: Toggle to block all sites except those in the allowed list.

## Tech Stack

**Client:**

- TypeScript + React 19
- Tailwind CSS v4
- Vite + Chrome Extension Manifest v3
- Service worker for instant blocking

**Server:**

- Deno runtime
- OpenAI API (GPT-4o-mini)
- Zod for structured outputs
- CORS-enabled REST API
