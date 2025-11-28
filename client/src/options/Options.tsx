import { useEffect, useState } from 'react';
import TodoRemindersList from './components/TodoRemindersList';
import UnblockedSitesList from './components/UnblockedSitesList';
import StrictModeToggle from './components/StrictModeToggle';
import SiteListInput from './components/SiteListInput';
import SiteBlockImport from './components/SiteBlockImport';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { UnblockedSite, TodoReminder } from './types';
import { formatTimeRemaining, parseSiteBlockFormat } from './utils';
import { createSeedTodos } from './constants';
import { useFaviconStrictMode } from '@/hooks/useFaviconStrictMode';

export default function Options() {
  const [allowedSites, setAllowedSites] = useState('');
  const [blockedSites, setBlockedSites] = useState('');
  const [strictMode, setStrictMode] = useState(false);
  const [status, setStatus] = useState('');
  const [unblockedSites, setUnblockedSites] = useState<UnblockedSite[]>([]);
  const [todoReminders, setTodoReminders] = useState<TodoReminder[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [highlightTodos, setHighlightTodos] = useState(false);

  // Update favicon based on strict mode
  useFaviconStrictMode(strictMode);

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

  // Auto-save strictMode immediately when toggled
  useEffect(() => {
    // Skip on initial load - check if we've loaded settings at least once
    if (allowedSites === '' && blockedSites === '') return;
    saveSettings();
  }, [strictMode]);

  // Check URL params for highlight todos (first-time reminder onboarding)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('highlightTodos') === 'true') {
      setHighlightTodos(true);
      // Remove highlight after 8 seconds
      setTimeout(() => {
        setHighlightTodos(false);
      }, 8000);
      // Clean up URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function loadSettings() {
    const result = await chrome.storage.sync.get({
      allowedSites: [],
      blockedSites: [],
      strictMode: false,
    });

    setAllowedSites((result.allowedSites as string[]).join('\n'));
    setBlockedSites((result.blockedSites as string[]).join('\n'));
    setStrictMode(result.strictMode as boolean);
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

  async function handleSeedTodos() {
    const exampleTodos = createSeedTodos();

    // Get existing todos and append seed todos
    const result = await chrome.storage.sync.get({ todoReminders: [] });
    const existingTodos = result.todoReminders as TodoReminder[];
    const mergedTodos = [...existingTodos, ...exampleTodos];

    await chrome.storage.sync.set({ todoReminders: mergedTodos });
    loadTodoReminders();

    setStatus('Seeded 4 example todos!');
    setTimeout(() => setStatus(''), 2000);
  }

  function handleReviewClick() {
    // Open review URL (Chrome Web Store is always whitelisted now)
    window.open(
      'https://chromewebstore.google.com/detail/focus-shield-ai-site-dist/ibmmihgadnkilmknmfmohlclogcifboj/reviews',
      '_blank'
    );
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-3xl mx-auto rounded-lg p-8">
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-end gap-4">
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

          <TodoRemindersList
            todoReminders={todoReminders}
            onRemove={handleRemoveTodoReminder}
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

          <div className="flex gap-4 justify-between text-center">
            {/* <Button variant="link" size="sm" asChild>
              <a
                href="https://github.com/moritzWa/smart-blocker"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contribute on GitHub
              </a>
            </Button> */}
            <Button
              variant="link"
              size="sm"
              className="cursor-pointer text-muted-foreground"
              onClick={handleReviewClick}
            >
              Review Extension
            </Button>
            <Button
              variant="link"
              size="sm"
              className="cursor-pointer text-muted-foreground"
              onClick={() => setShowImport(!showImport)}
            >
              Import from SiteBlock
            </Button>
            <Button
              variant="link"
              size="sm"
              className="cursor-pointer text-muted-foreground"
              onClick={handleSeedTodos}
            >
              Seed ToDos
            </Button>
            <Button
              variant="link"
              size="sm"
              className="cursor-pointer text-muted-foreground"
              onClick={() => window.open('https://moritzw.com', '_blank')}
            >
              Made by Moritz W.
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
