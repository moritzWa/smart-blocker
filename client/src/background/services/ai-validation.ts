export interface AIResponse {
  valid: boolean;
  minutes: number;
  reasoning: string;
}

export async function validateUnblockReason(
  hostname: string,
  reason: string
): Promise<AIResponse | { error: string }> {
  try {
    const response = await fetch('http://localhost:8000/validate', {
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
