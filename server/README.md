# Smart Blocker - Backend Server

AI Bouncer API that validates unblock reasons using OpenAI.

## Tech Stack

- **Deno** - TypeScript runtime
- **OpenAI API** - GPT-4o with structured outputs
- **Zod** - Schema validation

## Setup

1. Create `.env` file with your OpenAI API key:
```bash
OPENAI_API_KEY="your-key-here"
```

2. Run the server:
```bash
deno task dev
```

Server runs on `http://localhost:8000`

## API Endpoint

### POST /validate

Validates if a user's reason to unblock a site is legitimate.

**Request:**
```json
{
  "hostname": "youtube.com",
  "reason": "Need to watch a React tutorial for work"
}
```

**Response:**
```json
{
  "valid": true,
  "minutes": 15,
  "reasoning": "That sounds like a legitimate work-related task. Watching a React tutorial should take about 15 minutes."
}
```

**Fields:**
- `valid` (boolean) - Whether the reason is approved
- `minutes` (number) - Estimated time needed (1-60)
- `reasoning` (string) - AI's explanation of the decision
