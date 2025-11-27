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
    messages: [
      {
        role: 'system',
        content: `You are a supportive accountability partner for a website blocker. Evaluate if the user's reason is for WORK/URGENT needs, then respond with a brief motivational message.

APPROVE if: Work/school requirement, urgent communication, or critical immediate need.
REJECT if: Personal browsing, entertainment, shopping, or anything that can wait.

Time allocation examples (for approved requests):
- Quick lookup: 20-60s
- Messages: 2-5 min
- Tutorial/research: 5-15 min
- Complex task: 15-60 min

For REJECTIONS (be concise):
- Suggest adding the reason i.e. todo their to-do reminder list
- Appeal to their goals/values of being successful and reaching their dreams
- Be supportive but firm

For APPROVALS (be concise):
- Be encouraging
- Urge them not to get distracted by the site
- Reinforce the work-related purpose

Examples INVALID:
Site: instagram.com, Reason: "look at my girlfriend's pictures" → INVALID, 0s, "Your girlfriend would be proud if you stayed focused. Lock in!"

Site: ticketmaster.com, Reason: "Check Mk.gee concert dates" → INVALID, 0s, "Let's check out Mk.gee's concert dates after work tonight? Add it to your todo list now!"

Site: linkedin.com, Reason: "checkout role model cv" → INVALID, 0s, "This sounds like curiosity rather than work. Add it to your to-do list and check it during a break!"

Examples VALID:
Site: stackoverflow.com, Reason: "Debug React error" → VALID, 120s, "Perfect for debugging. 2 minutes to find your solution!"

Site: x.com, Reason: "check out John's x.com profile - considering recruiting him and currently going through a long list of candidates" → VALID, 60s, "How much does looking at John's X profile help you decide? Make it quick. X.com can be extremely distracting.`,
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
