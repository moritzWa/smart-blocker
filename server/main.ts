import "jsr:@std/dotenv/load";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// Zod schema for structured output
const UnblockResponseSchema = z.object({
  minutes: z.number().int().min(1).max(60),
  valid: z.boolean(),
  reasoning: z.string(),
});

type UnblockResponse = z.infer<typeof UnblockResponseSchema>;

async function validateUnblockReason(
  reason: string,
  hostname: string,
): Promise<UnblockResponse> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content: `You are a bouncer for a website blocker app. Users must justify why they need to access blocked sites.

Your job:
1. Evaluate if their reason is legitimate and productive (e.g., work, marketplace, specific tasks)
2. Reject entertainment, procrastination, or vague reasons
3. Estimate realistic time needed (1-60 minutes)
4. Provide clear, conversational reasoning

Examples:
- "Check Facebook Marketplace for my listing replies" → VALID, 5 min
- "Need to watch a YouTube tutorial on React hooks" → VALID, 15 min
- "Just want to scroll TikTok" → INVALID
- "Bored" → INVALID`,
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
