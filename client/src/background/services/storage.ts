import type { AccessAttempt } from '../../options/types';
import {
  addReminder,
  removeReminder,
  updateReminderNote,
} from '../../lib/reminders';

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

export async function addTodoReminder(
  url: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const reminder = await addReminder(url, note);
    console.log('Added todo reminder:', reminder);
    return { success: true };
  } catch (error) {
    // This used to reject unhandled: the reminder vanished with no feedback.
    console.error('Failed to add todo reminder:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function removeTodoReminder(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await removeReminder(id);
    console.log('Removed todo reminder:', id);
    return { success: true };
  } catch (error) {
    console.error('Failed to remove todo reminder:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTodoReminder(
  id: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateReminderNote(id, note);
    console.log('Updated todo reminder:', id, note);
    return { success: true };
  } catch (error) {
    console.error('Failed to update todo reminder:', error);
    return { success: false, error: (error as Error).message };
  }
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
