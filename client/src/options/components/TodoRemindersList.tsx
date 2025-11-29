import { useRef, useEffect } from 'react';
import { X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TodoReminder {
  id: string;
  url: string;
  hostname: string;
  note?: string;
  timestamp: number;
}

interface TodoRemindersListProps {
  todoReminders: TodoReminder[];
  onRemove: (id: string) => void;
  onOpen: (url: string, id: string) => void;
  onCopy: () => void;
  highlight?: boolean;
}

export default function TodoRemindersList({
  todoReminders,
  onRemove,
  onOpen,
  onCopy,
  highlight = false,
}: TodoRemindersListProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  // Scroll to and highlight on first reminder creation
  useEffect(() => {
    if (highlight && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlight]);

  if (todoReminders.length === 0) {
    return null;
  }

  // Helper to format URL like in BlockedPage
  const formatDisplayUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  return (
    <Card
      ref={sectionRef}
      className={`rounded-xl ${highlight ? 'animate-pulse-purple' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-foreground">
            To-Do Reminders
          </h2>
          <Button
            onClick={onCopy}
            variant="ghost"
            size="sm"
            title="Copy to clipboard"
          >
            <Copy size={14} />
            Copy
          </Button>
        </div>
        <div className="space-y-2">
          {todoReminders.map((reminder) => {
            const displayUrl = formatDisplayUrl(reminder.url);

            return (
              <div
                key={reminder.id}
                className="flex items-center gap-3 group hover:bg-muted px-2 py-1.5 rounded-lg transition-colors"
              >
                <div
                  onClick={() => onOpen(reminder.url, reminder.id)}
                  className="flex-1 min-w-0 text-left h-auto p-0 hover:bg-transparent group/item cursor-pointer"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground shrink-0">□</span>
                    {reminder.note ? (
                      <>
                        <span className="text-foreground text-sm group-hover/item:text-primary transition-colors shrink-0">
                          {reminder.note}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground truncate min-w-0">
                          {displayUrl}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-sm text-foreground group-hover/item:text-primary truncate transition-colors">
                        {displayUrl}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => onRemove(reminder.id)}
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0"
                  title="Remove"
                >
                  <X size={16} />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
