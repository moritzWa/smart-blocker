import { useEffect, useState } from 'react';
import TodoRemindersList from './components/TodoRemindersList';
import UnblockedSitesList from './components/UnblockedSitesList';
import StrictModeToggle from './components/StrictModeToggle';
import SiteList from './components/SiteList';
import SiteBlockImport from './components/SiteBlockImport';
import AccessHistoryPanel from './components/AccessHistoryPanel';
import FooterLinks from './components/FooterLinks';
import { Card } from '@/components/ui/card';
import type { UnblockedSite, TodoReminder, AccessAttempt } from './types';
import {
  getAllReminders,
  isReminderKey,
  LEGACY_REMINDERS_KEY,
  newReminderId,
  putReminder,
} from '../lib/reminders';
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

export default function Options() {
  const [allowedSites, setAllowedSites] = useState<string[]>([]);
  const [blockedSites, setBlockedSites] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [strictMode, setStrictMode] = useState(false);
  const [status, setStatus] = useState('');
  const [unblockedSites, setUnblockedSites] = useState<UnblockedSite[]>([]);
  const [todoReminders, setTodoReminders] = useState<TodoReminder[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [highlightTodos, setHighlightTodos] = useState(false);
  const [showHistory, setShowHistory] = useState<boolean | null>(null);
  const [accessHistory, setAccessHistory] = useState<AccessAttempt[]>([]);
  const [distractionModeExpiry, setDistractionModeExpiry] = useState<
    number | null
  >(null);
  const [todoListExpanded, setTodoListExpanded] = useState(false);

  // Update favicon based on strict mode
  useFaviconStrictMode(strictMode);

  useEffect(() => {
    loadSettings();
    loadUnblockedSites();
    loadTodoReminders();
    loadAccessHistory();
    loadDistractionMode();
    loadTodoListExpanded();
    loadShowHistory();

    // Listen for storage changes and update immediately
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string
    ) => {
      if (namespace === 'sync') {
        if (changes.temporaryUnblocks) {
          loadUnblockedSites();
        }
        // Reminders are one key each, so watch the whole prefix.
        if (
          Object.keys(changes).some(
            (key) => isReminderKey(key) || key === LEGACY_REMINDERS_KEY
          )
        ) {
          loadTodoReminders();
        }
        if (changes.distractionModeExpiry) {
          loadDistractionMode();
        }
        if (changes.todoListExpanded) {
          loadTodoListExpanded();
        }
        if (changes.showHistory) {
          loadShowHistory();
        }
      }
      if (namespace === 'local' && changes.accessHistory) {
        loadAccessHistory();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Auto-save when sites change (skip initial load)
  useEffect(() => {
    if (!settingsLoaded) return;
    saveSettings();
  }, [allowedSites, blockedSites, strictMode]);

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

    setAllowedSites(allowedArray);
    setBlockedSites(blockedArray);
    setStrictMode(strictModeValue);
    setSettingsLoaded(true);
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
    setTodoReminders(await getAllReminders());
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

  async function loadTodoListExpanded() {
    const result = await chrome.storage.sync.get({ todoListExpanded: false });
    setTodoListExpanded(result.todoListExpanded === true);
  }

  async function handleToggleTodoListExpanded() {
    const newValue = !todoListExpanded;
    setTodoListExpanded(newValue);
    await chrome.storage.sync.set({ todoListExpanded: newValue });
  }

  async function loadShowHistory() {
    const result = await chrome.storage.sync.get({ showHistory: true });
    setShowHistory(result.showHistory === true);
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
    await chrome.storage.sync.set({
      allowedSites: allowedSites.filter((s) => s.trim()),
      blockedSites: blockedSites.filter((s) => s.trim()),
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

    // The seed list reuses ids; under one-key-per-reminder that would collapse
    // them into each other, so re-mint on the way in.
    for (const todo of exampleTodos) {
      await putReminder({ ...todo, id: newReminderId() });
    }
    loadTodoReminders();

    setStatus('Seeded 3 example todos!');
    setTimeout(() => setStatus(''), 2000);
  }

  async function handleSeedAccessHistory() {
    const now = Date.now();
    const MINUTE = 60 * 1000;
    const HOUR = 60 * MINUTE;

    const DAY = 24 * HOUR;
    const domains = ['youtube.com', 'x.com', 'reddit.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'facebook.com'];
    const rejectionMessages = [
      "Boredom isn't a task. Maybe take a **walk** instead?",
      "If you can't say what you need, you probably don't need it.",
      "Browsing isn't a task. What specifically do you need?",
      'TikTok breaks have a way of becoming hours. Try a **real break** instead.',
      "That sounds like procrastination. What should you be working on?",
    ];
    const approvalMessages = [
      'Tech tutorial - sounds specific. **10 minutes** should cover it.',
      "Debugging help - that's legit. **5 minutes** to find your answer.",
      'Quick check of shared content. **1 minute** should be enough.',
      'Professional networking - go ahead. **3 minutes**.',
      'Music for focus - **1 hour** of lo-fi beats coming up.',
      'Event planning - **2 minutes** to get the details.',
      'Quick work message. **1 minute**.',
      'Shopping research - **15 minutes** to compare options.',
      'Profile update - **5 minutes**.',
    ];
    const approvalReasons = [
      'Watch tutorial on React hooks', 'check r/reactjs for hydration error',
      'friend sent me something', 'reply to recruiter message',
      'background music while working', 'check event details for Saturday',
      'DM coworker about standup', 'research mechanical keyboards',
      'update job status', 'check out that video Sarah recommended',
    ];
    const rejectionReasons = [
      'just bored', 'idk', 'want to browse', 'take a break',
      'nothing specific', 'just checking',
    ];

    const exampleHistory: AccessAttempt[] = [];
    let id = 0;

    // Generate data across all 14 days with 3-6 events per day
    for (let day = 0; day < 14; day++) {
      const dayOffset = day * DAY;
      const eventsPerDay = 3 + (day % 3); // 3, 4, 5, 3, 4, 5, ...

      for (let j = 0; j < eventsPerDay; j++) {
        id++;
        // Spread events across the day (morning to evening)
        const hourOffset = (8 + j * 3) * HOUR; // 8am, 11am, 2pm, 5pm, 8pm
        const timestamp = now - dayOffset - hourOffset;
        const domain = domains[(id + day) % domains.length];

        // Deterministic distribution: ~35% blocked, ~25% rejected, ~25% approved, ~15% abandoned
        const roll = (id * 3 + day * 7) % 20;
        if (roll < 7) {
          // blocked (35%)
          exampleHistory.push({
            id: `seed-${now}-${id}`,
            domain,
            reason: 'no interaction!',
            timestamp,
            outcome: 'blocked',
          });
        } else if (roll < 12) {
          // rejected (25%)
          exampleHistory.push({
            id: `seed-${now}-${id}`,
            domain,
            reason: rejectionReasons[id % rejectionReasons.length],
            timestamp,
            outcome: 'rejected',
            aiMessage: rejectionMessages[id % rejectionMessages.length],
          });
        } else if (roll < 17) {
          // approved (25%)
          const durations = [60, 120, 300, 600, 900, 3600];
          exampleHistory.push({
            id: `seed-${now}-${id}`,
            domain,
            reason: approvalReasons[id % approvalReasons.length],
            timestamp,
            outcome: 'approved',
            durationSeconds: durations[id % durations.length],
            aiMessage: approvalMessages[id % approvalMessages.length],
          });
        } else {
          // abandoned (15%)
          exampleHistory.push({
            id: `seed-${now}-${id}`,
            domain,
            reason: 'post story',
            timestamp,
            outcome: 'abandoned',
            aiMessage: 'What story are you posting? Is this time-sensitive?',
          });
        }
      }
    }

    const result = await chrome.storage.local.get({ accessHistory: [] });
    const existingHistory = result.accessHistory as AccessAttempt[];
    const mergedHistory = [...exampleHistory, ...existingHistory];

    await chrome.storage.local.set({ accessHistory: mergedHistory });
    loadAccessHistory();

    setStatus(`Seeded ${exampleHistory.length} example history items!`);
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

    const mergedAllowed = [
      ...new Set([...allowedSites, ...parsed.allowedSites]),
    ];
    const mergedBlocked = [
      ...new Set([...blockedSites, ...parsed.blockedSites]),
    ];

    setAllowedSites(mergedAllowed);
    setBlockedSites(mergedBlocked);
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

  async function handleEndBreak(domain: string) {
    // Remove from temporaryUnblocks
    const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
    const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;
    delete temporaryUnblocks[domain];
    await chrome.storage.sync.set({ temporaryUnblocks });

    // Clear the alarm
    await chrome.alarms.clear(`unblock-${domain}`);

    // Re-check all tabs to re-block if needed
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });

    loadUnblockedSites();
  }

  async function handleToggleHistory() {
    const newValue = !showHistory;
    if (newValue) {
      loadAccessHistory();
    }
    setShowHistory(newValue);
    await chrome.storage.sync.set({ showHistory: newValue });
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
            showHistory !== false ? 'min-[900px]:flex-row' : ''
          }`}
        >
          {/* Left column - Main settings */}
          <div
            className={`flex flex-col gap-6 ${
              showHistory !== false
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
              expanded={todoListExpanded}
              onToggleExpanded={handleToggleTodoListExpanded}
            />

            <UnblockedSitesList
              unblockedSites={unblockedSites}
              formatTimeRemaining={formatTimeRemaining}
              onEndBreak={handleEndBreak}
            />

            <Card className="p-3 flex flex-col gap-3 rounded-xl">
              <SiteList
                label="Always Allowed Sites"
                description="These sites will never be blocked."
                sites={allowedSites}
                onSitesChange={setAllowedSites}
                placeholder="remnote.com"
              />

              <StrictModeToggle
                strictMode={strictMode}
                onChange={setStrictMode}
              />
            </Card>

            <Card className="p-3 rounded-xl">
              <SiteList
                label="Blocked Sites"
                description="These sites will be blocked."
                sites={blockedSites}
                onSitesChange={setBlockedSites}
                placeholder="youtube.com"
              />
            </Card>

            <SiteBlockImport
              show={showImport}
              onToggle={() => setShowImport(!showImport)}
              onImport={handleImport}
            />

            {/* History in single-column layout (hidden on wide screens) */}
            {showHistory !== false && (
              <div className="min-[900px]:hidden">
                <AccessHistoryPanel accessHistory={accessHistory} />
              </div>
            )}
          </div>

          {/* Right column - Access History (visible on wide screens when shown) */}
          {showHistory !== false && (
            <div className="hidden min-[900px]:block min-[900px]:flex-1 min-[900px]:w-1/2 min-[900px]:relative">
              <div className="min-[900px]:absolute min-[900px]:inset-0 min-[900px]:overflow-hidden">
                <AccessHistoryPanel accessHistory={accessHistory} fillHeight />
              </div>
            </div>
          )}
        </div>
      </div>

      <FooterLinks
        showHistory={showHistory !== false}
        onToggleHistory={handleToggleHistory}
        onReviewClick={handleReviewClick}
        onToggleImport={() => setShowImport(!showImport)}
        onSeedTodos={handleSeedTodos}
        onSeedAccessHistory={handleSeedAccessHistory}
      />
    </div>
  );
}
