export interface AIResponse {
  valid: boolean;
  seconds: number;
  message: string;
}

const VALIDATION_SERVICE_URL =
  'https://smart-blocker.moritzwa.deno.net/validate';

export async function validateUnblockReason(
  hostname: string,
  reason: string
): Promise<AIResponse | { error: string }> {
  try {
    const response = await fetch(VALIDATION_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname, reason }),
    });

    if (!response.ok) {
      throw new Error('Failed to validate reason');
    }

    return await response.json();
  } catch (error) {
    console.error('AI validation error:', error);
    return { error: 'Failed to connect to validation service' };
  }
}
