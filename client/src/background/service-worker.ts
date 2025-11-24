console.log('Smart Blocker service worker loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_BLOCKED') {
    checkIfBlocked(message.url).then(sendResponse);
    return true; // Required for async response
  }

  if (message.type === 'UNBLOCK_SITE') {
    unblockSite(message.domain, message.minutes).then(sendResponse);
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
  // Remove + prefix if present (for allowed sites)
  const cleanPattern = pattern.startsWith('+') ? pattern.substring(1) : pattern;

  // Remove protocol and www from pattern
  let cleanDomain = cleanPattern
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
  });

  const allowedSites = result.allowedSites as string[];
  const blockedSites = result.blockedSites as string[];
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;

  // Check if allowed (allowed sites always win)
  for (const pattern of allowedSites) {
    if (matchesDomain(domain, pattern)) {
      console.log(`✓ Allowed: ${domain} matches ${pattern}`);
      return { blocked: false };
    }
  }

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

async function unblockSite(domain: string, minutes: number): Promise<{ success: boolean }> {
  const expiryTime = Date.now() + (minutes * 60 * 1000);

  const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;

  temporaryUnblocks[domain] = expiryTime;
  await chrome.storage.sync.set({ temporaryUnblocks });

  console.log(`⏰ Unblocked ${domain} for ${minutes} minutes (until ${new Date(expiryTime)})`);

  return { success: true };
}
