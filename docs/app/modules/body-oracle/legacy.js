/* Body Oracle — one-time import from the old Body Oracle app's own database.
 *
 * Body Oracle used to keep its data in an IndexedDB database named 'body-oracle' (stores 'items' and 'blobs').
 * When this app is served where Body Oracle used to be, that database is still on the device. On the first
 * launch, everything in it is copied into Christina's database. The old database is only read, never changed
 * or deleted, so it stays as a fallback.
 *
 * It runs only when Christina has no Body Oracle data yet, and records that it ran in meta
 * ('bodyOracleImport'), so it never runs twice. If it is interrupted, the next launch repeats it; every write
 * uses the original ids, so repeating it does not create duplicates. */
import { DB } from '../../core/db.js';
import { BODB, mergeShared } from './store.js';

const OLD_NAME = 'body-oracle';
const MARK = 'bodyOracleImport';

/** Opens the old database if it exists. Never creates it. */
function openOld() {
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(OLD_NAME);
    } catch {
      return resolve(null);
    }
    // An upgrade means the database did not exist: cancel, so nothing is created.
    request.onupgradeneeded = () => request.transaction.abort();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readAll(db, store, keys = false) {
  return new Promise((resolve, reject) => {
    const req = keys ? db.transaction(store).objectStore(store).getAllKeys() : db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Returns the number of entries brought in, or 0 when there was nothing to do. */
async function importLegacyBodyOracle() {
  if (await DB.get('meta', MARK)) return 0;
  const old = await openOld();
  if (!old) return 0;
  try {
    if (!old.objectStoreNames.contains('items')) return 0;
    const items = await readAll(old, 'items');
    if (!items.length) return 0;
    const now = new Date().toISOString();
    // Christina already holds Body Oracle data (set up here, or restored from a backup): leave both as they are.
    if (await DB.get('meta', 'bodyOracle')) {
      await DB.write(['meta'], (tx) => tx.objectStore('meta').put({ key: MARK, skipped: true, reason: 'Body Oracle data already present', at: now }));
      return 0;
    }
    const { items: merged } = mergeShared(items.map((x) => (x.id === 'settings' ? { ...x, type: 'settings' } : x)));
    const settings = merged.find((x) => x.type === 'settings');
    for (const x of merged) if (x.type !== 'settings') await BODB.put(x);
    if (old.objectStoreNames.contains('blobs')) {
      const [keys, blobs] = await Promise.all([readAll(old, 'blobs', true), readAll(old, 'blobs')]);
      for (let i = 0; i < keys.length; i++) if (blobs[i]) await BODB.putBlob(String(keys[i]), blobs[i]);
    }
    // Settings last: their presence is what tells the module that Body Oracle is set up.
    if (settings) await BODB.put({ ...settings, id: 'settings', type: 'settings' });
    const entries = items.filter((x) => x.type === 'entry').length;
    await DB.write(['meta'], (tx) => tx.objectStore('meta').put({ key: MARK, from: OLD_NAME, entries, items: items.length, at: now }));
    return entries;
  } finally {
    old.close();
  }
}

export { importLegacyBodyOracle };
