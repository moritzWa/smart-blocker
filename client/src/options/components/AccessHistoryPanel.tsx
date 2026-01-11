import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AccessAttempt } from '../types';
import { parseMarkdown } from '@/blocked/utils';

interface AccessHistoryPanelProps {
  accessHistory: AccessAttempt[];
  fillHeight?: boolean;
}

// Get favicon URL from Google's service
function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

// Get colors based on outcome type
function getOutcomeColors(outcome: AccessAttempt['outcome']): {
  bg: string;
  text: string;
  subtext: string;
} {
  switch (outcome) {
    case 'approved':
      // Red - time spent on distraction
      return {
        bg: 'bg-red-100 dark:bg-red-950/50',
        text: 'text-red-900 dark:text-red-200',
        subtext: 'text-red-700 dark:text-red-300',
      };
    case 'rejected':
      // Green - AI stopped you
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-950/50',
        text: 'text-emerald-900 dark:text-emerald-200',
        subtext: 'text-emerald-700 dark:text-emerald-300',
      };
    case 'blocked':
      // Green - you stopped yourself (best outcome!)
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-950/50',
        text: 'text-emerald-900 dark:text-emerald-200',
        subtext: 'text-emerald-700 dark:text-emerald-300',
      };
    case 'reminder':
      // Blue - saved for later
      return {
        bg: 'bg-blue-100 dark:bg-blue-950/50',
        text: 'text-blue-900 dark:text-blue-200',
        subtext: 'text-blue-700 dark:text-blue-300',
      };
    case 'abandoned':
      // Amber - started but gave up
      return {
        bg: 'bg-amber-100 dark:bg-amber-950/50',
        text: 'text-amber-900 dark:text-amber-200',
        subtext: 'text-amber-700 dark:text-amber-300',
      };
    default:
      return {
        bg: 'bg-muted/50',
        text: 'text-foreground',
        subtext: 'text-muted-foreground',
      };
  }
}

// Group access history by day
function groupHistoryByDay(
  history: AccessAttempt[]
): Map<string, AccessAttempt[]> {
  const groups = new Map<string, AccessAttempt[]>();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  for (const attempt of history) {
    const date = new Date(attempt.timestamp);
    const dateStr = date.toDateString();

    let label: string;
    if (dateStr === today) {
      label = 'Today';
    } else if (dateStr === yesterdayStr) {
      label = 'Yesterday';
    } else {
      label = date.toLocaleDateString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }

    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(attempt);
  }
  return groups;
}

function formatHistoryTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatOutcome(outcome: AccessAttempt['outcome']): string {
  switch (outcome) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'blocked':
      return 'Blocked (no interaction)';
    case 'reminder':
      return 'Saved as reminder';
    case 'abandoned':
      return 'Abandoned';
    default:
      return outcome;
  }
}

function formatHistoryForClipboard(history: AccessAttempt[]): string {
  return history
    .map((attempt) => {
      const date = new Date(attempt.timestamp);
      const dateStr = date.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      let text = `## ${attempt.domain}\n`;
      text += `**Date:** ${dateStr}\n`;
      text += `**User:** ${attempt.reason}\n`;
      if (attempt.aiMessage) {
        text += `**AI:** ${attempt.aiMessage}\n`;
      }
      text += `**Outcome:** ${formatOutcome(attempt.outcome)}`;
      if (attempt.outcome === 'approved' && attempt.durationSeconds) {
        const mins = Math.round(attempt.durationSeconds / 60);
        text += ` (${mins} min)`;
      }
      return text;
    })
    .join('\n\n---\n\n');
}

export default function AccessHistoryPanel({
  accessHistory,
  fillHeight = false,
}: AccessHistoryPanelProps) {
  const groupedHistory = groupHistoryByDay(accessHistory);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = formatHistoryForClipboard(accessHistory);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card
      className={`p-4 rounded-xl ${fillHeight ? 'h-full flex flex-col' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Access History</h3>
        {accessHistory.length > 0 && (
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="sm"
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>
      {accessHistory.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No history yet. Once you unblock a site, it will appear here.
        </p>
      ) : (
        <div
          className={`space-y-4 overflow-y-auto ${fillHeight ? 'flex-1 min-h-0' : 'max-h-[67.5vh]'}`}
        >
          {Array.from(groupedHistory.entries()).map(([dayLabel, attempts]) => (
            <div key={dayLabel}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {dayLabel}
              </h4>
              <div className="space-y-2">
                {attempts.map((attempt) => {
                  const colors = getOutcomeColors(attempt.outcome);
                  return (
                    <div
                      key={attempt.id}
                      className={`flex items-start gap-3 p-2 rounded-lg text-sm ${colors.bg}`}
                    >
                      <img
                        src={getFaviconUrl(attempt.domain)}
                        alt=""
                        className="w-5 h-5 mt-0.5 rounded-sm"
                        onError={(e) => {
                          // Hide broken images
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className={`font-medium truncate ${colors.text}`}>
                            {attempt.domain}
                          </div>
                          <div className={`text-xs whitespace-nowrap ${colors.subtext}`}>
                            {formatHistoryTime(attempt.timestamp)}
                          </div>
                        </div>
                        <div className={`text-xs ${colors.text}`}>
                          {capitalizeFirst(attempt.reason)}
                        </div>
                        {attempt.aiMessage && (
                          <div className={`text-xs mt-1 italic ${colors.subtext}`}>
                            {parseMarkdown(attempt.aiMessage)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
