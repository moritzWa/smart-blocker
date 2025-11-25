export interface TodoReminder {
  id: string;
  url: string;
  hostname: string;
  note?: string;
  timestamp: number;
}

export async function unblockSite(domain: string, minutes: number): Promise<{ success: boolean }> {
  const expiryTime = Date.now() + (minutes * 60 * 1000);

  const result = await chrome.storage.sync.get({ temporaryUnblocks: {} });
  const temporaryUnblocks = result.temporaryUnblocks as Record<string, number>;

  temporaryUnblocks[domain] = expiryTime;
  await chrome.storage.sync.set({ temporaryUnblocks });

  console.log(`⏰ Unblocked ${domain} for ${minutes} minutes (until ${new Date(expiryTime)})`);

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
