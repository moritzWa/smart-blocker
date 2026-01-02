import { useEffect, useState } from 'react';
import TodoRemindersList from './components/TodoRemindersList';
import UnblockedSitesList from './components/UnblockedSitesList';
import StrictModeToggle from './components/StrictModeToggle';
import SiteListInput from './components/SiteListInput';
import SiteBlockImport from './components/SiteBlockImport';
import AccessHistoryPanel from './components/AccessHistoryPanel';
import FooterLinks from './components/FooterLinks';
import { Card } from '@/components/ui/card';
import type { UnblockedSite, TodoReminder, AccessAttempt } from './types';
import { formatTimeRemaining, parseSiteBlockFormat } from './utils';
import { useFaviconStrictMode } from '@/hooks/useFaviconStrictMode';

// Type guards for safe storage access
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isTemporaryUnblocks(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.entries(value).every(([_, v]) => typeof v === 'number')
  );
}

function isTodoReminderArray(value: unknown): value is TodoReminder[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.url === 'string' &&
        typeof item.hostname === 'string' &&
        typeof item.timestamp === 'number' &&
        (item.note === undefined || typeof item.note === 'string')
    )
  );
}

export default function Options() {
  const [allowedSites, setAllowedSites] = useState('');
  const [blockedSites, setBlockedSites] = useState('');
  const [strictMode, setStrictMode] = useState(false);
  const [status, setStatus] = useState('');
  const [unblockedSites, setUnblockedSites] = useState<UnblockedSite[]>([]);
  const [todoReminders, setTodoReminders] = useState<TodoReminder[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [highlightTodos, setHighlightTodos] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [accessHistory, setAccessHistory] = useState<AccessAttempt[]>([]);

  // Update favicon based on strict mode
  useFaviconStrictMode(strictMode);

  useEffect(() => {
    loadSettings();
    loadUnblockedSites();
    loadTodoReminders();
    loadAccessHistory();

    // Listen for storage changes and update immediately
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string
    ) => {
      if (namespace === 'sync') {
        if (changes.temporaryUnblocks) {
          loadUnblockedSites();
        }
        if (changes.todoReminders) {
          loadTodoReminders();
        }
      }
      if (namespace === 'local' && changes.accessHistory) {
        loadAccessHistory();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
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

  // Auto-save strictMode immediately when toggled
  useEffect(() => {
    // Skip on initial load - check if we've loaded settings at least once
    if (allowedSites === '' && blockedSites === '') return;
    saveSettings();
  }, [strictMode]);

  // Check URL params for highlight todos
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('highlightTodos') === 'true') {
      setHighlightTodos(true);
      setTimeout(() => {
        setHighlightTodos(false);
      }, 3000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function loadSettings() {
    const result = await chrome.storage.sync.get({
      allowedSites: [],
      blockedSites: [],
      strictMode: false,
    });

    const allowedArray = isStringArray(result.allowedSites)
      ? result.allowedSites
      : [];
    const blockedArray = isStringArray(result.blockedSites)
      ? result.blockedSites
      : [];
    const strictModeValue =
      typeof result.strictMode === 'boolean' ? result.strictMode : false;

    setAllowedSites(allowedArray.join('\n'));
    setBlockedSites(blockedArray.join('\n'));
    setStrictMode(strictModeValue);
  }

  async function loadUnblockedSites() {
    const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });

    // Validate type before using
    if (!isTemporaryUnblocks(result.temporaryUnblocks)) {
      console.warn('Invalid temporaryUnblocks format, using empty object');
      setUnblockedSites([]);
      return;
    }

    const temporaryUnblocks = result.temporaryUnblocks;
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

    // Validate type before using
    if (!isTodoReminderArray(result.todoReminders)) {
      console.warn('Invalid todoReminders format, using empty array');
      setTodoReminders([]);
      return;
    }

    setTodoReminders(result.todoReminders);
  }

  async function saveSettings() {
    const allowedSitesList = allowedSites.split('\n').filter((s) => s.trim());
    const blockedSitesList = blockedSites.split('\n').filter((s) => s.trim());

    await chrome.storage.sync.set({
      allowedSites: allowedSitesList,
      blockedSites: blockedSitesList,
      strictMode,
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

  async function handleEditTodoReminder(id: string, note: string) {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_TODO_REMINDER',
      id,
      note,
    });
    loadTodoReminders();
  }

  async function handleOpenTodoUrl(url: string, id: string) {
    // Remove todo reminder and open URL
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
        const note = reminder.note ? `${reminder.note} ` : '';
        // Format display URL (remove https:// and www.)
        const displayUrl = formatDisplayUrl(reminder.url);
        return `- [ ] ${note}([${displayUrl}](${reminder.url}))`;
      })
      .join('\n');

    await navigator.clipboard.writeText(todoText);
    setStatus('Copied to clipboard!');
    setTimeout(() => setStatus(''), 2000);
  }

  async function handleSeedTodos() {
    const exampleTodos: TodoReminder[] = [
      {
        id: `seed-${Date.now()}-1`,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        hostname: 'youtube.com',
        note: 'Watch tutorial on React hooks',
        timestamp: Date.now() - 1800000,
      },
      {
        id: `seed-${Date.now()}-2`,
        url: 'https://x.com/naval/status/1234567890',
        hostname: 'x.com',
        note: 'Read thread about productivity',
        timestamp: Date.now() - 5400000,
      },
      {
        id: `seed-${Date.now()}-3`,
        url: 'https://www.linkedin.com/in/example',
        hostname: 'linkedin.com',
        note: "Reply to Mike's message",
        timestamp: Date.now() - 2700000,
      },
    ];

    const result = await chrome.storage.sync.get({ todoReminders: [] });
    const existingTodos = result.todoReminders as TodoReminder[];
    const mergedTodos = [...exampleTodos, ...existingTodos];

    await chrome.storage.sync.set({ todoReminders: mergedTodos });
    loadTodoReminders();

    setStatus('Seeded 3 example todos!');
    setTimeout(() => setStatus(''), 2000);
  }

  function formatDisplayUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname.replace(/^www\./, '');
      return hostname + urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
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
    if (parsed.strictMode) {
      setStrictMode(true);
    }

    // Clear import UI
    setShowImport(false);
    setStatus('Imported successfully!');
    setTimeout(() => setStatus(''), 2000);
  }

  function handleReviewClick() {
    // Open review URL (Chrome Web Store is always whitelisted now)
    window.open(
      'https://chromewebstore.google.com/detail/focus-shield-ai-site-dist/ibmmihgadnkilmknmfmohlclogcifboj/reviews',
      '_blank'
    );
  }

  async function loadAccessHistory() {
    const result = await chrome.storage.local.get({ accessHistory: [] });
    setAccessHistory(result.accessHistory as AccessAttempt[]);
  }

  function handleToggleHistory() {
    if (!showHistory) {
      loadAccessHistory();
    }
    setShowHistory(!showHistory);
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-6xl mx-auto px-8">
        {/* Header */}
        <div className="flex justify-between items-end gap-4 mb-6">
          <div className="flex flex-row items-center gap-4">
            <img
              src={strictMode ? '/logo-strict-mode.png' : '/logo.png'}
              alt="Focus Shield"
              className="w-12 h-12"
            />
            <h1 className="text-3xl font-bold text-foreground">
              Focus Shield Settings
            </h1>
          </div>

          {status && (
            <div className="text-emerald-600 dark:text-emerald-400 font-medium text-xl">
              {status}
            </div>
          )}
        </div>

        {/* Two-column layout on wide screens (only when history is shown) */}
        <div
          className={`flex flex-col gap-6 ${
            showHistory ? 'min-[900px]:flex-row' : ''
          }`}
        >
          {/* Left column - Main settings */}
          <div
            className={`flex flex-col gap-6 ${
              showHistory ? 'w-full max-w-3xl' : 'max-w-3xl mx-auto w-full'
            }`}
          >
            <TodoRemindersList
              todoReminders={todoReminders}
              onRemove={handleRemoveTodoReminder}
              onEdit={handleEditTodoReminder}
              onOpen={handleOpenTodoUrl}
              onCopy={handleCopyTodos}
              highlight={highlightTodos}
            />

            <UnblockedSitesList
              unblockedSites={unblockedSites}
              formatTimeRemaining={formatTimeRemaining}
            />

            <Card className="p-4 flex flex-col gap-4 rounded-xl">
              <StrictModeToggle
                strictMode={strictMode}
                onChange={setStrictMode}
              />

              <SiteListInput
                label="Always Allowed Sites"
                description="One site per line. These sites will never be blocked."
                value={allowedSites}
                onChange={setAllowedSites}
                placeholder="remnote.com&#10;claude.ai&#10;calendar.google.com"
              />
            </Card>

            <Card className="p-4 rounded-xl">
              <SiteListInput
                label="Blocked Sites"
                description="One site per line. These sites will be blocked."
                value={blockedSites}
                onChange={setBlockedSites}
                placeholder="youtube.com&#10;tiktok.com&#10;facebook.com"
              />
            </Card>

            <SiteBlockImport
              show={showImport}
              onToggle={() => setShowImport(!showImport)}
              onImport={handleImport}
            />

            {/* History in single-column layout (hidden on wide screens) */}
            {showHistory && (
              <div className="min-[900px]:hidden min-w-[400px]">
                <AccessHistoryPanel accessHistory={accessHistory} />
              </div>
            )}
          </div>

          {/* Right column - Access History (visible on wide screens when shown) */}
          {showHistory && (
            <div className="hidden min-[900px]:block min-[900px]:flex-1 min-[900px]:min-w-[300px]">
              <AccessHistoryPanel accessHistory={accessHistory} />
            </div>
          )}
        </div>
      </div>

      <FooterLinks
        showHistory={showHistory}
        onToggleHistory={handleToggleHistory}
        onReviewClick={handleReviewClick}
        onToggleImport={() => setShowImport(!showImport)}
        onSeedTodos={handleSeedTodos}
      />
    </div>
  );
}
