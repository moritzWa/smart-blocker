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
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          To-Do Reminders
        </h2>
        <button
          onClick={onCopy}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer"
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
            className="flex items-start gap-3 group hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 py-2 rounded transition-colors"
          >
            <button
              onClick={() => onOpen(reminder.url, reminder.id)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-gray-400 dark:text-gray-500">□</span>
                {reminder.note ? (
                  <span className="text-gray-700 dark:text-gray-200 text-sm">
                    {reminder.note}
                  </span>
                ) : (
                  <span className="font-mono text-sm text-gray-700 dark:text-gray-200 break-all">
                    {reminder.hostname}
                  </span>
                )}
              </div>
              <div className="ml-6 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {reminder.note && (
                  <span className="font-mono">{reminder.hostname} • </span>
                )}
                {formatTimeAgo(reminder.timestamp)}
              </div>
            </button>
            <button
              onClick={() => onRemove(reminder.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 shrink-0 transition-all cursor-pointer"
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
