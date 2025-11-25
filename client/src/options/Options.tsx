import { useEffect, useState } from 'react';
import TodoRemindersList from './components/TodoRemindersList';
import UnblockedSitesList from './components/UnblockedSitesList';
import AllowOnlyModeToggle from './components/AllowOnlyModeToggle';

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
  const [allowOnlyMode, setAllowOnlyMode] = useState(false);
  const [status, setStatus] = useState('');
  const [unblockedSites, setUnblockedSites] = useState<UnblockedSite[]>([]);
  const [todoReminders, setTodoReminders] = useState<TodoReminder[]>([]);

  useEffect(() => {
    loadSettings();
    loadUnblockedSites();
    loadTodoReminders();

    // Update both unblocked sites and todo reminders every 5 seconds
    const interval = setInterval(() => {
      loadUnblockedSites();
      loadTodoReminders();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-save allowedSites after 1 second of no typing
  useEffect(() => {
    if (allowedSites === '') return; // Skip on initial load
    const timer = setTimeout(() => {
      saveSettings();
    }, 1000);
    return () => clearTimeout(timer);
  }, [allowedSites]);

  // Auto-save blockedSites after 1 second of no typing
  useEffect(() => {
    if (blockedSites === '') return; // Skip on initial load
    const timer = setTimeout(() => {
      saveSettings();
    }, 1000);
    return () => clearTimeout(timer);
  }, [blockedSites]);

  // Auto-save allowOnlyMode immediately when toggled
  useEffect(() => {
    // Skip on initial load - check if we've loaded settings at least once
    if (allowedSites === '' && blockedSites === '') return;
    saveSettings();
  }, [allowOnlyMode]);

  async function loadSettings() {
    const result = await chrome.storage.sync.get({
      allowedSites: [],
      blockedSites: [],
      allowOnlyMode: false,
    });

    setAllowedSites((result.allowedSites as string[]).join('\n'));
    setBlockedSites((result.blockedSites as string[]).join('\n'));
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

    await chrome.storage.sync.set({
      allowedSites: allowedSitesList,
      blockedSites: blockedSitesList,
      allowOnlyMode,
    });

    // Notify service worker to check all open tabs
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });

    setStatus('Saved');
    setTimeout(() => setStatus(''), 2000);
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

        <TodoRemindersList
          todoReminders={todoReminders}
          onRemove={handleRemoveTodoReminder}
          onOpen={handleOpenTodoUrl}
          onCopy={handleCopyTodos}
          formatTimeAgo={formatTimeAgo}
        />

        <UnblockedSitesList
          unblockedSites={unblockedSites}
          formatTimeRemaining={formatTimeRemaining}
        />

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Always Allowed Sites
          </h2>
          <AllowOnlyModeToggle
            allowOnlyMode={allowOnlyMode}
            onChange={setAllowOnlyMode}
          />
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

        {status && (
          <div className="mb-6 text-green-600 dark:text-green-400 font-medium text-sm">
            {status}
          </div>
        )}

        <div className="mt-8 flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <a
            href="https://github.com/moritzWa/smart-blocker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Contribute on GitHub
          </a>
          <a
            href="moritzw.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Review Extension
          </a>
        </div>
      </div>
    </div>
  );
}
