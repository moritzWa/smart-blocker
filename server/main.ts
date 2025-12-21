import '@std/dotenv/load';
import { z } from 'zod';
import OpenAI from 'openai';

const groq = new OpenAI({
  apiKey: Deno.env.get('GROQ_API_KEY'),
  baseURL: 'https://api.groq.com/openai/v1',
});

// Zod schema for structured output
const UnblockResponseSchema = z.object({
  seconds: z.number().int().min(0).max(3600), // 0 for reject/follow-up, up to 60 minutes
  valid: z.boolean().nullable(), // null = need follow-up
  message: z.string(),
  followUpQuestion: z.string().nullable().optional(), // question to ask user if valid is null
});

type UnblockResponse = z.infer<typeof UnblockResponseSchema>;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SiteMetadata {
  title: string;
  description: string;
}

interface AccessAttempt {
  domain: string;
  reason: string;
  timestamp: number;
  outcome: 'approved' | 'rejected' | 'follow_up';
  durationSeconds?: number;
}

async function validateUnblockReason(
  reason: string,
  hostname: string,
  conversationHistory: Message[] = [],
  siteMetadata?: SiteMetadata | null,
  accessHistory?: AccessAttempt[]
): Promise<UnblockResponse> {
  const userMessages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> = [
    {
      role: 'system',
      content: `You are a witty accountability partner for a website blocker.

ACTIONS:
1. APPROVE (valid=true): Practical/work purpose - even small tasks count
2. REJECT (valid=false): Pure entertainment, mindless browsing, "just bored"
3. FOLLOW-UP (valid=null): Need more specifics to decide

JUDGMENT GUIDELINES:
- "Urgent" is NOT required. Practical tasks like "request a document", "coordinate plans", "send a file" are valid
- Ask follow-up to get specifics, not to interrogate
- If user gives a concrete task (even small), approve it
- Only reject clear entertainment/procrastination

BE SKEPTICAL of:
- Vague: "message friend", "check something", "tutorial" → ask what specifically
- Site mismatch: reason doesn't fit the site
- Repeated requests with same vague reason

Time: Quick=30-60s, Messages=2-5min, Tutorial=10-15min, Complex=30-60min

Keep messages SHORT (max 16 words). Use **bold** for 1-2 key words.

Examples:
Site: youtube.com, Reason: "react tutorial" → valid=true, seconds=900, message="**15 min**. Stay focused on the tutorial!"
Site: instagram.com, Reason: "message friend" → valid=null, followUpQuestion="What do you need to message them about?"
Site: youtube.com, Reason: "bored" → valid=false, message="Boredom isn't urgent. **Future-you** will thank you!"

JSON format: {seconds, valid, message, followUpQuestion}`,
    },
  ];

  // Add conversation history
  for (const msg of conversationHistory) {
    userMessages.push({ role: msg.role, content: msg.content });
  }

  // Add current message with metadata and history if available
  let userContent = `Site: ${hostname}\nReason: ${reason}`;
  if (siteMetadata) {
    userContent += `\nPage Title: ${siteMetadata.title}`;
    if (siteMetadata.description) {
      userContent += `\nPage Description: ${siteMetadata.description}`;
    }
  }
  if (accessHistory && accessHistory.length > 0) {
    const historyStr = accessHistory.slice(0, 10).map(a => {
      const timeAgo = Math.round((Date.now() - a.timestamp) / 60000);
      const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo / 60)}h ago`;
      return `- ${timeStr}: "${a.reason}" → ${a.outcome}${a.durationSeconds ? ` (${a.durationSeconds}s)` : ''}`;
    }).join('\n');
    userContent += `\n\nRecent history for this site (last 24h):\n${historyStr}`;
  }
  userMessages.push({
    role: 'user',
    content: userContent,
  });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    messages: userMessages,
    response_format: { type: 'json_object' },
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    throw new Error('No response from Groq');
  }

  const parsed = JSON.parse(response);
  return UnblockResponseSchema.parse(parsed);
}

Deno.serve({ port: 8000 }, async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method === 'POST' && new URL(req.url).pathname === '/validate') {
    try {
      const { reason, hostname, conversationHistory, siteMetadata, accessHistory } =
        await req.json();

      if (!reason || !hostname) {
        return new Response(
          JSON.stringify({ error: 'Missing reason or hostname' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      const result = await validateUnblockReason(
        reason,
        hostname,
        conversationHistory || [],
        siteMetadata,
        accessHistory
      );

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  return new Response('Not Found', { status: 404 });
});

console.log('🚀 Server running on http://localhost:8000');
