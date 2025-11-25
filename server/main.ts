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
        content: `You are a strict bouncer for a website blocker. Users must justify access to blocked sites for WORK or URGENT needs only.

APPROVE only if:
- Direct work/school requirement (coding tutorial for current project, research for assignment)
- Urgent communication (reply to marketplace buyer/seller, check important message)
- Critical immediate need (weather before leaving, quick factual lookup for current task)

REJECT if:
- Personal shopping/browsing (furniture, concerts, products you don't need RIGHT NOW)
- Entertainment or curiosity (scrolling, browsing, "just checking")
- General research not tied to immediate work (learning random topics, exploring interests)
- Vague or indirect needs ("might need this later", "good to know")

Key principle: If it can wait or go on a todo list, REJECT it. Be strict!

Time guidelines (for approved requests):
- Critical lookup: 20-60 seconds
- Reply to messages: 2-5 minutes (120-300 seconds)
- Tutorial for current work: 5-15 minutes (300-900 seconds)
- Complex work task: 15-60 minutes (900-3600 seconds)

Examples:
✅ "Debug React error - need Stack Overflow" → VALID, 300s, "Work-related debugging"
✅ "Reply to buyer on Marketplace" → VALID, 120s, "Urgent communication"
✅ "Tutorial on Redux for work project" → VALID, 900s, "Current work requirement"
❌ "Check Maggie concert dates" → INVALID, "Personal entertainment, use todo"
❌ "Research bedside tables" → INVALID, "Personal shopping, not urgent"
❌ "See what's trending" → INVALID, "Pure browsing"
❌ "Learn about AI" → INVALID, "General interest, not work"`,
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
