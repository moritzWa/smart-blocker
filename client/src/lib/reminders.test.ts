import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installFakeChrome,
  QUOTA_BYTES_PER_ITEM,
  type FakeSyncStorage,
} from './fake-chrome-storage';
import {
  addReminder,
  getAllReminders,
  isReminderKey,
  LEGACY_REMINDERS_KEY,
  migrateLegacyReminders,
  putReminder,
  ReminderTooLargeError,
  removeReminder,
  reminderKey,
  resetMigrationGuardForTests,
  updateReminderNote,
} from './reminders';
import type { TodoReminder } from '../options/types';

let storage: FakeSyncStorage;

beforeEach(() => {
  storage = installFakeChrome();
  resetMigrationGuardForTests();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function makeReminder(i: number, note = `note ${i}`): TodoReminder {
  return {
    id: `id-${i}`,
    url: `https://example.com/article/${i}`,
    hostname: 'example.com',
    note,
    timestamp: 1_700_000_000_000 + i,
  };
}

/** The shape the user actually hit: reminders packed into one array key. */
async function legacySave(reminders: TodoReminder[]) {
  await chrome.storage.sync.set({ [LEGACY_REMINDERS_KEY]: reminders });
}

describe('the bug, reproduced against the old single-key layout', () => {
  it('throws kQuotaBytesPerItem once the array crosses 8KB', async () => {
    const reminders: TodoReminder[] = [];
    let thrown: Error | null = null;
    let saved = 0;

    for (let i = 0; i < 200; i++) {
      reminders.unshift(makeReminder(i));
      try {
        await legacySave(reminders);
        saved = reminders.length;
      } catch (error) {
        thrown = error as Error;
        break;
      }
    }

    expect(thrown?.message).toBe('Resource::kQuotaBytesPerItem quota exceeded');
    // It dies well before any sane reminder count.
    expect(saved).toBeLessThan(100);
    expect(saved).toBeGreaterThan(10);
  });
});

describe('one key per reminder', () => {
  it('stores far more reminders than the old layout could', async () => {
    for (let i = 0; i < 300; i++) {
      await addReminder(`https://example.com/article/${i}`, `note ${i}`);
    }

    const all = await getAllReminders();
    expect(all).toHaveLength(300);
    expect(storage.keys().filter(isReminderKey)).toHaveLength(300);
  });

  it('mints unique ids for reminders added in the same millisecond', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    for (let i = 0; i < 25; i++) {
      await addReminder(`https://example.com/${i}`);
    }
    vi.restoreAllMocks();

    expect(await getAllReminders()).toHaveLength(25);
  });

  it('returns reminders newest first', async () => {
    await putReminder(makeReminder(1));
    await putReminder(makeReminder(3));
    await putReminder(makeReminder(2));

    expect((await getAllReminders()).map((r) => r.id)).toEqual([
      'id-3',
      'id-2',
      'id-1',
    ]);
  });

  it('writes only the touched key when editing', async () => {
    await putReminder(makeReminder(1));
    await putReminder(makeReminder(2));
    const before = storage.setCallCount();

    await updateReminderNote('id-1', 'edited');

    expect(storage.setCallCount()).toBe(before + 1);
    const found = (await getAllReminders()).find((r) => r.id === 'id-1');
    expect(found?.note).toBe('edited');
  });

  it('reports an oversized single reminder instead of failing silently', async () => {
    const huge = makeReminder(1, 'x'.repeat(QUOTA_BYTES_PER_ITEM));
    await expect(putReminder(huge)).rejects.toBeInstanceOf(
      ReminderTooLargeError
    );
  });

  it('removes a reminder', async () => {
    await putReminder(makeReminder(1));
    await putReminder(makeReminder(2));

    await removeReminder('id-1');

    expect((await getAllReminders()).map((r) => r.id)).toEqual(['id-2']);
  });

  it('ignores a malformed shard rather than breaking the whole list', async () => {
    await putReminder(makeReminder(1));
    storage.seed({ [reminderKey('junk')]: { nope: true } });

    expect((await getAllReminders()).map((r) => r.id)).toEqual(['id-1']);
  });
});

describe('migration off the legacy array', () => {
  it('moves a full legacy array onto shards and drops the legacy key', async () => {
    const legacy = Array.from({ length: 40 }, (_, i) => makeReminder(i));
    storage.seed({ [LEGACY_REMINDERS_KEY]: legacy });

    const result = await migrateLegacyReminders();

    expect(result.migrated).toBe(40);
    expect(result.legacyKeyRemoved).toBe(true);
    expect(storage.raw()[LEGACY_REMINDERS_KEY]).toBeUndefined();

    const all = await getAllReminders();
    expect(all).toHaveLength(40);
    expect(all.map((r) => r.id).sort()).toEqual(legacy.map((r) => r.id).sort());
    expect(all.find((r) => r.id === 'id-7')?.note).toBe('note 7');
  });

  it('migrates a legacy array that is already over the per-item quota', async () => {
    // The real broken state: the key grew until saves started throwing.
    const legacy = Array.from({ length: 120 }, (_, i) => makeReminder(i));
    storage.seed({ [LEGACY_REMINDERS_KEY]: legacy });
    expect(
      JSON.stringify(legacy).length + LEGACY_REMINDERS_KEY.length
    ).toBeGreaterThan(QUOTA_BYTES_PER_ITEM);

    await migrateLegacyReminders();

    expect(await getAllReminders()).toHaveLength(120);
    // And saving still works afterwards, which is the whole point.
    await expect(
      addReminder('https://example.com/new', 'after migration')
    ).resolves.toBeTruthy();
    expect(await getAllReminders()).toHaveLength(121);
  });

  it('is a no-op when there is no legacy key', async () => {
    const result = await migrateLegacyReminders();
    expect(result.alreadyMigrated).toBe(true);
    expect(result.migrated).toBe(0);
  });

  it('is idempotent: running it twice creates no duplicates', async () => {
    storage.seed({
      [LEGACY_REMINDERS_KEY]: Array.from({ length: 10 }, (_, i) =>
        makeReminder(i)
      ),
    });

    await migrateLegacyReminders();
    const second = await migrateLegacyReminders();

    expect(second.alreadyMigrated).toBe(true);
    expect(await getAllReminders()).toHaveLength(10);
  });

  it('re-mints ids that collide inside the legacy array', async () => {
    const dupe = makeReminder(1);
    storage.seed({
      [LEGACY_REMINDERS_KEY]: [dupe, { ...dupe, note: 'second' }],
    });

    await migrateLegacyReminders();

    const all = await getAllReminders();
    expect(all).toHaveLength(2);
    expect(new Set(all.map((r) => r.id)).size).toBe(2);
    expect(all.map((r) => r.note).sort()).toEqual(['note 1', 'second']);
  });

  it('drops entries that are not reminders', async () => {
    storage.seed({
      [LEGACY_REMINDERS_KEY]: [makeReminder(1), null, 'nope', { id: 5 }],
    });

    const result = await migrateLegacyReminders();

    expect(result.invalid).toBe(3);
    expect(await getAllReminders()).toHaveLength(1);
  });

  it('keeps the legacy key when a reminder is too big to shard', async () => {
    storage.seed({
      [LEGACY_REMINDERS_KEY]: [
        makeReminder(1),
        makeReminder(2, 'x'.repeat(QUOTA_BYTES_PER_ITEM)),
      ],
    });

    const result = await migrateLegacyReminders();

    expect(result.tooLarge).toBe(1);
    expect(result.legacyKeyRemoved).toBe(false);
    // Nothing is lost: the oversized one is still readable via the legacy key.
    expect((await getAllReminders()).map((r) => r.id).sort()).toEqual([
      'id-1',
      'id-2',
    ]);
  });

  it('survives a crash mid-migration without losing or duplicating reminders', async () => {
    const legacy = Array.from({ length: 50 }, (_, i) => makeReminder(i));
    storage.seed({ [LEGACY_REMINDERS_KEY]: legacy });

    // Die after the first chunk, before the legacy key is deleted.
    storage.failSetsAfter(1);
    await migrateLegacyReminders();

    // Partially sharded, legacy key intact: nothing lost.
    expect(storage.raw()[LEGACY_REMINDERS_KEY]).toBeDefined();
    expect(storage.keys().filter(isReminderKey).length).toBeGreaterThan(0);
    expect(await getAllReminders()).toHaveLength(50);

    // Recover on the next run.
    storage.failSetsAfter(Infinity);
    const retry = await migrateLegacyReminders();

    expect(retry.legacyKeyRemoved).toBe(true);
    const all = await getAllReminders();
    expect(all).toHaveLength(50);
    expect(new Set(all.map((r) => r.id)).size).toBe(50);
  });
});

describe('self-healing without any lifecycle event', () => {
  it('migrates on first read, without onInstalled or onStartup', async () => {
    storage.seed({
      [LEGACY_REMINDERS_KEY]: Array.from({ length: 8 }, (_, i) =>
        makeReminder(i)
      ),
    });

    const all = await getAllReminders();

    expect(all).toHaveLength(8);
    expect(storage.keys().filter(isReminderKey)).toHaveLength(8);
    expect(storage.raw()[LEGACY_REMINDERS_KEY]).toBeUndefined();
  });

  it('migrates on first write, without onInstalled or onStartup', async () => {
    storage.seed({
      [LEGACY_REMINDERS_KEY]: [makeReminder(1)],
    });

    await addReminder('https://example.com/fresh', 'fresh');

    expect(storage.raw()[LEGACY_REMINDERS_KEY]).toBeUndefined();
    expect(await getAllReminders()).toHaveLength(2);
  });

  it('runs the migration only once per lifetime', async () => {
    storage.seed({ [LEGACY_REMINDERS_KEY]: [makeReminder(1)] });

    await getAllReminders();
    const setsAfterFirst = storage.setCallCount();
    await getAllReminders();
    await getAllReminders();

    expect(storage.setCallCount()).toBe(setsAfterFirst);
  });
});

describe('transitional state, with a legacy key still present', () => {
  it('never lets the legacy copy overwrite a newer shard', async () => {
    storage.seed({
      [LEGACY_REMINDERS_KEY]: [makeReminder(1, 'stale'), makeReminder(2)],
      [reminderKey('id-1')]: makeReminder(1, 'fresh'),
    });

    const all = await getAllReminders();

    expect(all).toHaveLength(2);
    expect(all.find((r) => r.id === 'id-1')?.note).toBe('fresh');
  });

  it('a delete is not resurrected by the leftover legacy copy', async () => {
    storage.seed({
      [LEGACY_REMINDERS_KEY]: [makeReminder(1), makeReminder(2)],
      [reminderKey('id-1')]: makeReminder(1),
    });

    await removeReminder('id-1');

    expect((await getAllReminders()).map((r) => r.id)).toEqual(['id-2']);
  });

  it('an edit is not resurrected by the leftover legacy copy', async () => {
    storage.seed({
      [LEGACY_REMINDERS_KEY]: [makeReminder(1, 'stale')],
    });

    await updateReminderNote('id-1', 'edited');

    const all = await getAllReminders();
    expect(all).toHaveLength(1);
    expect(all[0].note).toBe('edited');
  });
});
