import { useState, useMemo } from 'react';
import { Copy, Check, Shield, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
        bg: 'bg-red-50 dark:bg-red-950/50',
        text: 'text-red-900 dark:text-red-200',
        subtext: 'text-red-700 dark:text-red-300',
      };
    case 'rejected':
      // Green - AI stopped you
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/50',
        text: 'text-emerald-900 dark:text-emerald-200',
        subtext: 'text-emerald-700 dark:text-emerald-300',
      };
    case 'blocked':
      // Green - you stopped yourself (best outcome!)
      return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
        text: 'text-emerald-900 dark:text-emerald-200',
        subtext: 'text-emerald-700 dark:text-emerald-300',
      };
    case 'reminder':
      // Blue - saved for later
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/50',
        text: 'text-blue-900 dark:text-blue-200',
        subtext: 'text-blue-700 dark:text-blue-300',
      };
    case 'abandoned':
      // Amber - started but gave up
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/50',
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

// Compute 2-week stats from access history
function useTwoWeekStats(history: AccessAttempt[]) {
  return useMemo(() => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recent = history.filter((a) => a.timestamp >= twoWeeksAgo);

    const prevented = recent.filter(
      (a) => a.outcome === 'rejected' || a.outcome === 'blocked' || a.outcome === 'abandoned'
    ).length;

    const distracted = recent.filter((a) => a.outcome === 'approved').length;

    const total = prevented + distracted;
    const preventedPct = total > 0 ? Math.round((prevented / total) * 100) : 0;

    return { prevented, distracted, total, preventedPct };
  }, [history]);
}

export default function AccessHistoryPanel({
  accessHistory,
  fillHeight = false,
}: AccessHistoryPanelProps) {
  const [copied, setCopied] = useState(false);
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const stats = useTwoWeekStats(accessHistory);

  // Normalize domain - extract hostname from URLs and strip www.
  function normalizeDomain(domain: string): string {
    try {
      let hostname = domain;
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        hostname = new URL(domain).hostname;
      }
      // Strip www. prefix
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }
      return hostname;
    } catch {
      return domain;
    }
  }

  // Get unique domains sorted by frequency (normalized)
  const domains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const attempt of accessHistory) {
      const normalized = normalizeDomain(attempt.domain);
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([domain]) => domain);
  }, [accessHistory]);

  // Filter history by selected domain (using normalized comparison)
  const filteredHistory = useMemo(() => {
    if (domainFilter === 'all') return accessHistory;
    return accessHistory.filter((a) => normalizeDomain(a.domain) === domainFilter);
  }, [accessHistory, domainFilter]);

  const groupedHistory = groupHistoryByDay(filteredHistory);

  async function handleCopy() {
    const text = formatHistoryForClipboard(filteredHistory);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card
      className={`p-4 rounded-xl ${fillHeight ? 'h-full flex flex-col' : ''}`}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-lg font-semibold">Access History</h3>
        {accessHistory.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="sm"
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {domains.length > 1 && (
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Filter by domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  {domains.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
      {/* 2-week stats bar */}
      {stats.total > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Shield size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Prevented</span>
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.prevented}</div>
            </div>
            <div className="flex-1 rounded-lg bg-red-50 dark:bg-red-950/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <AlertTriangle size={14} className="text-red-500 dark:text-red-400" />
                <span className="text-xs font-medium text-red-600 dark:text-red-300 uppercase tracking-wide">Distracted</span>
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-300">{stats.distracted}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="relative h-2 rounded-full bg-red-200 dark:bg-red-900/50 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500"
              style={{ width: `${stats.preventedPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Last 14 days - {stats.preventedPct}% of distractions blocked
          </p>
        </div>
      )}

      {accessHistory.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No history yet. Once you unblock a site, it will appear here.
        </p>
      ) : filteredHistory.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No history for this domain.
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
