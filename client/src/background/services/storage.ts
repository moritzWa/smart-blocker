export interface TodoReminder {
  id: string;
  url: string;
  hostname: string;
  note?: string;
  timestamp: number;
}

export interface AccessAttempt {
  id: string;
  domain: string;
  reason: string;
  timestamp: number;
  outcome: 'approved' | 'rejected' | 'reminder' | 'abandoned' | 'blocked';
  durationSeconds?: number; // only for approved
  aiMessage?: string;
}

export async function unblockSite(domain: string, seconds: number): Promise<{ success: boolean }> {
  const expiryTime = Date.now() + (seconds * 1000);

  const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;

  temporaryUnblocks[domain] = expiryTime;
  await chrome.storage.sync.set({ temporaryUnblocks });

  // Schedule alarm to re-block when it expires
  await chrome.alarms.create(`unblock-${domain}`, {
    when: expiryTime
  });

  console.log(`⏰ Unblocked ${domain} for ${seconds} seconds (until ${new Date(expiryTime)})`);

  return { success: true };
}

export async function addTodoReminder(url: string, note?: string): Promise<{ success: boolean }> {
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

export async function removeTodoReminder(id: string): Promise<{ success: boolean }> {
  const result = await chrome.storage.sync.get({ todoReminders: [] });
  const todoReminders = result.todoReminders as TodoReminder[];

  const filtered = todoReminders.filter(r => r.id !== id);
  await chrome.storage.sync.set({ todoReminders: filtered });

  console.log('Removed todo reminder:', id);
  return { success: true };
}

export async function updateTodoReminder(id: string, note: string): Promise<{ success: boolean }> {
  const result = await chrome.storage.sync.get({ todoReminders: [] });
  const todoReminders = result.todoReminders as TodoReminder[];

  const updated = todoReminders.map(r =>
    r.id === id ? { ...r, note: note || undefined } : r
  );
  await chrome.storage.sync.set({ todoReminders: updated });

  console.log('Updated todo reminder:', id, note);
  return { success: true };
}

// Access history functions (using local storage for larger capacity)
export async function saveAccessAttempt(attempt: Omit<AccessAttempt, 'id'>): Promise<void> {
  const result = await chrome.storage.local.get({ accessHistory: [] });
  const accessHistory = result.accessHistory as AccessAttempt[];

  const newAttempt: AccessAttempt = {
    ...attempt,
    id: Date.now().toString(),
  };

  accessHistory.unshift(newAttempt);

  // Keep last 500 attempts to avoid storage limits
  const trimmed = accessHistory.slice(0, 500);
  await chrome.storage.local.set({ accessHistory: trimmed });

  console.log('📊 Saved access attempt:', newAttempt);
}

export async function getAccessHistory(domain?: string, hoursBack = 24): Promise<AccessAttempt[]> {
  const result = await chrome.storage.local.get({ accessHistory: [] });
  const accessHistory = result.accessHistory as AccessAttempt[];

  const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);

  return accessHistory.filter(a =>
    a.timestamp > cutoff && (!domain || a.domain === domain)
  );
}

export async function getAllAccessHistory(): Promise<AccessAttempt[]> {
  const result = await chrome.storage.local.get({ accessHistory: [] });
  return result.accessHistory as AccessAttempt[];
}
