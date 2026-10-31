/* Christina — all data stays on this device (IndexedDB). No sync, no cloud, no API. */
// Stores: events, threads, months (MonthPersonalization), files.
// Files are keyed like the spec's folder layout:
//   photos/<UUID>.jpg  and  months/<YYYY-MM>/<UUID>.jpg

const DB = {
  db: null,

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('christina', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('events', { keyPath: 'id' });
        db.createObjectStore('threads', { keyPath: 'id' });
        db.createObjectStore('months', { keyPath: 'month' });
        db.createObjectStore('files');
      };
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
      tx.oncomplete = () => resolve();
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

const data = { events: [], threads: [], months: {} };

const fileURLs = new Map();
async function fileURL(key) {
  if (fileURLs.has(key)) return fileURLs.get(key);
  const record = await DB.get('files', key);
  if (!record) return null;
  const url = URL.createObjectURL(new Blob([record.data], { type: record.type }));
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
