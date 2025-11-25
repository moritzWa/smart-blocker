import { useEffect, useState } from 'react';
import { X, Clock, Copy } from 'lucide-react';

interface UnblockedSite {
  domain: string;
  expiryTime: number;
}

interface TodoReminder {
  id: string;
  url: string;
  hostname: string;
  note?: string;
  timestamp: number;
}

export default function Options() {
  const [allowedSites, setAllowedSites] = useState('');
  const [blockedSites, setBlockedSites] = useState('');
  const [defaultMinutes, setDefaultMinutes] = useState(5);
  const [status, setStatus] = useState('');
  const [unblockedSites, setUnblockedSites] = useState<UnblockedSite[]>([]);
  const [todoReminders, setTodoReminders] = useState<TodoReminder[]>([]);

  useEffect(() => {
    loadSettings();
    loadUnblockedSites();
    loadTodoReminders();

    // Update unblocked sites every 5 seconds
    const interval = setInterval(loadUnblockedSites, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadSettings() {
    const result = await chrome.storage.sync.get({
      allowedSites: [],
      blockedSites: [],
      defaultUnblockMinutes: 5,
    });

    setAllowedSites((result.allowedSites as string[]).join('\n'));
    setBlockedSites((result.blockedSites as string[]).join('\n'));
    setDefaultMinutes(result.defaultUnblockMinutes as number);
  }

  async function loadUnblockedSites() {
    const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
    const temporaryUnblocks = result.temporaryUnblocks as Record<
      string,
      number
    >;

    const sites: UnblockedSite[] = [];
    const now = Date.now();

    for (const [domain, expiryTime] of Object.entries(temporaryUnblocks)) {
      if (expiryTime > now) {
        sites.push({ domain, expiryTime });
      }
    }

    // Sort by expiry time (soonest first)
    sites.sort((a, b) => a.expiryTime - b.expiryTime);
    setUnblockedSites(sites);
  }

  async function loadTodoReminders() {
    const result = await chrome.storage.sync.get({ todoReminders: [] });
    setTodoReminders(result.todoReminders as TodoReminder[]);
  }

  async function saveSettings() {
    const allowedSitesList = allowedSites.split('\n').filter((s) => s.trim());
    const blockedSitesList = blockedSites.split('\n').filter((s) => s.trim());

    await chrome.storage.sync.set({
      allowedSites: allowedSitesList,
      blockedSites: blockedSitesList,
      defaultUnblockMinutes: defaultMinutes,
    });

    // Notify service worker to check all open tabs
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });

    setStatus('Settings saved!');
    setTimeout(() => setStatus(''), 1000);
  }

  async function handleRemoveTodoReminder(id: string) {
    await chrome.runtime.sendMessage({
      type: 'REMOVE_TODO_REMINDER',
      id,
    });
    loadTodoReminders();
  }

  async function handleOpenTodoUrl(url: string, id: string) {
    // Remove reminder and open URL
    await chrome.runtime.sendMessage({
      type: 'REMOVE_TODO_REMINDER',
      id,
    });
    window.open(url, '_blank');
    loadTodoReminders();
  }

  async function handleCopyTodos() {
    const todoText = todoReminders
      .map((reminder) => {
        const note = reminder.note ? ` ${reminder.note}` : '';
        return `- [ ]${note} (${reminder.url})`;
      })
      .join('\n');

    await navigator.clipboard.writeText(todoText);
    setStatus('Copied to clipboard!');
    setTimeout(() => setStatus(''), 2000);
  }

  function formatTimeAgo(timestamp: number): string {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function formatTimeRemaining(expiryTime: number): string {
    const remaining = Math.max(0, expiryTime - Date.now());
    const minutes = Math.ceil(remaining / 60000);
    return `${minutes}m left`;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Smart Blocker Settings
        </h1>

        {todoReminders.length > 0 && (
          <section className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">
              To-Do Reminders
            </h2>
            <div className="space-y-3">
              {todoReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="bg-white p-4 rounded-lg border border-purple-100 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() =>
                          handleOpenTodoUrl(reminder.url, reminder.id)
                        }
                        className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline text-left break-all"
                      >
                        {reminder.hostname}
                      </button>
                      {reminder.note && (
                        <p className="text-gray-600 mt-1 text-sm">
                          "{reminder.note}"
                        </p>
                      )}
                      <p className="text-gray-400 text-xs mt-1">
                        Added {formatTimeAgo(reminder.timestamp)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveTodoReminder(reminder.id)}
                      className="text-gray-400 hover:text-red-600 flex-shrink-0 p-1 transition-colors cursor-pointer"
                      title="Remove reminder"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleCopyTodos}
              className="mt-4 w-full bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy size={16} />
              Copy to Clipboard
            </button>
          </section>
        )}

        {unblockedSites.length > 0 && (
          <section className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={20} />
              Currently Unblocked Sites
            </h2>
            <div className="space-y-2">
              {unblockedSites.map(({ domain, expiryTime }) => (
                <div
                  key={domain}
                  className="flex justify-between items-center bg-white px-3 py-2 rounded border border-blue-100"
                >
                  <span className="font-mono text-sm text-gray-800">
                    {domain}
                  </span>
                  <span className="text-sm text-blue-600 font-medium">
                    {formatTimeRemaining(expiryTime)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Always Allowed Sites
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            One site per line. These sites will never be blocked.
          </p>
          <textarea
            value={allowedSites}
            onChange={(e) => setAllowedSites(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+remnote.com&#10;+claude.ai&#10;+calendar.google.com"
          />
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Blocked Sites
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            One site per line. These sites will be blocked.
          </p>
          <textarea
            value={blockedSites}
            onChange={(e) => setBlockedSites(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://www.youtube.com/&#10;https://www.tiktok.com/&#10;https://www.facebook.com/"
          />
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Default Unblock Duration
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={defaultMinutes}
              onChange={(e) => setDefaultMinutes(parseInt(e.target.value) || 5)}
              min="1"
              max="60"
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="text-gray-700">minutes</label>
          </div>
        </section>

        <button
          onClick={saveSettings}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-md transition-colors"
        >
          Save Settings
        </button>

        {status && (
          <span className="ml-4 text-green-600 font-medium">{status}</span>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <a
            href="https://github.com/yourusername/smart-blocker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Contribute on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
