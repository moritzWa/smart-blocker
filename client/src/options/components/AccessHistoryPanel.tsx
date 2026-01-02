import { Card } from '@/components/ui/card';
import type { AccessAttempt } from '../types';
import { parseMarkdown } from '@/blocked/utils';

interface AccessHistoryPanelProps {
  accessHistory: AccessAttempt[];
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

export default function AccessHistoryPanel({
  accessHistory,
}: AccessHistoryPanelProps) {
  const groupedHistory = groupHistoryByDay(accessHistory);

  return (
    <Card className="p-4 rounded-xl">
      <h3 className="text-lg font-semibold mb-3">Access History</h3>
      {accessHistory.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No history yet. Once you unblock a site, it will appear here.
        </p>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[67.5vh]">
          {Array.from(groupedHistory.entries()).map(([dayLabel, attempts]) => (
            <div key={dayLabel}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {dayLabel}
              </h4>
              <div className="space-y-2">
                {attempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-start gap-3 p-2 rounded-lg bg-muted/50 text-sm"
                  >
                    <span className="text-lg">
                      {attempt.outcome === 'approved'
                        ? '✅'
                        : attempt.outcome === 'rejected'
                        ? '❌'
                        : attempt.outcome === 'reminder'
                        ? '📝'
                        : attempt.outcome === 'blocked'
                        ? '🛡️'
                        : '🚪'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-medium truncate">
                          {attempt.domain}
                        </div>
                        <div className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatHistoryTime(attempt.timestamp)}
                        </div>
                      </div>
                      <div className="text-foreground text-xs">
                        {capitalizeFirst(attempt.reason)}
                      </div>
                      {attempt.aiMessage && (
                        <div className="text-muted-foreground text-xs mt-1 italic">
                          {parseMarkdown(attempt.aiMessage)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
