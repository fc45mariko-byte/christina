/* Christina — export. A full backup (JSON, photos included) and an events-only CSV.
 * Nothing leaves the device unless the person chooses where to save or share the file. */
import { DB, data } from '../core/db.js';
import { ymd } from '../core/util.js';
import { catOf } from '../core/catalog.js';
import { threadById } from '../core/queries.js';

const BACKUP_FORMAT = 'christina-backup';
const BACKUP_VERSION = 1;

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
    if (record && record.data) files[key] = await blobToDataURL(new Blob([record.data], { type: record.type || 'image/jpeg' }));
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    prefs: readPrefs(),
    events: data.events,
    threads: data.threads,
    months: Object.values(data.months),
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
  const rows = [...data.events]
    .sort((a, b) => a.dateOccurred.localeCompare(b.dateOccurred))
    .map((e) => {
      const t = e.threadId ? threadById(e.threadId) : null;
      return [
        e.dateOccurred,
        e.title,
        catOf(e.category).name,
        e.duration,
        t ? t.title : '',
        t ? t.startDate : '',
        t ? t.endDate || '' : '',
        e.notes,
        e.photoPath ? 'yes' : 'no',
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
