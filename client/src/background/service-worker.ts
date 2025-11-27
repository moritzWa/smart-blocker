import { checkIfBlocked, normalizeUrl } from './utils/blocking';
import { validateUnblockReason } from './services/ai-validation';
import { unblockSite, addTodoReminder, removeTodoReminder } from './services/storage';

console.log('Focus Shield service worker loaded');

// Badge update interval ID
let badgeUpdateInterval: number | null = null;

// Helper to format time remaining for badge display
function formatBadgeTime(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return seconds.toString();
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

// Update badge for current active tab
async function updateBadgeForActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;

  const tab = tabs[0];
  if (!tab.url || !tab.id) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  // Skip chrome:// URLs and extension pages
  if (tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.includes('blocked.html')) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  // Get the domain and check if it's temporarily unblocked
  const domain = normalizeUrl(tab.url);
  const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;

  const expiryTime = temporaryUnblocks[domain];
  if (expiryTime && expiryTime > Date.now()) {
    const secondsRemaining = Math.ceil((expiryTime - Date.now()) / 1000);
    const badgeText = formatBadgeTime(secondsRemaining);

    // Set color based on time remaining
    const color = secondsRemaining <= 60 ? '#dc2626' : '#059669'; // Red if <1min, green otherwise

    chrome.action.setBadgeBackgroundColor({ color });
    chrome.action.setBadgeTextColor({ color: '#ffffff' }); // White text for better readability
    chrome.action.setBadgeText({ text: badgeText });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Start badge update timer
function startBadgeUpdateTimer() {
  if (badgeUpdateInterval !== null) return; // Already running

  // Update immediately
  updateBadgeForActiveTab();

  // Update every second
  badgeUpdateInterval = setInterval(() => {
    updateBadgeForActiveTab();
  }, 1000) as unknown as number;

  console.log('⏱️ Started badge update timer');
}

// Stop badge update timer
function stopBadgeUpdateTimer() {
  if (badgeUpdateInterval !== null) {
    clearInterval(badgeUpdateInterval);
    badgeUpdateInterval = null;
    chrome.action.setBadgeText({ text: '' });
    console.log('⏱️ Stopped badge update timer');
  }
}

// Check if we have any active temporary unblocks
async function hasActiveUnblocks(): Promise<boolean> {
  const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;
  const now = Date.now();

  return Object.values(temporaryUnblocks).some(expiryTime => expiryTime > now);
}

// Function to update the extension icon based on strict mode
async function updateExtensionIcon() {
  const { strictMode } = await chrome.storage.sync.get(['strictMode']);

  if (strictMode) {
    // Use strict mode icons
    chrome.action.setIcon({
      path: {
        16: '/images/strict-mode/icon16.png',
        32: '/images/strict-mode/icon32.png',
        48: '/images/strict-mode/icon48.png',
        128: '/images/strict-mode/icon128.png'
      }
    });
  } else {
    // Use default icons
    chrome.action.setIcon({
      path: {
        16: '/images/icon16.png',
        32: '/images/icon32.png',
        48: '/images/icon48.png',
        128: '/images/icon128.png'
      }
    });
  }
}

// Set up default sites on first install or if storage is empty
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await initializeDefaultSites();
  }

  // Set uninstall URL to collect feedback
  chrome.runtime.setUninstallURL('https://ai-site-blocker-feedback.vercel.app');

  // Update icon on install/update
  updateExtensionIcon();
});

// Also check on startup in case storage was cleared
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.sync.get(['allowedSites', 'blockedSites']);
  if (!result.allowedSites && !result.blockedSites) {
    await initializeDefaultSites();
  }
  // Update icon on startup
  updateExtensionIcon();

  // Start badge timer if we have active unblocks
  if (await hasActiveUnblocks()) {
    startBadgeUpdateTimer();
  }
});

async function initializeDefaultSites() {
  const defaultAllowedSites = [
    'remnote.com',
    'calendar.google.com',
    'track.toggl.com',
    'claude.ai',
    'soundcloud.com',
    'pomofocus.io',
    'cronometer.com',
    'developer.mozilla.org',
    'stackoverflow.com',
    'google.com/search',
    'localhost',
  ];

  const defaultBlockedSites = [
    'tiktok.com',
    'linkedin.com',
    'instagram.com',
    'x.com',
    'facebook.com',
    'news.google.com',
    'google.com/search?q=news',
    'youtube.com',
    'photos.google.com',
    'substack.com',
  ];

  await chrome.storage.sync.set({
    allowedSites: defaultAllowedSites,
    blockedSites: defaultBlockedSites,
    strictMode: false,
  });

  console.log('✅ Initialized default sites');
}

// Open options page when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

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

    // Update badge if this is the active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id === tabId) {
      updateBadgeForActiveTab();
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

  // Update badge immediately when switching tabs
  updateBadgeForActiveTab();
});

// Listen for changes to strict mode in storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.strictMode) {
    updateExtensionIcon();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_BLOCKED') {
    checkIfBlocked(message.url).then(sendResponse);
    return true; // Required for async response
  }

  if (message.type === 'UNBLOCK_SITE') {
    unblockSite(message.domain, message.seconds).then((response) => {
      // Start badge timer when a site is unblocked
      startBadgeUpdateTimer();
      sendResponse(response);
    });
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

// Listen for alarms - automatically re-block sites when temporary unblock expires
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('unblock-')) {
    const domain = alarm.name.replace('unblock-', '');
    console.log(`⏰ Unblock expired for ${domain}, checking open tabs...`);

    // Find all tabs with this domain
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        const tabDomain = normalizeUrl(tab.url);
        if (tabDomain === domain) {
          // Redirect to blocked page
          const blockPageUrl = chrome.runtime.getURL('src/blocked/blocked.html') +
            '?url=' + encodeURIComponent(tab.url);
          chrome.tabs.update(tab.id, { url: blockPageUrl });
          console.log(`🚫 Re-blocked tab ${tab.id} for ${domain}`);
        }
      }
    }

    // Check if we still have any active unblocks, if not stop the timer
    if (!(await hasActiveUnblocks())) {
      stopBadgeUpdateTimer();
    } else {
      // Update badge immediately
      updateBadgeForActiveTab();
    }
  }
});

// Check all open tabs when settings change
async function checkAllOpenTabs(): Promise<{ success: boolean }> {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (tab.id && tab.url) {
      // Skip chrome:// and chrome-extension:// URLs (except blocked.html which we handle below)
      if (tab.url.startsWith('chrome://') ||
          (tab.url.startsWith('chrome-extension://') && !tab.url.includes('blocked.html'))) {
        continue;
      }

      // Handle tabs currently on blocked.html
      if (tab.url.includes('blocked.html')) {
        // Extract original URL from query parameter
        const urlParams = new URLSearchParams(new URL(tab.url).search);
        const originalUrl = urlParams.get('url');

        if (originalUrl) {
          // Check if the original URL should still be blocked
          const result = await checkIfBlocked(originalUrl);
          if (!result.blocked) {
            // No longer blocked - redirect back to original URL
            console.log(`✅ Unblocking tab ${tab.id}: ${originalUrl}`);
            chrome.tabs.update(tab.id, { url: originalUrl });
          }
          // If still blocked, leave it on blocked.html
        }
        continue;
      }

      // Handle normal tabs - block if needed
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
