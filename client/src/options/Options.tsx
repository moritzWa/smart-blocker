import { useEffect, useState } from 'react';
import TodoRemindersList from './components/TodoRemindersList';
import UnblockedSitesList from './components/UnblockedSitesList';
import AllowOnlyModeToggle from './components/AllowOnlyModeToggle';
import SiteListInput from './components/SiteListInput';
import SiteBlockImport from './components/SiteBlockImport';

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
  const [showImport, setShowImport] = useState(false);

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

  function parseSiteBlockFormat(text: string): {
    allowedSites: string[];
    blockedSites: string[];
    allowOnlyMode: boolean;
  } {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    const allowedSites: string[] = [];
    const blockedSites: string[] = [];
    let allowOnlyMode = false;

    // Check if first line is '*' (Allow-Only Mode)
    if (lines[0] === '*') {
      allowOnlyMode = true;
      lines.shift(); // Remove the '*' line
    }

    for (const line of lines) {
      if (line.startsWith('+')) {
        // Allowed site - strip the '+' prefix
        const site = line.substring(1).trim();
        if (site) allowedSites.push(site);
      } else if (line !== '*') {
        // Blocked site
        blockedSites.push(line);
      }
    }

    return { allowedSites, blockedSites, allowOnlyMode };
  }

  function handleImport(importText: string) {
    const parsed = parseSiteBlockFormat(importText);

    // Merge with existing settings (avoid duplicates)
    const existingAllowed = allowedSites.split('\n').filter((s) => s.trim());
    const existingBlocked = blockedSites.split('\n').filter((s) => s.trim());

    const mergedAllowed = [
      ...new Set([...existingAllowed, ...parsed.allowedSites]),
    ];
    const mergedBlocked = [
      ...new Set([...existingBlocked, ...parsed.blockedSites]),
    ];

    setAllowedSites(mergedAllowed.join('\n'));
    setBlockedSites(mergedBlocked.join('\n'));
    if (parsed.allowOnlyMode) {
      setAllowOnlyMode(true);
    }

    // Clear import UI
    setShowImport(false);
    setStatus('Imported successfully!');
    setTimeout(() => setStatus(''), 2000);
  }

  async function handleSeedTodos() {
    const exampleTodos: TodoReminder[] = [
      {
        id: `seed-${Date.now()}-1`,
        url: 'https://github.com/moritzWa/smart-blocker',
        hostname: 'github.com',
        note: 'Review pull requests',
        timestamp: Date.now() - 3600000, // 1 hour ago
      },
      {
        id: `seed-${Date.now()}-2`,
        url: 'https://docs.google.com/document/d/example',
        hostname: 'docs.google.com',
        note: 'Finish project documentation',
        timestamp: Date.now() - 7200000, // 2 hours ago
      },
      {
        id: `seed-${Date.now()}-3`,
        url: 'https://www.youtube.com/watch?v=example',
        hostname: 'youtube.com',
        note: 'Watch tutorial on React hooks',
        timestamp: Date.now() - 1800000, // 30 minutes ago
      },
    ];

    // Get existing todos and append seed todos
    const result = await chrome.storage.sync.get({ todoReminders: [] });
    const existingTodos = result.todoReminders as TodoReminder[];
    const mergedTodos = [...existingTodos, ...exampleTodos];

    await chrome.storage.sync.set({ todoReminders: mergedTodos });
    loadTodoReminders();

    setStatus('Seeded 3 example todos!');
    setTimeout(() => setStatus(''), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <div className="flex items-center gap-4 mb-6">
          <img
            src="/logo.png"
            alt="AI Site Blocker"
            className="w-12 h-12"
          />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            AI Site Blocker Settings
          </h1>
        </div>

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

        <AllowOnlyModeToggle
          allowOnlyMode={allowOnlyMode}
          onChange={setAllowOnlyMode}
        />

        <SiteListInput
          label="Always Allowed Sites"
          description="One site per line. These sites will never be blocked."
          value={allowedSites}
          onChange={setAllowedSites}
          placeholder="remnote.com&#10;claude.ai&#10;calendar.google.com"
        />

        <SiteListInput
          label="Blocked Sites"
          description="One site per line. These sites will be blocked."
          value={blockedSites}
          onChange={setBlockedSites}
          placeholder="youtube.com&#10;tiktok.com&#10;facebook.com"
        />

        {status && (
          <div className="mb-6 text-green-600 dark:text-green-400 font-medium text-sm">
            {status}
          </div>
        )}

        <SiteBlockImport
          show={showImport}
          onToggle={() => setShowImport(!showImport)}
          onImport={handleImport}
        />

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
            // TODO: Add link to extension review page once submitted and accepted
            href="https://moritzw.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Review Extension
          </a>
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            Import from SiteBlock
          </button>
          <button
            onClick={handleSeedTodos}
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            Seed ToDos
          </button>
        </div>
      </div>
    </div>
  );
}
