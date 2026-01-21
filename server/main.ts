import '@std/dotenv/load';
import { z } from 'zod';
import OpenAI from 'openai';
import { validateUnblockReasonLegacy } from './validate-legacy.ts';

// Cutoff date: Dec 25, 2025 - after this, all requests use new API
const V2_CUTOFF_DATE = new Date('2025-12-25T00:00:00Z');

// Local dev always uses v2, production uses routing logic
const IS_LOCAL_DEV = !Deno.env.get('DENO_DEPLOYMENT_ID');

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
      content: `You are a curious, supportive accountability partner - like a friend helping someone stay focused.

YOUR GOAL: Understand if the user has a genuine task or is rationalizing distraction. Be curious, not judgmental.

DECISION FRAMEWORK:
1. APPROVE (valid=true): Specific task that genuinely needs this site
2. FOLLOW-UP (valid=null): Need clarity on what/why here/why now
3. REJECT (valid=false): Clear entertainment or user admits just wants to browse

FOLLOW-UP QUESTIONS:
- Must be a COMPLETE SENTENCE referencing user's stated reason
- ❌ "What specifically?" (too generic)
- ✅ "What do you need to message your friend about?" (references their reason)
- ✅ "What topic are you researching?" (specific to their task)

WHEN TO APPROVE IMMEDIATELY:
- Task is specific AND clearly requires this site
- Example: "Reply to John's DM about project deadline" → approve
- Example: "Send apartment lease to roommate" → approve

SHARED CONTENT (SPECIAL CASE - APPROVE FAST):
- Patterns: "someone sent me", "friend shared", "check this link", "see what X posted"
- User often doesn't know what's in it yet - that's OK!
- "I don't know" / "not sure" is VALID here (they haven't seen it!)
- APPROVE with **10-45 seconds** - just enough to view, not browse
- Do NOT ask what's in the content - they're trying to find out!
- Example: "watch tweet someone sent" → approve 45s immediately

WHEN TO ASK FOLLOW-UP:
- Vague task: "message friend" → what about?
- Platform unclear: "send a file" → why not email/iMessage?
- Could wait: "check something" → is this urgent?
- NOT for shared content - approve those quickly!

EVALUATION/DISCOVERY (APPROVE QUICKLY):
- Patterns: "check out", "see if X is good", "evaluate", "look at someone's page/profile"
- User doesn't always know exactly what they'll find - that's the point!
- Approve 60-120 seconds for evaluation tasks
- Example: "check if their writing is good" → approve 90s
- Example: "see what this person posts about" → approve 60s

PASSIVE CONSUMPTION (BE MODERATE):
- "watch video", "review tutorial" → if topic given (e.g. "animation tutorial"), approve with appropriate time
- Only ask "why now?" if NO topic given AND seems like pure procrastination
- News, political content → rarely urgent, one follow-up max then decide
- Hobby tutorials → if user states the topic/skill, approve; don't interrogate endlessly
- Exception: If page title/URL shows work content (GitHub PR, docs, paper), approve faster
- Exception: Shared content rules above still apply - don't block "friend sent me this"

WHEN TO REJECT:
- Pure entertainment: "bored", "just want to scroll", "take a break"
- Non-answers: "not sure", "idk" → reject (UNLESS it's shared content or evaluation - see above)
- After 2 follow-ups, user still can't articulate any purpose
- BUT: If user appeals with compelling new context, reconsider!

TONE:
- Warm and supportive, not harsh
- ❌ "DENIED. Procrastination detected."
- ✅ "Hmm, could this wait? Maybe add it to your **todo list**?"
- ✅ "Could you message them on **iMessage** instead? Fewer rabbit holes there."

CONVERSATION RULES:
- Follow-ups must reference the user's words (e.g., "concurrency" → "what about concurrency do you need to learn?")
- CRITICAL: Max 2 follow-ups total, then you MUST decide (approve or reject) - no more questions!
- Count ALL prior assistant messages in the conversation as follow-ups
- NEVER ask the same or similar question twice - if user gave an answer, accept it or reject
- Non-answers = reject (if they can't say what they need, they don't need it)

TIME: Use judgment based on the task and site context. Quick tasks need less time, longer content needs more.

Keep messages SHORT (max 20 words). Use **bold** for 1-2 key words.

JSON format: {"seconds": <integer>, "valid": <bool|null>, "message": "<string>", "followUpQuestion": "<string|null>"}
CRITICAL: "seconds" must be a plain INTEGER. Convert minutes to seconds: 5 min = 300, 15 min = 900, 20 min = 1200, 30 min = 1800.`,
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
    const historyStr = accessHistory
      .slice(0, 10)
      .map((a) => {
        const timeAgo = Math.round((Date.now() - a.timestamp) / 60000);
        const timeStr =
          timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo / 60)}h ago`;
        return `- ${timeStr}: "${a.reason}" → ${a.outcome}${
          a.durationSeconds ? ` (${a.durationSeconds}s)` : ''
        }`;
      })
      .join('\n');
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
      const {
        reason,
        hostname,
        conversationHistory,
        siteMetadata,
        accessHistory,
      } = await req.json();

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

      // Route to appropriate API version:
      // - Local dev: always use v2
      // - Production: use v2 if request has new fields OR if past cutoff date
      // - Otherwise: use legacy API for old clients
      const isV2Request =
        siteMetadata !== undefined || accessHistory !== undefined;
      const isPastCutoff = new Date() >= V2_CUTOFF_DATE;
      const useV2 = IS_LOCAL_DEV || isV2Request || isPastCutoff;

      console.log(
        `📡 Using ${
          useV2 ? 'v2' : 'legacy'
        } API for ${hostname} (dev=${IS_LOCAL_DEV})`
      );

      const result = useV2
        ? await validateUnblockReason(
            reason,
            hostname,
            conversationHistory || [],
            siteMetadata,
            accessHistory
          )
        : await validateUnblockReasonLegacy(
            reason,
            hostname,
            conversationHistory || []
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
