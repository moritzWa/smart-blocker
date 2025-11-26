import { X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  formatTimeAgo: (timestamp: number) => string;
}

export default function TodoRemindersList({
  todoReminders,
  onRemove,
  onOpen,
  onCopy,
  formatTimeAgo,
}: TodoRemindersListProps) {
  if (todoReminders.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
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
        {todoReminders.map((reminder) => (
          <div
            key={reminder.id}
            className="flex items-start gap-3 group hover:bg-muted px-2 py-2 rounded-lg transition-colors"
          >
            <div
              onClick={() => onOpen(reminder.url, reminder.id)}
              className="flex-1 min-w-0 text-left h-auto p-0 hover:bg-transparent group/item cursor-pointer justify-between"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground">□</span>
                {reminder.note ? (
                  <span className="text-foreground text-sm group-hover/item:text-primary transition-colors">
                    {reminder.note}
                  </span>
                ) : (
                  <span className="font-mono text-sm text-foreground group-hover/item:text-primary break-all transition-colors">
                    {reminder.url}
                  </span>
                )}

                <div className="ml-6 mt-0.5 text-xs text-muted-foreground">
                  {reminder.note && (
                    <span className="font-mono">{reminder.url} • </span>
                  )}
                  {formatTimeAgo(reminder.timestamp)}
                </div>
              </div>
            </div>

            <Button
              onClick={() => onRemove(reminder.id)}
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 h-6 w-6"
              title="Remove"
            >
              <X size={16} />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
