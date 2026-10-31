/* Christina — all data stays on this device (IndexedDB). No sync, no cloud, no API. */
// Store layout and upgrades live in schema.js.
import { DB_NAME, DB_VERSION, upgrade } from './schema.js';

const DB = {
  db: null,
  /** Counts completed writes, so a module can tell when its in-memory copy is out of date. */
  generation: 0,

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => upgrade(request.result, request.transaction, event.oldVersion);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('The database is open in another tab. Close it and try again.'));
    });
  },

  getAll(store) {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  get(store, key) {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /** Runs `work(tx)` in one atomic transaction. */
  write(stores, work) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, 'readwrite');
      tx.oncomplete = () => {
        this.generation++;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('The change was not saved.'));
      try {
        work(tx);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  },
};

/** Loaded data. `records` holds every kind; `categories` is sorted by `order`. */
const data = { records: [], threads: [], months: {}, categories: [], tags: [] };

const fileURLs = new Map();
async function fileURL(key) {
  if (fileURLs.has(key)) return fileURLs.get(key);
  const record = await DB.get('files', key);
  if (!record) return null;
  // Christina stores { type, data }; Body Oracle media is stored as a Blob.
  const blob = record instanceof Blob ? record : new Blob([record.data], { type: record.type });
  const url = URL.createObjectURL(blob);
  fileURLs.set(key, url);
  return url;
}
function forgetFileURL(key) {
  const url = fileURLs.get(key);
  if (url) URL.revokeObjectURL(url);
  fileURLs.delete(key);
}

async function blobRecord(blob) {
  return { type: blob.type || 'image/jpeg', data: await blob.arrayBuffer() };
}

let persistRequested = false;
function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
export { DB, data, fileURL, forgetFileURL, blobRecord, requestPersistence };
