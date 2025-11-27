import '@std/dotenv/load';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Zod schema for structured output
const UnblockResponseSchema = z.object({
  seconds: z.number().int().min(10).max(3600), // 10 seconds to 60 minutes
  valid: z.boolean(),
  message: z.string(),
});

type UnblockResponse = z.infer<typeof UnblockResponseSchema>;

async function validateUnblockReason(
  reason: string,
  hostname: string
): Promise<UnblockResponse> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 1.5,
    messages: [
      {
        role: 'system',
        content: `You are a witty accountability partner for a website blocker. Evaluate if the user's reason is for WORK/URGENT needs, then respond with a punchy message (MAX 16 WORDS).

Use **bold** for key words (max 4 words bolded per message).

APPROVE if: Work/school requirement, urgent communication, or critical immediate need.
REJECT if: Personal browsing, entertainment, shopping, or anything that can wait.

Time allocation (for approved):
- Quick lookup: 20-60s
- Messages: 2-5 min
- Tutorial/research: 5-15 min
- Complex task: 15-60 min

For REJECTIONS (MAX 16 WORDS):
- Use future-you framing: "**Future-you** earning $500k won't thank you for this"
- Appeal to specific ambitions: success, wealth, dreams
- Suggest adding to to-do list
- Be supportive but firm and witty
- Mention what they should aviod (see specific reasons they provide)

For APPROVALS (MAX 16 WORDS):
- Be encouraging but warn against distraction
- Keep it punchy

Examples INVALID:
Site: instagram.com, Reason: "look at my girlfriend's IG pictures" → INVALID, 0s, "**Future-you** won't thank you. Add to **to-do**, check later!"

Site: ticketmaster.com, Reason: "Check Mk.gee concert dates" → INVALID, 0s, "**Millionaires** don't buy concert tickets at 2pm. **To-do** it!"

Site: linkedin.com, Reason: "checkout role model cv" → INVALID, 0s, "**Curiosity** ≠ work. Save for break, your future self agrees."

Examples VALID:
Site: stackoverflow.com, Reason: "Debug React error" → VALID, 120s, "**2 minutes**. Get your answer, don't scroll discussions!"

Site: x.com, Reason: "check John's profile - recruiting decision" → VALID, 60s, "Quick profile check. X is a **rabbit hole**, stay sharp!"`,
      },
      {
        role: 'user',
        content: `Site: ${hostname}\nReason: ${reason}`,
      },
    ],
    response_format: zodResponseFormat(
      UnblockResponseSchema,
      'unblock_response'
    ),
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(response);
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
      const { reason, hostname } = await req.json();

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

      const result = await validateUnblockReason(reason, hostname);

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
