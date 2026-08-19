import type { TodoReminder } from '../options/types';

/**
 * Reminders used to live in a single `todoReminders` array under one
 * chrome.storage.sync key. chrome.storage.sync caps a *single item* at 8KB
 * (kQuotaBytesPerItem), so once the array crossed that, every further save
 * threw and reminders silently stopped persisting.
 *
 * They are now stored one reminder per key (`rem_<id>`), which gives us the
 * 512-item / 100KB budget instead of 8KB total, and means editing one reminder
 * writes one key rather than rewriting the whole list.
 */

export const REMINDER_KEY_PREFIX = 'rem_';
export const LEGACY_REMINDERS_KEY = 'todoReminders';

/** chrome.storage.sync per-item cap. */
export const SYNC_QUOTA_BYTES_PER_ITEM = 8192;

/** How many shard keys to write per set() call during migration. */
const MIGRATION_CHUNK_SIZE = 20;

export function reminderKey(id: string): string {
  return `${REMINDER_KEY_PREFIX}${id}`;
}

export function isReminderKey(key: string): boolean {
  return key.startsWith(REMINDER_KEY_PREFIX);
}

/**
 * Collision-safe id. The old `Date.now().toString()` collided within a
 * millisecond, which under sharding would silently overwrite a reminder.
 */
export function newReminderId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTodoReminder(value: unknown): value is TodoReminder {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.url === 'string' &&
    typeof item.hostname === 'string' &&
    typeof item.timestamp === 'number' &&
    (item.note === undefined || typeof item.note === 'string')
  );
}

/** Chrome measures an item as the key plus its JSON-serialized value. */
export function itemByteSize(key: string, value: unknown): number {
  return key.length + JSON.stringify(value).length;
}

export class ReminderTooLargeError extends Error {
  readonly size: number;

  constructor(size: number) {
    super(
      `Reminder is ${size} bytes, over the ${SYNC_QUOTA_BYTES_PER_ITEM} byte per-item sync limit. Try a shorter note.`
    );
    this.name = 'ReminderTooLargeError';
    this.size = size;
  }
}

function newestFirst(reminders: TodoReminder[]): TodoReminder[] {
  return [...reminders].sort((a, b) => b.timestamp - a.timestamp);
}

async function readLegacyReminders(): Promise<TodoReminder[] | null> {
  const result = await chrome.storage.sync.get(LEGACY_REMINDERS_KEY);
  const legacy = result[LEGACY_REMINDERS_KEY];
  if (!Array.isArray(legacy)) return null;
  return legacy.filter(isTodoReminder);
}

let migrationPromise: Promise<MigrationResult> | null = null;

/**
 * Run the legacy migration at most once per worker/page lifetime.
 *
 * Every reminder operation goes through this rather than relying on
 * onInstalled/onStartup alone: an MV3 service worker is torn down and
 * restarted constantly, and a user whose worker happened to miss those events
 * would otherwise sit on the broken layout indefinitely.
 */
export function ensureMigrated(): Promise<MigrationResult> {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyReminders().catch((error) => {
      console.error('Reminder migration failed:', error);
      // Reads still work off the union below, so a failure is not fatal.
      return {
        alreadyMigrated: false,
        migrated: 0,
        alreadyPresent: 0,
        invalid: 0,
        tooLarge: 0,
        legacyKeyRemoved: false,
      };
    });
  }
  return migrationPromise;
}

/** Tests only: forget that the migration already ran. */
export function resetMigrationGuardForTests(): void {
  migrationPromise = null;
}

/**
 * All reminders, newest first.
 *
 * Reads the shard keys and unions in anything still sitting in the legacy
 * array, so a half-finished migration (or a second device still running the
 * old build) never makes reminders disappear. Shards win on id.
 */
export async function getAllReminders(): Promise<TodoReminder[]> {
  await ensureMigrated();

  const all = await chrome.storage.sync.get(null);

  const byId = new Map<string, TodoReminder>();

  const legacy = Array.isArray(all[LEGACY_REMINDERS_KEY])
    ? (all[LEGACY_REMINDERS_KEY] as unknown[])
    : [];
  for (const item of legacy) {
    if (isTodoReminder(item)) byId.set(item.id, item);
  }

  for (const [key, value] of Object.entries(all)) {
    if (!isReminderKey(key)) continue;
    if (isTodoReminder(value)) {
      byId.set(value.id, value);
    } else {
      console.warn(`Ignoring malformed reminder at ${key}`);
    }
  }

  return newestFirst([...byId.values()]);
}

/** Write one reminder. Throws ReminderTooLargeError rather than failing silently. */
export async function putReminder(reminder: TodoReminder): Promise<void> {
  await ensureMigrated();

  const key = reminderKey(reminder.id);
  const size = itemByteSize(key, reminder);
  if (size > SYNC_QUOTA_BYTES_PER_ITEM) {
    throw new ReminderTooLargeError(size);
  }
  await chrome.storage.sync.set({ [key]: reminder });
}

export async function addReminder(
  url: string,
  note?: string
): Promise<TodoReminder> {
  const reminder: TodoReminder = {
    id: newReminderId(),
    url,
    hostname: new URL(url).hostname,
    note,
    timestamp: Date.now(),
  };
  await putReminder(reminder);
  return reminder;
}

/**
 * Remove from the shard keys and, if the migration has not finished, from the
 * legacy array too, so a delete cannot be undone by the leftover copy.
 */
export async function removeReminder(id: string): Promise<void> {
  await ensureMigrated();

  await chrome.storage.sync.remove(reminderKey(id));

  const legacy = await readLegacyReminders();
  if (legacy && legacy.some((r) => r.id === id)) {
    await chrome.storage.sync.set({
      [LEGACY_REMINDERS_KEY]: legacy.filter((r) => r.id !== id),
    });
  }
}

export async function updateReminderNote(
  id: string,
  note: string
): Promise<void> {
  const existing = (await getAllReminders()).find((r) => r.id === id);
  if (!existing) return;

  const updated: TodoReminder = { ...existing, note: note || undefined };
  await putReminder(updated);

  // The shard is now the source of truth for this id; drop the stale legacy
  // copy so the union read cannot resurrect the old note.
  const legacy = await readLegacyReminders();
  if (legacy && legacy.some((r) => r.id === id)) {
    await chrome.storage.sync.set({
      [LEGACY_REMINDERS_KEY]: legacy.filter((r) => r.id !== id),
    });
  }
}

export interface MigrationResult {
  /** No legacy key present: nothing to do. */
  alreadyMigrated: boolean;
  migrated: number;
  /** Entries a previous run had already sharded. */
  alreadyPresent: number;
  /** Entries that were not valid reminders and were dropped. */
  invalid: number;
  /** Valid entries too big for a single item; the legacy key is kept for them. */
  tooLarge: number;
  legacyKeyRemoved: boolean;
}

/**
 * Move `todoReminders` to one key per reminder.
 *
 * Ordering is deliberate: write the shards, read them back, and only then
 * delete the legacy key. A crash mid-migration therefore leaves duplicates
 * (which the union read in getAllReminders collapses by id) rather than losing
 * reminders. Safe to run repeatedly.
 */
export async function migrateLegacyReminders(): Promise<MigrationResult> {
  const result: MigrationResult = {
    alreadyMigrated: false,
    migrated: 0,
    alreadyPresent: 0,
    invalid: 0,
    tooLarge: 0,
    legacyKeyRemoved: false,
  };

  const stored = await chrome.storage.sync.get(LEGACY_REMINDERS_KEY);
  const legacy = stored[LEGACY_REMINDERS_KEY];
  if (!Array.isArray(legacy)) {
    result.alreadyMigrated = true;
    return result;
  }

  const existingKeys = new Set(
    Object.keys(await chrome.storage.sync.get(null)).filter(isReminderKey)
  );

  // Mint a fresh id only when it is missing or collides *within the legacy
  // array*. An id that already has a shard is the same reminder from an
  // earlier partial run: overwriting it keeps re-runs idempotent, whereas
  // minting a new id would duplicate it on every retry.
  const seen = new Set<string>();
  const pending: Array<[string, TodoReminder]> = [];
  let alreadyPresent = 0;

  for (const item of legacy) {
    if (!isTodoReminder(item)) {
      result.invalid++;
      continue;
    }

    let reminder = item;
    if (!reminder.id || seen.has(reminder.id)) {
      reminder = { ...reminder, id: newReminderId() };
    }
    seen.add(reminder.id);

    const key = reminderKey(reminder.id);

    // A shard already exists for this id: it was written by an earlier run or
    // by a live edit, either way it is at least as fresh as the legacy copy.
    // Overwriting it here would resurrect a stale note.
    if (existingKeys.has(key)) {
      alreadyPresent++;
      continue;
    }

    if (itemByteSize(key, reminder) > SYNC_QUOTA_BYTES_PER_ITEM) {
      console.error(
        `Reminder ${reminder.id} exceeds the per-item sync limit; leaving it in the legacy key.`
      );
      result.tooLarge++;
      continue;
    }
    pending.push([key, reminder]);
  }

  for (let i = 0; i < pending.length; i += MIGRATION_CHUNK_SIZE) {
    const chunk = pending.slice(i, i + MIGRATION_CHUNK_SIZE);
    try {
      await chrome.storage.sync.set(Object.fromEntries(chunk));
    } catch (error) {
      // One bad key must not take the other 19 down with it.
      console.warn(
        'Chunked reminder migration failed, retrying individually',
        error
      );
      for (const [key, reminder] of chunk) {
        try {
          await chrome.storage.sync.set({ [key]: reminder });
        } catch (itemError) {
          console.error(`Could not migrate reminder ${key}`, itemError);
        }
      }
    }
  }

  // Verify the shards landed before destroying the source.
  const after = await chrome.storage.sync.get(null);
  const written = pending.filter(([key]) => isTodoReminder(after[key]));
  result.migrated = written.length;
  result.alreadyPresent = alreadyPresent;

  if (written.length === pending.length && result.tooLarge === 0) {
    await chrome.storage.sync.remove(LEGACY_REMINDERS_KEY);
    result.legacyKeyRemoved = true;
  } else {
    console.error(
      `Keeping ${LEGACY_REMINDERS_KEY}: ${pending.length - written.length} reminder(s) failed to write, ${result.tooLarge} too large.`
    );
  }

  return result;
}
