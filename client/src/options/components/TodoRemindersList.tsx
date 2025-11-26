import { X, Copy } from 'lucide-react';

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
        <button
          onClick={onCopy}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Copy to clipboard"
        >
          <Copy size={14} />
          Copy
        </button>
      </div>
      <div className="space-y-2">
        {todoReminders.map((reminder) => (
          <div
            key={reminder.id}
            className="flex items-start gap-3 group hover:bg-muted -mx-2 px-2 py-2 rounded transition-colors"
          >
            <button
              onClick={() => onOpen(reminder.url, reminder.id)}
              className="flex-1 min-w-0 text-left cursor-pointer group/item"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground">□</span>
                {reminder.note ? (
                  <span className="text-foreground text-sm group-hover/item:text-primary transition-colors">
                    {reminder.note}
                  </span>
                ) : (
                  <span className="font-mono text-sm text-foreground group-hover/item:text-primary break-all transition-colors">
                    {reminder.hostname}
                  </span>
                )}
              </div>
              <div className="ml-6 mt-0.5 text-xs text-muted-foreground">
                {reminder.note && (
                  <span className="font-mono">{reminder.hostname} • </span>
                )}
                {formatTimeAgo(reminder.timestamp)}
              </div>
            </button>
            <button
              onClick={() => onRemove(reminder.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 transition-all cursor-pointer"
              title="Remove"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
