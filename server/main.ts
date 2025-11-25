import "@std/dotenv/load";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// Zod schema for structured output
const UnblockResponseSchema = z.object({
  seconds: z.number().int().min(10).max(3600), // 10 seconds to 60 minutes
  valid: z.boolean(),
  reasoning: z.string(),
});

type UnblockResponse = z.infer<typeof UnblockResponseSchema>;

async function validateUnblockReason(
  reason: string,
  hostname: string,
): Promise<UnblockResponse> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a bouncer for a website blocker app. Users must justify why they need to access blocked sites.

Your job:
1. Evaluate if their reason is legitimate and productive (e.g., work, marketplace, specific tasks)
2. Reject entertainment, procrastination, or vague reasons
3. Estimate realistic time needed in SECONDS (10-3600 seconds, be precise!)
4. Keep reasoning EXTREMELY brief (max 8 words, conversational tone)

Time guidelines:
- Quick checks (weather, single message, lookup): 20-60 seconds
- Marketplace/messages: 2-5 minutes (120-300 seconds)
- Short tutorial/specific task: 5-15 minutes (300-900 seconds)
- Complex tutorial/deep work: 15-60 minutes (900-3600 seconds)

Examples:
- "Check the weather" → VALID, 20 seconds, "Quick lookup"
- "Check Facebook Marketplace for replies" → VALID, 180 seconds, "Marketplace check"
- "Watch YouTube tutorial on React hooks" → VALID, 900 seconds, "Educational"
- "Just want to scroll TikTok" → INVALID, "Pure entertainment"
- "Bored" → INVALID, "Not valid"`,
      },
      {
        role: "user",
        content: `Site: ${hostname}\nReason: ${reason}`,
      },
    ],
    response_format: zodResponseFormat(UnblockResponseSchema, "unblock_response"),
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    throw new Error("No response from OpenAI");
  }

  return JSON.parse(response);
}

Deno.serve({ port: 8000 }, async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method === "POST" && new URL(req.url).pathname === "/validate") {
    try {
      const { reason, hostname } = await req.json();

      if (!reason || !hostname) {
        return new Response(
          JSON.stringify({ error: "Missing reason or hostname" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      const result = await validateUnblockReason(reason, hostname);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("Error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
  }

  return new Response("Not Found", { status: 404 });
});

console.log("🚀 Server running on http://localhost:8000");
