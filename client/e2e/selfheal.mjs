/**
 * Real-Chrome test of the migration + self-healing path, using only the NEW
 * build so no stale-service-worker artifacts are involved.
 *
 *   1. fresh profile, new build
 *   2. seed the legacy `todoReminders` array (the broken layout)
 *   3. stop the service worker, which MV3 does constantly anyway
 *   4. save a reminder, waking a fresh worker
 *   5. assert the legacy array was migrated, nothing lost, and saving works
 */
import { PipeBrowser } from './pipe.mjs';

const browser = PipeBrowser.launch({ profile: process.env.PROFILE || '.e2e-profile' });
await new Promise((r) => setTimeout(r, 2500));

const LEGACY_COUNT = 40;

try {
  const { id } = await browser.send('Extensions.loadUnpacked', { path: process.env.EXT || new URL('../../dist', import.meta.url).pathname });
  await new Promise((r) => setTimeout(r, 4000));

  const url = `chrome-extension://${id}/src/options/options.html`;
  const { targetId } = await browser.send('Target.createTarget', { url });
  await new Promise((r) => setTimeout(r, 2500));
  const page = await browser.attach(targetId);
  await browser.send('Runtime.enable', {}, page);

  const seeded = await browser.evaluate(
    page,
    `
    await chrome.storage.sync.clear();
    const reminders = [];
    for (let i = 0; i < ${LEGACY_COUNT}; i++) {
      reminders.push({
        id: String(1700000000000 + i),
        url: 'https://example.com/some/article/path/' + i,
        hostname: 'example.com',
        note: 'Reminder number ' + i + ' with a realistic note on it',
        timestamp: 1700000000000 + i,
      });
    }
    await chrome.storage.sync.set({ todoReminders: reminders });
    const all = await chrome.storage.sync.get(null);
    return {
      legacyLength: all.todoReminders.length,
      shards: Object.keys(all).filter((k) => k.startsWith('rem_')).length,
    };
  `
  );
  console.log('seeded legacy layout:', JSON.stringify(seeded));

  // Stop the worker so the next event starts a fresh one.
  const sw = (await browser.targets()).find(
    (t) => t.type === 'service_worker' && t.url.includes(id)
  );
  if (sw) {
    await browser.send('Target.closeTarget', { targetId: sw.targetId });
    console.log('stopped the service worker');
  } else {
    console.log('worker was already stopped');
  }
  await new Promise((r) => setTimeout(r, 2000));

  const saved = await browser.evaluate(
    page,
    `
    const res = await chrome.runtime.sendMessage({
      type: 'ADD_TODO_REMINDER',
      url: 'https://example.com/brand/new',
      note: 'saved after migration',
    });
    return res;
  `
  );
  console.log('save through a fresh worker:', JSON.stringify(saved));

  await new Promise((r) => setTimeout(r, 1500));

  const final = await browser.evaluate(
    page,
    `
    const all = await chrome.storage.sync.get(null);
    const shardKeys = Object.keys(all).filter((k) => k.startsWith('rem_'));
    const notes = shardKeys.map((k) => all[k].note);
    return {
      legacyKeyStillPresent: 'todoReminders' in all,
      shards: shardKeys.length,
      uniqueIds: new Set(shardKeys.map((k) => all[k].id)).size,
      originalsPreserved: notes.filter((n) => /^Reminder number \\d+ /.test(n)).length,
      keptFirstOriginal: notes.includes('Reminder number 0 with a realistic note on it'),
      keptLastOriginal: notes.includes('Reminder number ${LEGACY_COUNT - 1} with a realistic note on it'),
      newOneSaved: notes.includes('saved after migration'),
    };
  `
  );
  console.log('final:', JSON.stringify(final, null, 2));

  const expected =
    final.legacyKeyStillPresent === false &&
    final.shards === LEGACY_COUNT + 1 &&
    final.uniqueIds === LEGACY_COUNT + 1 &&
    final.originalsPreserved === LEGACY_COUNT &&
    final.keptFirstOriginal &&
    final.keptLastOriginal &&
    final.newOneSaved;
  console.log(expected ? 'RESULT: PASS' : 'RESULT: FAIL');
} finally {
  await browser.close();
}
