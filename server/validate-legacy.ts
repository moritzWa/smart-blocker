import { z } from 'zod';
import OpenAI from 'openai';

const groq = new OpenAI({
  apiKey: Deno.env.get('GROQ_API_KEY'),
  baseURL: 'https://api.groq.com/openai/v1',
});

// Zod schema for structured output
const UnblockResponseSchema = z.object({
  seconds: z.number().int().min(0).max(3600),
  valid: z.boolean().nullable(),
  message: z.string(),
  followUpQuestion: z.string().nullable().optional(),
});

type UnblockResponse = z.infer<typeof UnblockResponseSchema>;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function validateUnblockReasonLegacy(
  reason: string,
  hostname: string,
  conversationHistory: Message[] = []
): Promise<UnblockResponse> {
  const userMessages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> = [
    {
      role: 'system',
      content: `You are a witty accountability partner for a website blocker.

ACTIONS:
1. APPROVE (valid=true): Clear work/learning purpose
2. REJECT (valid=false): Entertainment, personal browsing
3. FOLLOW-UP (valid=null): Vague or suspicious reasons - ask ONE short question

ASK FOLLOW-UP WHEN:
- Vague: "message friend", "check something", "browse"
- Site mismatch: YouTube for "message someone" (YouTube isn't messaging)
- Suspicious excuse that could be a lie

APPROVE WITHOUT FOLLOW-UP:
- Clear learning: "react tutorial", "debug error", "watch lecture"
- Specific work: "check PR comments", "reply to client"

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

  // Add current message
  userMessages.push({
    role: 'user',
    content: `Site: ${hostname}\nReason: ${reason}`,
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
