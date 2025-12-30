import type { ReactNode } from 'react';

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

// Simple markdown parser for **bold** text and newlines
export function parseMarkdown(text: string): ReactNode {
  const lines = text.split(/\n/);
  return lines.map((line, lineIndex) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const parsedLine = parts.map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIndex} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    return (
      <span key={lineIndex}>
        {parsedLine}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
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
