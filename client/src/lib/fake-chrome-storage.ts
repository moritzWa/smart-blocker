/**
 * A chrome.storage.sync stand-in that enforces the real quotas, so tests can
 * reproduce the kQuotaBytesPerItem failure rather than assume it.
 *
 * Limits per Chrome docs:
 *   QUOTA_BYTES              102400  total
 *   QUOTA_BYTES_PER_ITEM       8192  per item (key length + JSON value)
 *   MAX_ITEMS                   512
 */

export const QUOTA_BYTES = 102400;
export const QUOTA_BYTES_PER_ITEM = 8192;
export const MAX_ITEMS = 512;

export interface FakeSyncStorage {
  area: {
    get(keys?: null | string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    clear(): Promise<void>;
  };
  /** Write past the quota, to set up a state Chrome itself would have reached
   *  incrementally (e.g. a legacy array that grew to the item limit). */
  seed(items: Record<string, unknown>): void;
  raw(): Record<string, unknown>;
  keys(): string[];
  /** Fail the next N set() calls, to simulate a mid-migration crash. */
  failSetsAfter(successfulCalls: number): void;
  setCallCount(): number;
}

function itemSize(key: string, value: unknown): number {
  return key.length + JSON.stringify(value).length;
}

export function createFakeSyncStorage(): FakeSyncStorage {
  let store: Record<string, unknown> = {};
  let setCalls = 0;
  let failAfter = Infinity;

  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  const area: FakeSyncStorage['area'] = {
    async get(keys) {
      if (keys === undefined || keys === null) return clone(store);

      if (typeof keys === 'string') {
        return keys in store ? { [keys]: clone(store[keys]) } : {};
      }

      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in store) out[key] = clone(store[key]);
        }
        return out;
      }

      // Object form supplies defaults for missing keys.
      const out: Record<string, unknown> = {};
      for (const [key, fallback] of Object.entries(keys)) {
        out[key] = key in store ? clone(store[key]) : fallback;
      }
      return out;
    },

    async set(items) {
      setCalls++;
      if (setCalls > failAfter) {
        throw new Error('Simulated storage failure');
      }

      for (const [key, value] of Object.entries(items)) {
        const size = itemSize(key, value);
        if (size > QUOTA_BYTES_PER_ITEM) {
          throw new Error('Resource::kQuotaBytesPerItem quota exceeded');
        }
      }

      const next = { ...store, ...clone(items) };

      if (Object.keys(next).length > MAX_ITEMS) {
        throw new Error('MAX_ITEMS quota exceeded');
      }

      const total = Object.entries(next).reduce(
        (sum, [key, value]) => sum + itemSize(key, value),
        0
      );
      if (total > QUOTA_BYTES) {
        throw new Error('QUOTA_BYTES quota exceeded');
      }

      store = next;
    },

    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete store[key];
      }
    },

    async clear() {
      store = {};
    },
  };

  return {
    area,
    seed(items) {
      store = { ...store, ...clone(items) };
    },
    raw: () => clone(store),
    keys: () => Object.keys(store),
    failSetsAfter(successfulCalls) {
      failAfter = successfulCalls;
    },
    setCallCount: () => setCalls,
  };
}

/** Installs the fake as the global `chrome` for a test. */
export function installFakeChrome(): FakeSyncStorage {
  const fake = createFakeSyncStorage();
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { sync: fake.area },
  };
  return fake;
}
