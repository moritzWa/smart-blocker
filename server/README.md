# Focus Shield - Bouncer API

The AI bouncer that decides whether a blocked site gets unblocked, and for how long.

## Tech stack

- **Deno** - TypeScript runtime, deployed on Deno Deploy
- **Groq** - `openai/gpt-oss-120b` via the OpenAI-compatible API
- **Zod** - validates the model's JSON before it reaches the extension

## Setup

```bash
echo 'GROQ_API_KEY="your-key"' > .env   # get one at console.groq.com
deno task dev                            # http://localhost:8000
```

| Env var | Default | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | required | Groq credentials |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Override the model without a code change |

Groq retires models periodically, and it presents as every request failing at once. If `/validate` starts returning 500s, check the `detail` field in the response body first: a `model_not_found` there means set `GROQ_MODEL` to a current model.

## API

### GET /health

Returns `{ "ok": true, "model": "openai/gpt-oss-120b" }`. Use it to confirm which model is live without sending a validation request.

### POST /validate

**Request** (only `reason` and `hostname` are required):

```json
{
  "hostname": "youtube.com",
  "reason": "Need to watch a React tutorial for work",
  "conversationHistory": [{ "role": "user", "content": "..." }],
  "siteMetadata": { "title": "...", "description": "..." },
  "accessHistory": [{ "domain": "youtube.com", "reason": "...", "timestamp": 0, "outcome": "approved" }]
}
```

**Response:**

```json
{
  "reasoning": "Specific work task that needs this site now.",
  "seconds": 900,
  "valid": true,
  "message": "Go ahead, watch that tutorial.",
  "followUpQuestion": null
}
```

- `valid` is `true` (approve), `false` (reject), or `null` (the bouncer wants a follow-up first, in `followUpQuestion`)
- `seconds` is 0 to 3600. It is 0 for rejections and follow-ups, and floored at 300 for approvals
- `reasoning` is the model's chain of thought, shown nowhere in the UI but useful when tuning the prompt

Errors return `{ error, detail, model }` with status 500, where `detail` is the upstream message.
