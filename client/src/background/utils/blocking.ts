export function normalizeUrl(url: string): string {
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

export function matchesDomain(domain: string, pattern: string): boolean {
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

export async function checkIfBlocked(url: string): Promise<{ blocked: boolean }> {
  // Never block chrome:// or chrome-extension:// URLs
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return { blocked: false };
  }

  // Always allow Chrome Web Store extension page (for leaving reviews)
  if (url.includes('chromewebstore.google.com/detail/focus-shield-ai-site-dist/ibmmihgadnkilmknmfmohlclogcifboj')) {
    console.log('✅ Chrome Web Store extension page always allowed');
    return { blocked: false };
  }

  const domain = normalizeUrl(url);

  if (!domain) {
    return { blocked: false };
  }

  // Get settings from storage
  const result = await chrome.storage.sync.get({
    allowedSites: [],
    blockedSites: [],
    temporaryUnblocks: {},
    strictMode: false,
    distractionModeExpiry: null,
    todoReminders: [],
  });

  const allowedSites = result.allowedSites as string[];
  const blockedSites = result.blockedSites as string[];
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;
  const strictMode = result.strictMode as boolean;
  const distractionModeExpiry = result.distractionModeExpiry as number | null;
  const todoReminders = result.todoReminders as Array<{ hostname: string }>;

  console.log('🔍 Checking:', domain, { strictMode, allowedSites, blockedSites });

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

  // Check if distraction mode is active and domain is in todo reminders
  if (distractionModeExpiry && Date.now() < distractionModeExpiry) {
    const isTodoReminderDomain = todoReminders.some(
      (reminder) => matchesDomain(domain, reminder.hostname)
    );
    if (isTodoReminderDomain) {
      console.log(
        `🎯 Distraction mode: allowing todo reminder domain ${domain}`
      );
      return { blocked: false };
    }
  }

  // Check if in allowed list
  const isAllowed = allowedSites.some(pattern => matchesDomain(domain, pattern));

  if (strictMode) {
    // Strict Mode: Block everything EXCEPT allowed sites
    if (isAllowed) {
      console.log(`✓ Allowed in Strict Mode: ${domain}`);
      return { blocked: false };
    } else {
      console.log(`🚫 Blocked in Strict Mode: ${domain}`);
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
