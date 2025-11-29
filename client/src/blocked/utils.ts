// Helper to check if count is power of 2
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

// Check if review should be shown based on count and threshold
export function shouldShowReview(
  count: number,
  baseThreshold: number
): boolean {
  if (count < baseThreshold) return false;
  return isPowerOfTwo(count);
}

// Helper to format seconds into human-readable time
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
