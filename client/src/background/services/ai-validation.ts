export interface AIResponse {
  valid: boolean;
  seconds: number;
  message: string;
}

const VALIDATION_SERVICE_URL =
  'https://smart-blocker.moritzwa.deno.net/validate';
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 5; // Increased for serverless cold starts

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function validateUnblockReason(
  hostname: string,
  reason: string
): Promise<AIResponse | { error: string }> {
  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `🤖 AI validation attempt ${attempt}/${MAX_RETRIES} for ${hostname}`
      );

      const response = await fetchWithTimeout(
        VALIDATION_SERVICE_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostname, reason }),
        },
        REQUEST_TIMEOUT
      );

      console.log(
        `📡 Response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`❌ Server error (${response.status}):`, errorText);
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log(`✅ AI validation successful:`, data);
      return data;
    } catch (error) {
      lastError = error as Error;

      // Log detailed error info
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(
            `⏱️ Request timeout (attempt ${attempt}/${MAX_RETRIES})`
          );
        } else if (error.message.includes('Failed to fetch')) {
          console.error(
            `🌐 Network error - likely serverless cold start (attempt ${attempt}/${MAX_RETRIES}):`,
            error.message
          );
        } else {
          console.error(
            `❌ Validation error (attempt ${attempt}/${MAX_RETRIES}):`,
            error.message
          );
        }
      }

      // Don't retry on last attempt
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s → 2s → 4s → 8s
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms... (exponential backoff)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error(
    `💥 All ${MAX_RETRIES} attempts failed. Last error:`,
    lastError
  );

  // Provide detailed error messages
  let errorMessage = 'Failed to connect to validation service.';
  if (lastError?.name === 'AbortError') {
    errorMessage =
      'Request timed out after multiple attempts. Please try again.';
  } else if (lastError?.message.includes('Failed to fetch')) {
    errorMessage =
      'Network error - server may be starting up. Please try again in a moment.';
  }

  return { error: errorMessage };
}
