import { checkIfBlocked, normalizeUrl } from './utils/blocking';
import { validateUnblockReason } from './services/ai-validation';
import { unblockSite, addTodoReminder, removeTodoReminder } from './services/storage';

console.log('AI Site Blocker service worker loaded');

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
    unblockSite(message.domain, message.seconds).then(sendResponse);
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
  }
});

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
