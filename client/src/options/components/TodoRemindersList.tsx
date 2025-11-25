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
    <section className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">
        To-Do Reminders
      </h2>
      <div className="space-y-3">
        {todoReminders.map((reminder) => (
          <div
            key={reminder.id}
            className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-purple-100 dark:border-purple-800 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onOpen(reminder.url, reminder.id)}
                  className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left break-all"
                >
                  {reminder.hostname}
                </button>
                {reminder.note && (
                  <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm">
                    "{reminder.note}"
                  </p>
                )}
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  Added {formatTimeAgo(reminder.timestamp)}
                </p>
              </div>
              <button
                onClick={() => onRemove(reminder.id)}
                className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 shrink-0 p-1 transition-colors cursor-pointer"
                title="Remove reminder"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onCopy}
        className="mt-4 w-full bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        <Copy size={16} />
        Copy to Clipboard
      </button>
    </section>
  );
}
