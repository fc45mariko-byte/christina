/* Christina — bringing in data from the former Body Oracle app: its backup file, or its database where the
 * old app ran on this device. Everything lands in Christina's own shape (see core/legacy.js):
 *   entries → records (notes, photos and body observations as journal entries; dreams, signs, states, rituals kept)
 *   threads → themes · rituals, prayers, states → their stores · categories and themes merge by name
 *   photos and videos → files ('media/<id>') · "For tonight" and situations → meta 'rituals'
 *   intentions, sigils and readings are kept in their stores, but are no longer shown.
 * Importing adds and updates by id; it never deletes. Importing the same data twice changes nothing. */
import { DB, data } from '../core/db.js';
import { modernizeRecord, modernizeRitual } from '../core/legacy.js';

const MEDIA = 'media/';
const TIME = ['createdAt', 'updatedAt', 'date', 'lastPerformedAt', 'lastReadAt'];
const iso = (v) => (typeof v === 'number' ? new Date(v).toISOString() : v ?? null);
const hex6 = (c) => String(c || '').replace('#', '').toUpperCase() || 'A9A9A9';
const lower = (s) => String(s || '').trim().toLowerCase();
const LIBRARY = { state: 'states', ritual: 'rituals', prayer: 'prayers', intention: 'intentions', sigil: 'sigils', oracle: 'oracleReadings' };
const ENTRY_OWN = new Set(['id', 'type', 'kind', 'date', 'text', 'categoryIds', 'threadIds', 'photoIds', 'createdAt', 'updatedAt']);

function stored(x) {
  const { type, ...rest } = x;
  for (const f of TIME) if (f in rest) rest[f] = iso(rest[f]);
  return rest;
}

/** Turns old items into Christina rows, merging categories and themes with existing ones by name. */
function convert(items, existing) {
  const catByName = new Map(existing.categories.map((c) => [lower(c.name), c.id]));
  const themeByName = new Map(existing.themes.map((t) => [lower(t.name), t.id]));
  const catAlias = new Map();
  const themeAlias = new Map();
  const out = { categories: [], themes: [], records: [], states: [], rituals: [], prayers: [], intentions: [], sigils: [], oracleReadings: [] };
  let order = existing.categories.length;
  for (const x of items.filter((i) => i.type === 'category')) {
    const same = catByName.get(lower(x.name));
    if (same) { catAlias.set(x.id, same); continue; }
    const { type, color, imageId, ...rest } = x;
    out.categories.push({ ...rest, color: hex6(color), icon: x.icon || 'more', order: order++, preset: false, createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt) });
  }
  let torder = existing.themes.length;
  for (const x of items.filter((i) => i.type === 'thread')) {
    const same = themeByName.get(lower(x.name));
    if (same) { themeAlias.set(x.id, same); continue; }
    out.themes.push({ id: x.id, name: x.name || 'Theme', description: x.description || '', color: hex6(x.color), icon: x.icon && x.icon !== 'threads' ? x.icon : 'leaf', coverId: x.coverId || null, order: torder++, createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt) });
  }
  const cat = (id) => catAlias.get(id) || id;
  const themeIds = new Set([...items.filter((i) => i.type === 'thread').map((t) => t.id), ...themeAlias.values()]);
  const theme = (id) => themeAlias.get(id) || id;
  const stateName = new Map([...existing.states, ...items.filter((i) => i.type === 'state')].map((s) => [s.id, s.name]));

  for (const e of items.filter((i) => i.type === 'entry')) {
    const payload = {};
    for (const [k, v] of Object.entries(e)) if (!ENTRY_OWN.has(k)) payload[k] = v;
    const raw = {
      id: e.id,
      kind: e.kind || 'note',
      occurredAt: iso(e.date) || new Date().toISOString(),
      title: null,
      text: (e.text || '').trim() ? e.text : null,
      categoryIds: [...new Set((e.categoryIds || []).map(cat))],
      threadIds: (e.threadIds || []).map(theme),
      tagIds: [],
      mediaIds: (e.photoIds || []).map((id) => MEDIA + id),
      linkedRecordIds: [],
      payload,
      archived: false,
      createdAt: iso(e.createdAt) || new Date().toISOString(),
      updatedAt: iso(e.updatedAt) || new Date().toISOString(),
    };
    let r = modernizeRecord(raw, themeIds);
    if (r.kind === 'state') r = { ...r, title: (payload.stateIds || []).map((id) => stateName.get(id)).filter(Boolean).join(', ') || 'State' };
    if (r.kind === 'ritual') {
      const ritual = items.find((i) => i.type === 'ritual' && i.id === payload.ritualId);
      r = { ...r, title: ritual ? ritual.name : 'Ritual' };
    }
    out.records.push(r);
  }
  for (const x of items) {
    const store = LIBRARY[x.type];
    if (!store) continue;
    let row = stored(x);
    if (x.type === 'ritual') row = modernizeRitual({ ...row, threadIds: (row.threadIds || []).map(theme), threadId: row.threadId ? theme(row.threadId) : row.threadId }, themeIds);
    out[store].push(row);
  }
  return out;
}

/** Writes converted rows and media, and keeps "For tonight" and situations. Returns counts. */
async function write(rows, blobs, settings) {
  const stores = Object.keys(rows);
  const now = new Date().toISOString();
  await DB.write([...stores, 'files', 'meta'], (tx) => {
    for (const name of stores) rows[name].forEach((row) => tx.objectStore(name).put(row));
    for (const [key, blob] of blobs) if (blob) tx.objectStore('files').put(blob, MEDIA + key);
    if (settings) {
      tx.objectStore('meta').put({ key: 'rituals', tonight: settings.tonight || null, situations: settings.situations || null });
      tx.objectStore('meta').put({ key: 'bodyOracleImport', from: 'Body Oracle', at: now });
    }
  });
  return { entries: rows.records.length, rituals: rows.rituals.length, prayers: rows.prayers.length, themes: rows.themes.length, media: blobs.length };
}

async function existingNow() {
  return { categories: data.categories, themes: await DB.getAll('themes'), states: await DB.getAll('states') };
}

function dataURLToBlob(url) {
  const [head, body] = url.split(',');
  const type = (/data:([^;]+)/.exec(head) || [])[1] || 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Reads an old Body Oracle backup file and describes it, without changing anything. */
async function readOracleBackup(file) {
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not a Body Oracle backup.');
  }
  if (!backup || backup.app !== 'body-oracle' || !Array.isArray(backup.items)) throw new Error('That file is not a Body Oracle backup.');
  const count = (t) => backup.items.filter((x) => x.type === t).length;
  return { backup, summary: `${count('entry')} entries, ${count('ritual')} rituals, ${count('prayer')} prayers and ${Object.keys(backup.blobs || {}).length} photos` };
}

async function importOracleBackup(backup) {
  const blobs = Object.entries(backup.blobs || {}).map(([k, u]) => [k, dataURLToBlob(u)]);
  return write(convert(backup.items, await existingNow()), blobs, backup.settings || {});
}

/* ---- the old app's own database, where it ran on this device ---- */

function openOld() {
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open('body-oracle');
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => request.transaction.abort(); // it did not exist: create nothing
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}
const readAll = (db, store, keys = false) =>
  new Promise((resolve, reject) => {
    const s = db.transaction(store).objectStore(store);
    const req = keys ? s.getAllKeys() : s.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Once per device: where the old Body Oracle app kept data, copy it in. The old database is only read.
 *  Skipped if it already ran, or if Body Oracle data was already brought in another way. */
async function importOldOracleDatabase() {
  if (await DB.get('meta', 'bodyOracleImport')) return 0;
  if (await DB.get('meta', 'bodyOracle')) return 0; // brought in by an earlier version of Christina
  const old = await openOld();
  if (!old) return 0;
  try {
    if (!old.objectStoreNames.contains('items')) return 0;
    const items = await readAll(old, 'items');
    if (!items.length) return 0;
    const settings = items.find((x) => x.id === 'settings') || {};
    let blobs = [];
    if (old.objectStoreNames.contains('blobs')) {
      const [keys, values] = await Promise.all([readAll(old, 'blobs', true), readAll(old, 'blobs')]);
      blobs = keys.map((k, i) => [String(k), values[i]]);
    }
    const result = await write(convert(items.filter((x) => x.id !== 'settings'), await existingNow()), blobs, settings);
    return result.entries;
  } finally {
    old.close();
  }
}

export { readOracleBackup, importOracleBackup, importOldOracleDatabase };
