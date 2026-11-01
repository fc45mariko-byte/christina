/* Christina — export. A full backup (JSON, photos included) and an events-only CSV.
 * Nothing leaves the device unless the person chooses where to save or share the file. */
import { DB, data } from '../core/db.js';
import { ymd } from '../core/util.js';
import { DATA_STORES, DB_VERSION, activityFromV1, threadFromV1, presetCategories } from '../core/schema.js';
import { threadById, categoryById, recordCategoryId, recordThreadId, recordDuration } from '../core/queries.js';

const BACKUP_FORMAT = 'christina-backup';
// Version 2: every data store of database schema 2, under `stores`.
const BACKUP_VERSION = 2;

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('A photo could not be read.'));
    reader.readAsDataURL(blob);
  });
}

function allFiles() {
  return new Promise((resolve, reject) => {
    const tx = DB.db.transaction('files');
    const store = tx.objectStore('files');
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();
    tx.oncomplete = () => resolve(keysReq.result.map((key, i) => [key, valsReq.result[i]]));
    tx.onerror = () => reject(tx.error);
  });
}

function readPrefs() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('christina.')) out[key.slice('christina.'.length)] = JSON.parse(localStorage.getItem(key));
    }
  } catch {
    /* private mode — no stored preferences */
  }
  return out;
}

/** Hands the file to the share sheet when the device offers one (iPhone), otherwise downloads it.
 *  Returns 'saved', or 'cancelled' if the person closed the share sheet. */
async function deliver(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'saved';
    } catch (error) {
      if (error && error.name === 'AbortError') return 'cancelled';
      /* share failed for another reason — fall back to a download */
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}

async function buildBackup() {
  const files = {};
  for (const [key, record] of await allFiles()) {
    if (record instanceof Blob) files[key] = await blobToDataURL(record);
    else if (record && record.data) files[key] = await blobToDataURL(new Blob([record.data], { type: record.type || 'image/jpeg' }));
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    schemaVersion: DB_VERSION,
    prefs: readPrefs(),
    stores: Object.fromEntries(await Promise.all(DATA_STORES.map(async (name) => [name, await DB.getAll(name)]))),
    // Settings kept in meta (e.g. the Rituals section's "For tonight" and situations).
    settings: (await DB.getAll('meta')).filter((m) => m.key !== 'schema'),
    files,
  };
}

async function exportBackup() {
  const json = JSON.stringify(await buildBackup());
  const file = new File([json], `christina-backup-${ymd(new Date())}.json`, { type: 'application/json' });
  return deliver(file);
}

const CSV_COLUMNS = ['date', 'title', 'category', 'duration_min', 'thread', 'thread_start', 'thread_end', 'notes', 'has_photo', 'archived', 'id'];

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildEventsCSV() {
  const rows = data.records
    .filter((r) => r.kind === 'activity')
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((e) => {
      const threadId = recordThreadId(e);
      const t = threadId ? threadById(threadId) : null;
      return [
        e.occurredAt,
        e.title,
        categoryById(recordCategoryId(e)).name,
        recordDuration(e),
        t ? t.title : '',
        t ? t.startDate : '',
        t ? t.endDate || '' : '',
        e.text,
        (e.mediaIds || []).length ? 'yes' : 'no',
        e.archived ? 'yes' : 'no',
        e.id,
      ];
    });
  return [CSV_COLUMNS, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

async function exportEventsCSV() {
  // Byte-order mark so spreadsheet apps read accents correctly.
  const file = new File(['﻿' + buildEventsCSV()], `christina-events-${ymd(new Date())}.csv`, { type: 'text/csv' });
  return deliver(file);
}

export { exportBackup, exportEventsCSV, buildBackup, buildEventsCSV, BACKUP_FORMAT, BACKUP_VERSION };

// ------------------------------------------------------------ restore and erase

function dataURLToBlob(url) {
  const [head, body] = url.split(',');
  const type = (/data:([^;]+)/.exec(head) || [])[1] || 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Reads a Christina backup file (format version 1 or 2) and describes it, without changing anything. */
async function readBackup(file) {
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not a Christina backup.');
  }
  if (!backup || backup.format !== BACKUP_FORMAT) {
    if (backup && backup.app === 'body-oracle') throw new Error('This is a backup from the Body Oracle app. Use “Import from the Body Oracle app” instead.');
    throw new Error('That file is not a Christina backup.');
  }
  const records = backup.version >= 2 ? (backup.stores.records || []).length : (backup.events || []).length;
  const files = Object.keys(backup.files || {}).length;
  return {
    data: backup,
    when: new Date(backup.exportedAt).toLocaleString(),
    summary: `${records} ${records === 1 ? 'record' : 'records'} and ${files} ${files === 1 ? 'photo' : 'photos'}`,
  };
}

/** Replaces everything with the backup, in one transaction: if anything fails, nothing changes. */
async function restoreBackup(backup) {
  const now = new Date().toISOString();
  let stores;
  if (backup.version >= 2) {
    stores = backup.stores;
  } else {
    stores = {
      records: (backup.events || []).map((e) => activityFromV1(e, now)),
      threads: (backup.threads || []).map((t) => threadFromV1(t, now)),
      months: backup.months || [],
      categories: presetCategories(now),
    };
  }
  const files = Object.entries(backup.files || {}).map(([key, url]) => [key, dataURLToBlob(url)]);
  await DB.write([...DATA_STORES, 'files', 'meta'], (tx) => {
    for (const name of DATA_STORES) {
      const store = tx.objectStore(name);
      store.clear();
      (stores[name] || []).forEach((row) => store.put(row));
    }
    if (!(stores.categories || []).length) presetCategories(now).forEach((c) => tx.objectStore('categories').put(c));
    const fileStore = tx.objectStore('files');
    fileStore.clear();
    files.forEach(([key, blob]) => fileStore.put(blob, key));
    const meta = tx.objectStore('meta');
    (backup.settings || []).forEach((row) => row.key !== 'schema' && meta.put(row));
    // Don't bring the old Body Oracle database in on top of a restored backup.
    meta.put({ key: 'bodyOracleImport', skipped: true, reason: 'restored from a backup', at: now });
  });
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('christina.')) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(backup.prefs || {})) localStorage.setItem(`christina.${key}`, JSON.stringify(value));
  } catch {
    /* private mode — preferences stay as they are */
  }
}

/** Deletes everything Christina holds on this device. The old Body Oracle database is not brought back in. */
async function eraseEverything() {
  const now = new Date().toISOString();
  await DB.write([...DATA_STORES, 'files', 'meta', 'legacy'], (tx) => {
    DATA_STORES.forEach((name) => tx.objectStore(name).clear());
    tx.objectStore('files').clear();
    tx.objectStore('legacy').clear();
    tx.objectStore('meta').clear();
    tx.objectStore('meta').put({ key: 'schema', version: DB_VERSION, erasedAt: now });
    tx.objectStore('meta').put({ key: 'bodyOracleImport', skipped: true, reason: 'erased', at: now });
    presetCategories(now).forEach((c) => tx.objectStore('categories').put(c));
  });
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('christina.')) localStorage.removeItem(key);
  } catch {
    /* nothing stored */
  }
}

export { readBackup, restoreBackup, eraseEverything };
