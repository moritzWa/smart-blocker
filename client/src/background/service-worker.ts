console.log('Smart Blocker service worker loaded');

// Listen for tab updates and block instantly
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only check when URL actually changes
  if (changeInfo.url && tab.url) {
    // Skip chrome:// URLs and extension pages
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.includes('blocked.html')) {
      return;
    }

    const result = await checkIfBlocked(tab.url);
    if (result.blocked) {
      const blockPageUrl = chrome.runtime.getURL('src/blocked/blocked.html') +
        '?url=' + encodeURIComponent(tab.url);
      chrome.tabs.update(tabId, { url: blockPageUrl });
    }
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    // Skip chrome:// URLs and extension pages
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.includes('blocked.html')) {
      return;
    }

    const result = await checkIfBlocked(tab.url);
    if (result.blocked) {
      const blockPageUrl = chrome.runtime.getURL('src/blocked/blocked.html') +
        '?url=' + encodeURIComponent(tab.url);
      chrome.tabs.update(activeInfo.tabId, { url: blockPageUrl });
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_BLOCKED') {
    checkIfBlocked(message.url).then(sendResponse);
    return true; // Required for async response
  }

  if (message.type === 'UNBLOCK_SITE') {
    unblockSite(message.domain, message.minutes).then(sendResponse);
    return true;
  }

  if (message.type === 'VALIDATE_REASON') {
    validateUnblockReason(message.hostname, message.reason).then(sendResponse);
    return true;
  }

  if (message.type === 'SETTINGS_UPDATED') {
    checkAllOpenTabs().then(sendResponse);
    return true;
  }

  if (message.type === 'ADD_TODO_REMINDER') {
    addTodoReminder(message.url, message.note).then(sendResponse);
    return true;
  }

  if (message.type === 'REMOVE_TODO_REMINDER') {
    removeTodoReminder(message.id).then(sendResponse);
    return true;
  }
});

function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;

    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }

    return domain;
  } catch {
    return '';
  }
}

function matchesDomain(domain: string, pattern: string): boolean {
  // Remove protocol and www from pattern
  let cleanDomain = pattern
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');

  // Exact match
  if (domain === cleanDomain) {
    return true;
  }

  // Subdomain match (e.g., "youtube.com" matches "www.youtube.com", "m.youtube.com")
  if (domain.endsWith('.' + cleanDomain)) {
    return true;
  }

  return false;
}

async function checkIfBlocked(url: string): Promise<{ blocked: boolean }> {
  const domain = normalizeUrl(url);

  if (!domain) {
    return { blocked: false };
  }

  // Get settings from storage
  const result = await chrome.storage.sync.get({
    allowedSites: [],
    blockedSites: [],
    temporaryUnblocks: {},
    allowOnlyMode: false,
  });

  const allowedSites = result.allowedSites as string[];
  const blockedSites = result.blockedSites as string[];
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;
  const allowOnlyMode = result.allowOnlyMode as boolean;

  console.log('🔍 Checking:', domain, { allowOnlyMode, allowedSites, blockedSites });

  // Check if temporarily unblocked
  if (temporaryUnblocks[domain]) {
    const expiryTime = temporaryUnblocks[domain];
    if (Date.now() < expiryTime) {
      console.log(
        `⏰ Temporarily unblocked: ${domain} until ${new Date(expiryTime)}`
      );
      return { blocked: false };
    } else {
      // Expired, clean up
      delete temporaryUnblocks[domain];
      chrome.storage.sync.set({ temporaryUnblocks });
    }
  }

  // Check if in allowed list
  const isAllowed = allowedSites.some(pattern => matchesDomain(domain, pattern));

  if (allowOnlyMode) {
    // Allow-Only Mode: Block everything EXCEPT allowed sites
    if (isAllowed) {
      console.log(`✓ Allowed in Allow-Only Mode: ${domain}`);
      return { blocked: false };
    } else {
      console.log(`🚫 Blocked in Allow-Only Mode: ${domain}`);
      return { blocked: true };
    }
  } else {
    // Normal Mode: Only block sites in blocklist
    if (isAllowed) {
      console.log(`✓ Allowed: ${domain}`);
      return { blocked: false };
    }

    // Check if blocked
    for (const pattern of blockedSites) {
      if (matchesDomain(domain, pattern)) {
        console.log(`🚫 Blocked: ${domain} matches ${pattern}`);
        return { blocked: true };
      }
    }

    // Not in any list, allow
    return { blocked: false };
  }
}

async function unblockSite(domain: string, minutes: number): Promise<{ success: boolean }> {
  const expiryTime = Date.now() + (minutes * 60 * 1000);

  const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;

  temporaryUnblocks[domain] = expiryTime;
  await chrome.storage.sync.set({ temporaryUnblocks });

  console.log(`⏰ Unblocked ${domain} for ${minutes} minutes (until ${new Date(expiryTime)})`);

  return { success: true };
}

interface AIResponse {
  valid: boolean;
  minutes: number;
  reasoning: string;
}

async function validateUnblockReason(
  hostname: string,
  reason: string
): Promise<AIResponse | { error: string }> {
  try {
    const response = await fetch('http://localhost:8000/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname, reason }),
    });

    if (!response.ok) {
      throw new Error('Failed to validate reason');
    }

    return await response.json();
  } catch (error) {
    console.error('AI validation error:', error);
    return { error: 'Failed to connect to validation service' };
  }
}

// Check all open tabs when settings change
async function checkAllOpenTabs(): Promise<{ success: boolean }> {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (tab.id && tab.url) {
      // Skip chrome:// URLs and extension pages
      if (tab.url.startsWith('chrome://') ||
          tab.url.startsWith('chrome-extension://') ||
          tab.url.includes('blocked.html')) {
        continue;
      }

      const result = await checkIfBlocked(tab.url);
      if (result.blocked) {
        const blockPageUrl = chrome.runtime.getURL('src/blocked/blocked.html') +
          '?url=' + encodeURIComponent(tab.url);
        chrome.tabs.update(tab.id, { url: blockPageUrl });
      }
    }
  }

  return { success: true };
}

interface TodoReminder {
  id: string;
  url: string;
  hostname: string;
  note?: string;
  timestamp: number;
}

async function addTodoReminder(url: string, note?: string): Promise<{ success: boolean }> {
  const result = await chrome.storage.sync.get({ todoReminders: [] });
  const todoReminders = result.todoReminders as TodoReminder[];

  const reminder: TodoReminder = {
    id: Date.now().toString(),
    url,
    hostname: new URL(url).hostname,
    note,
    timestamp: Date.now(),
  };

  todoReminders.unshift(reminder); // Add to beginning
  await chrome.storage.sync.set({ todoReminders });

  console.log('Added todo reminder:', reminder);
  return { success: true };
}

async function removeTodoReminder(id: string): Promise<{ success: boolean }> {
  const result = await chrome.storage.sync.get({ todoReminders: [] });
  const todoReminders = result.todoReminders as TodoReminder[];

  const filtered = todoReminders.filter(r => r.id !== id);
  await chrome.storage.sync.set({ todoReminders: filtered });

  console.log('Removed todo reminder:', id);
  return { success: true };
}
