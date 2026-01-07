import { useEffect, useState } from 'react';
import TodoRemindersList from './components/TodoRemindersList';
import UnblockedSitesList from './components/UnblockedSitesList';
import StrictModeToggle from './components/StrictModeToggle';
import DistractionModeButton from './components/DistractionModeButton';
import SiteListInput from './components/SiteListInput';
import SiteBlockImport from './components/SiteBlockImport';
import AccessHistoryPanel from './components/AccessHistoryPanel';
import FooterLinks from './components/FooterLinks';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
  const [distractionModeExpiry, setDistractionModeExpiry] = useState<
    number | null
  >(null);

  // Update favicon based on strict mode
  useFaviconStrictMode(strictMode);

  useEffect(() => {
    loadSettings();
    loadUnblockedSites();
    loadTodoReminders();
    loadAccessHistory();
    loadDistractionMode();

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
        if (changes.distractionModeExpiry) {
          loadDistractionMode();
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

  async function loadDistractionMode() {
    const result = await chrome.storage.sync.get({
      distractionModeExpiry: null,
    });
    const expiry = result.distractionModeExpiry as number | null;

    // Check if expired
    if (expiry && expiry > Date.now()) {
      setDistractionModeExpiry(expiry);
    } else {
      setDistractionModeExpiry(null);
    }
  }

  async function handleEnableDistractionMode() {
    await chrome.runtime.sendMessage({ type: 'ENABLE_DISTRACTION_MODE' });
    loadDistractionMode();
  }

  async function handleDisableDistractionMode() {
    await chrome.runtime.sendMessage({ type: 'DISABLE_DISTRACTION_MODE' });
    loadDistractionMode();
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

  function handleOpenTodoUrl(url: string) {
    // Just open URL - user removes manually with X button when done
    window.open(url, '_blank');
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
        note: 'Check out that video Sarah recommended',
        timestamp: Date.now() - 2700000, // 45 minutes ago
      },
      {
        id: `seed-${Date.now()}-2`,
        url: 'https://x.com/naval/status/1234567890',
        hostname: 'x.com',
        note: 'Read Twitter thread about productivity',
        timestamp: Date.now() - 5400000, // 90 minutes ago
      },
      {
        id: `seed-${Date.now()}-2`,
        url: 'https://exa.ai/search?q=great+article+on+how+to+cook+a+good+soup+with+a+nice+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+bla+bal+etc%3A',
        hostname: 'x.com',
        note: 'Soup',
        timestamp: Date.now() - 5400000, // 90 minutes ago
      },
      {
        id: `seed-${Date.now()}-3`,
        url: 'https://www.linkedin.com/feed/',
        hostname: 'linkedin.com',
        note: "Reply to Mike's message",
        timestamp: Date.now() - 1800000, // 30 minutes ago
      },
      {
        id: `seed-${Date.now()}-4`,
        url: 'https://www.reddit.com/r/webdev/comments/example',
        hostname: 'reddit.com',
        note: 'Check that Next.js discussion',
        timestamp: Date.now() - 7200000, // 2 hours ago
      },
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

  async function handleSeedAccessHistory() {
    const now = Date.now();
    const MINUTE = 60 * 1000;
    const HOUR = 60 * MINUTE;

    const exampleHistory: AccessAttempt[] = [
      // Today - recent attempts
      {
        id: `seed-${now}-1`,
        domain:
          'https://www.youtube.com/watch?v=mbDlCOoMZfs&pp=ygUodWZjIHJlY3J1aXRpbmcgZnVubmVsIG1pbGl0aWEgdXNiZWtpc3RhbtIHCQlNCgGHKiGM7w%3D%3D',
        reason: 'Watch the new Fireship video on Bun 2.0',
        timestamp: now - 15 * MINUTE,
        outcome: 'approved',
        durationSeconds: 600,
        aiMessage:
          'Tech tutorial - sounds specific. **10 minutes** should cover it.',
      },
      {
        id: `seed-${now}-2`,
        domain: 'x.com',
        reason: 'just bored',
        timestamp: now - 45 * MINUTE,
        outcome: 'rejected',
        aiMessage: "Boredom isn't a task. Maybe take a **walk** instead?",
      },
      {
        id: `seed-${now}-3`,
        domain: 'reddit.com',
        reason: 'check r/reactjs for solution to hydration error',
        timestamp: now - 2 * HOUR,
        outcome: 'approved',
        durationSeconds: 300,
        aiMessage:
          "Debugging help - that's legit. **5 minutes** to find your answer.",
      },
      {
        id: `seed-${now}-4`,
        domain: 'instagram.com',
        reason: 'friend sent me something',
        timestamp: now - 3 * HOUR,
        outcome: 'approved',
        durationSeconds: 60,
        aiMessage:
          'Quick check of shared content. **1 minute** should be enough.',
      },
      {
        id: `seed-${now}-5`,
        domain: 'linkedin.com',
        reason: 'reply to recruiter message',
        timestamp: now - 4 * HOUR,
        outcome: 'approved',
        durationSeconds: 180,
        aiMessage: 'Professional networking - go ahead. **3 minutes**.',
      },
      // Yesterday
      {
        id: `seed-${now}-6`,
        domain: 'twitter.com',
        reason: 'idk',
        timestamp: now - 26 * HOUR,
        outcome: 'rejected',
        aiMessage:
          "If you can't say what you need, you probably don't need it.",
      },
      {
        id: `seed-${now}-7`,
        domain: 'youtube.com',
        reason: 'background music while working',
        timestamp: now - 28 * HOUR,
        outcome: 'approved',
        durationSeconds: 3600,
        aiMessage: 'Music for focus - **1 hour** of lo-fi beats coming up.',
      },
      {
        id: `seed-${now}-8`,
        domain: 'reddit.com',
        reason: 'want to browse',
        timestamp: now - 30 * HOUR,
        outcome: 'rejected',
        aiMessage: "Browsing isn't a task. What specifically do you need?",
      },
      {
        id: `seed-${now}-9`,
        domain: 'facebook.com',
        reason: 'check event details for Saturday',
        timestamp: now - 32 * HOUR,
        outcome: 'approved',
        durationSeconds: 120,
        aiMessage: 'Event planning - **2 minutes** to get the details.',
      },
      {
        id: `seed-${now}-10`,
        domain: 'tiktok.com',
        reason: 'take a break',
        timestamp: now - 34 * HOUR,
        outcome: 'rejected',
        aiMessage:
          'TikTok breaks have a way of becoming hours. Try a **real break** instead.',
      },
      // Two days ago
      {
        id: `seed-${now}-11`,
        domain: 'x.com',
        reason: 'DM coworker about standup time',
        timestamp: now - 50 * HOUR,
        outcome: 'approved',
        durationSeconds: 60,
        aiMessage: 'Quick work message. **1 minute**.',
      },
      {
        id: `seed-${now}-12`,
        domain: 'youtube.com',
        reason: 'learn about Next.js app router',
        timestamp: now - 52 * HOUR,
        outcome: 'reminder',
        aiMessage:
          'Added to your **todo list** - watch when you have dedicated learning time.',
      },
      {
        id: `seed-${now}-13`,
        domain: 'instagram.com',
        reason: 'post story',
        timestamp: now - 54 * HOUR,
        outcome: 'abandoned',
        aiMessage: 'What story are you posting? Is this time-sensitive?',
      },
      {
        id: `seed-${now}-14`,
        domain: 'reddit.com',
        reason: 'research mechanical keyboards',
        timestamp: now - 56 * HOUR,
        outcome: 'approved',
        durationSeconds: 900,
        aiMessage: 'Shopping research - **15 minutes** to compare options.',
      },
      {
        id: `seed-${now}-15`,
        domain: 'linkedin.com',
        reason: 'update job status',
        timestamp: now - 58 * HOUR,
        outcome: 'approved',
        durationSeconds: 300,
        aiMessage: 'Profile update - **5 minutes**.',
      },
      // Blocked - user saw page and left without trying
      {
        id: `seed-${now}-16`,
        domain: 'youtube.com',
        reason: 'no interaction!',
        timestamp: now - 5 * HOUR,
        outcome: 'blocked',
      },
      {
        id: `seed-${now}-17`,
        domain: 'x.com',
        reason: 'no interaction!',
        timestamp: now - 8 * HOUR,
        outcome: 'blocked',
      },
      {
        id: `seed-${now}-18`,
        domain: 'tiktok.com',
        reason: 'no interaction!',
        timestamp: now - 48 * HOUR,
        outcome: 'blocked',
      },
    ];

    const result = await chrome.storage.local.get({ accessHistory: [] });
    const existingHistory = result.accessHistory as AccessAttempt[];
    const mergedHistory = [...exampleHistory, ...existingHistory];

    await chrome.storage.local.set({ accessHistory: mergedHistory });
    loadAccessHistory();

    setStatus('Seeded 18 example history items!');
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
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="flex justify-between items-end gap-4 mb-6">
          <div className="flex flex-row items-center gap-4">
            <img
              src={strictMode ? '/logo-strict-mode.png' : '/logo.png'}
              alt="Focus Shield"
              className="w-12 h-12"
            />
            <h1 className="text-3xl font-bold text-foreground">
              Focus Shield Home
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
              showHistory
                ? 'w-full min-[900px]:flex-1 min-[900px]:w-1/2'
                : 'max-w-3xl mx-auto w-full'
            }`}
          >
            <TodoRemindersList
              todoReminders={todoReminders}
              onRemove={handleRemoveTodoReminder}
              onEdit={handleEditTodoReminder}
              onOpen={handleOpenTodoUrl}
              onCopy={handleCopyTodos}
              highlight={highlightTodos}
              distractionModeExpiry={distractionModeExpiry}
              onEnableDistractionMode={handleEnableDistractionMode}
              onDisableDistractionMode={handleDisableDistractionMode}
            />

            <UnblockedSitesList
              unblockedSites={unblockedSites}
              formatTimeRemaining={formatTimeRemaining}
            />

            <Card className="p-4 flex flex-col gap-4 rounded-xl">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">
                  Always Allowed Sites
                </h2>
                <p className="text-sm text-muted-foreground">
                  One site per line. These sites will never be blocked.
                </p>
              </div>

              <StrictModeToggle
                strictMode={strictMode}
                onChange={setStrictMode}
              />

              <Textarea
                value={allowedSites}
                onChange={(e) => setAllowedSites(e.target.value)}
                rows={5}
                placeholder={'remnote.com\nclaude.ai\ncalendar.google.com'}
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
              <div className="min-[900px]:hidden">
                <AccessHistoryPanel accessHistory={accessHistory} />
              </div>
            )}
          </div>

          {/* Right column - Access History (visible on wide screens when shown) */}
          {showHistory && (
            <div className="hidden min-[900px]:block min-[900px]:flex-1 min-[900px]:w-1/2">
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
        onSeedAccessHistory={handleSeedAccessHistory}
      />
    </div>
  );
}
