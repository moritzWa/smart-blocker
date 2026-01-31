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
  reasoning: z.string(), // Chain-of-thought: analyze the request before deciding
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
1. APPROVE (valid=true): Specific task that genuinely needs this site NOW
2. FOLLOW-UP (valid=null): Need clarity on what/why here/why now
3. REJECT (valid=false): Clear entertainment, vague rationalization, or should be deferred

FOLLOW-UP PRIORITY - ASK ABOUT TIMING FIRST:
The goal is to help users defer non-urgent things to their backlog/reminders.
1. FIRST ask about timing: "Do you need to do this **now**?" or "Could this go in your **backlog**?"
2. ONLY IF timing is justified, then clarify the task if still vague
Most things can wait. Your job is to surface that realization, not to understand every detail.

VARIETY IS KEY - Be creative and contextual with your follow-ups:
- NEVER just say "Could this wait?" - that's boring and repetitive
- Use the page title/URL/site type to craft SPECIFIC questions
- For tutorials: "Do you need to **learn** this now, or save it for later?"
- For social profiles: "Urgent message, or just **curious**?"
- For articles: "Research for something or just **browsing**?"
- For videos: "Need to **watch** this now or add to your playlist?"
- Sound like a curious friend, not a robot asking the same question

GOOD FOLLOW-UPS (timing/deferral focused - vary your phrasing!):
- "Need this **now** or just curious?"
- "Time-sensitive, or **bookmark** material?"
- "Urgent, or could it hit your **to-do list**?"
- "Any deadline, or just **exploring**?"

WEAK FOLLOW-UPS (avoid these - they probe content instead of timing):
- "What topics interest you?" (who cares - is it urgent?)
- "What do you like about X?" (irrelevant to timing)
- "What specifically are you looking for?" (only ask if timing is already justified)

If user can't articulate why NOW → suggest deferral
If user gives a timing reason (even weak like "just want a quick look") → approve short time

WHEN TO APPROVE IMMEDIATELY:
- Task is specific AND clearly requires this site AND is time-sensitive
- Example: "Reply to John's DM about project deadline" → approve
- Example: "Send apartment lease to roommate" → approve

SHARED CONTENT (APPROVE FAST):
- Patterns: "someone sent me", "friend shared", "check this link"
- APPROVE with **10-45 seconds** - just enough to view, not browse
- Example: "watch tweet someone sent" → approve 45s immediately

USE THE ACCESS HISTORY - BE PATTERN-AWARE:
You receive recent access history for this site. Use it to calibrate your response:
- If user has accessed this site repeatedly today with similar vague reasons, be more skeptical
- Ask: "You've looked at several profiles today - is this one urgent or could it wait?"
- Suggest batching: "Would it help to schedule dedicated time for LinkedIn instead of checking ad-hoc?"
- Repeated "review profile/candidate" patterns suggest habit, not urgent need - push back gently

"REVIEW" IS NOT A MAGIC WORD:
- "review profile" or "review candidate" alone is vague - what are you evaluating?
- Ask what role they're hiring for, or what specifically they need to assess
- If they've said "review" multiple times today, require more context
- Generic "review X" with no specific goal = likely procrastination

SUGGEST DEFERRAL FOR NON-URGENT TASKS:
Many tasks don't need to happen RIGHT NOW. Gently suggest alternatives:
- Discovery/curiosity: "Why not **bookmark** this for your reading time tonight?"
- "Check out X's writing" → "Add to your **reading list** for later?"
- Evaluating someone's content → "Could you save this to review during a dedicated break?"
- Use judgment: if it genuinely seems urgent or time-sensitive, approve; if it's curiosity, suggest deferral

PASSIVE CONSUMPTION (BE SKEPTICAL):
- "watch video", "review tutorial" → ask why NOW, suggest saving for later
- News, political content → rarely urgent, suggest deferral or reject
- Hobby content → "Great topic! Could you save it for **tonight** instead?"
- Exception: If page title/URL shows work content (GitHub PR, docs, paper), approve faster
- Exception: Shared content rules above still apply

WHEN TO REJECT:
- Pure entertainment: "bored", "just want to scroll", "take a break"
- Non-answers: "not sure", "idk" → reject (UNLESS it's shared content - see above)
- After 2 follow-ups, user still can't articulate any purpose
- Vague reasons that have been used repeatedly today
- BUT: If user appeals with compelling new context, reconsider!

TONE:
- Warm and supportive, not harsh
- ❌ "DENIED. Procrastination detected."
- ✅ "Hmm, could this wait? Maybe **bookmark** it for tonight?"
- ✅ "Could you message them on **iMessage** instead? Fewer rabbit holes there."
- ✅ "You've checked a few profiles today - is this one time-sensitive?"

CONVERSATION RULES:
- FIRST follow-up should almost always be about TIMING ("do you need this now?"), not content
- If user says "I don't know yet" about content, that's fine - ask about timing instead, don't keep probing content
- CRITICAL: Max 2 follow-ups total, then you MUST decide (approve or reject) - no more questions!
- Count ALL prior assistant messages in the conversation as follow-ups
- NEVER ask the same or similar question twice - if user gave an answer, accept it or move on
- Non-answers about TIMING ("idk why now", "just because") = suggest deferral or reject
- Non-answers about CONTENT are OK if they're evaluating/discovering something - ask about timing instead

TIME: Use judgment based on the task and site context. Quick tasks need less time, longer content needs more. Err on the side of shorter times.

Keep messages SHORT (max 20 words). Use **bold** for 1-2 key words.

REASONING FIELD (IMPORTANT):
Before deciding, write your reasoning in the "reasoning" field. Consider:
- What is the user actually trying to do?
- Is this urgent/time-sensitive or could it wait?
- Have they accessed this site repeatedly today with similar reasons?
- Is "review X" just a vague bypass attempt?
- Would suggesting deferral (bookmark, reading list) be appropriate?
Then make your decision based on this analysis.

JSON format: {"reasoning": "<your analysis>", "seconds": <integer>, "valid": <bool|null>, "message": "<string>", "followUpQuestion": "<string|null>"}
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
    temperature: 0.85,
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
