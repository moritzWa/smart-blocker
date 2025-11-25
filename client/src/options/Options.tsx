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
  const [allowOnlyMode, setAllowOnlyMode] = useState(false);
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
      allowOnlyMode: false,
    });

    setAllowedSites((result.allowedSites as string[]).join('\n'));
    setBlockedSites((result.blockedSites as string[]).join('\n'));
    setDefaultMinutes(result.defaultUnblockMinutes as number);
    setAllowOnlyMode(result.allowOnlyMode as boolean);
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

    console.log('💾 Saving settings:', {
      allowedSitesList,
      blockedSitesList,
      defaultMinutes,
      allowOnlyMode
    });

    await chrome.storage.sync.set({
      allowedSites: allowedSitesList,
      blockedSites: blockedSitesList,
      defaultUnblockMinutes: defaultMinutes,
      allowOnlyMode,
    });

    // Verify what was actually saved
    const verification = await chrome.storage.sync.get(['allowOnlyMode']);
    console.log('✅ Verified stored value:', verification);

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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          Smart Blocker Settings
        </h1>

        {todoReminders.length > 0 && (
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
                        onClick={() =>
                          handleOpenTodoUrl(reminder.url, reminder.id)
                        }
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
                      onClick={() => handleRemoveTodoReminder(reminder.id)}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 flex-shrink-0 p-1 transition-colors cursor-pointer"
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
              className="mt-4 w-full bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy size={16} />
              Copy to Clipboard
            </button>
          </section>
        )}

        {unblockedSites.length > 0 && (
          <section className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <Clock size={20} />
              Currently Unblocked Sites
            </h2>
            <div className="space-y-2">
              {unblockedSites.map(({ domain, expiryTime }) => (
                <div
                  key={domain}
                  className="flex justify-between items-center bg-white dark:bg-gray-700 px-3 py-2 rounded border border-blue-100 dark:border-blue-800"
                >
                  <span className="font-mono text-sm text-gray-800 dark:text-gray-200">
                    {domain}
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {formatTimeRemaining(expiryTime)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Allow-Only Mode
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Block all sites except those in the allowed list
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={allowOnlyMode}
                onChange={(e) => setAllowOnlyMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Always Allowed Sites
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            One site per line. These sites will never be blocked.
          </p>
          <textarea
            value={allowedSites}
            onChange={(e) => setAllowedSites(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            placeholder="remnote.com&#10;claude.ai&#10;calendar.google.com"
          />
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Blocked Sites
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            One site per line. These sites will be blocked.
          </p>
          <textarea
            value={blockedSites}
            onChange={(e) => setBlockedSites(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            placeholder="https://www.youtube.com/&#10;https://www.tiktok.com/&#10;https://www.facebook.com/"
          />
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Default Unblock Duration
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={defaultMinutes}
              onChange={(e) => setDefaultMinutes(parseInt(e.target.value) || 5)}
              min="1"
              max="60"
              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <label className="text-gray-700 dark:text-gray-300">minutes</label>
          </div>
        </section>

        <button
          onClick={saveSettings}
          className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-md transition-colors"
        >
          Save Settings
        </button>

        {status && (
          <span className="ml-4 text-green-600 dark:text-green-400 font-medium">{status}</span>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <a
            href="https://github.com/yourusername/smart-blocker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Contribute on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
