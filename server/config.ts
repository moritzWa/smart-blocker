// Groq model used for validation.
// llama-3.3-70b-versatile was decommissioned by Groq (Aug 2026) which 500'd
// every /validate call. Override with GROQ_MODEL without a code change.
export const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
