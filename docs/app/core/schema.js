/* Christina — database schema and upgrades.
 *
 * Version 3 is the shared schema for every module (v3 adds `themes`; see legacy.js). Every record has an `id`, `createdAt` and
 * `updatedAt` (ISO 8601). Calendar days are 'YYYY-MM-DD'. Records link to each other by id.
 *
 *   records         everything that happened. `kind` says what: 'activity' (Christina's "I did
 *                   something"), later 'journal', 'note', 'body', 'state', 'dream', 'sign', …
 *                   { id, kind, occurredAt, title, text, categoryIds[], threadIds[], tagIds[],
 *                     mediaIds[], linkedRecordIds[], payload{}, archived, createdAt, updatedAt }
 *   threads         long-running parts of life; startDate/endDate draw a bar on the calendar
 *                   { id, title, categoryId, color, startDate, endDate, archived, createdAt, updatedAt }
 *   months          month personalization { month: 'YYYY-MM', imagePaths[], colorPalette[], monthTitle }
 *   files           photos and other media, keyed by path ('photos/<id>.jpg', 'months/<YYYY-MM>/<id>.jpg')
 *   categories      { id, name, color, icon, order, preset, createdAt, updatedAt }
 *   schedule        planned calendar items (Calendar module)
 *   tasks, projects, habits, habitLogs, tags, states            (their modules)
 *   themes          long-running parts of inner life { id, name, description, color, icon, coverId, order }
 *   rituals, prayers            Rituals section ({ name, situations, intention, steps[], objects[], products[],
 *                               visualIds[], prayerIds[], themeIds[], favourite, lastPerformedAt, … } / { name, text, … })
 *   intentions, sigils, oracleReadings   kept from the former Body Oracle app; no longer shown
 *   legacy          untouched copies of data as it was before an upgrade, keyed by store name
 *   meta            { key: 'schema', version, migratedFrom, migratedAt }
 */
import { CATEGORIES, categoryIdForName } from './catalog.js';
import { modernizeRecord, isFormerOracleThread, themeFromThread, modernizeRitual } from './legacy.js';

const DB_NAME = 'christina';
const DB_VERSION = 3;

/** Stores that hold app data (exported, counted, erased). `legacy` and `meta` are bookkeeping. */
const DATA_STORES = [
  'records', 'threads', 'months', 'categories', 'schedule', 'tasks', 'projects', 'habits', 'habitLogs',
  'tags', 'states', 'rituals', 'prayers', 'intentions', 'sigils', 'oracleReadings', 'themes',
];

function createV2Stores(db) {
  const make = (name, options) => (db.objectStoreNames.contains(name) ? null : db.createObjectStore(name, options));
  const records = make('records', { keyPath: 'id' });
  if (records) {
    records.createIndex('occurredAt', 'occurredAt');
    records.createIndex('kind', 'kind');
  }
  make('threads', { keyPath: 'id' });
  make('months', { keyPath: 'month' });
  make('files');
  for (const name of DATA_STORES) if (!['records', 'threads', 'months'].includes(name)) make(name, { keyPath: 'id' });
  make('legacy', { keyPath: 'store' });
  make('meta', { keyPath: 'key' });
}

function presetCategories(now) {
  return CATEGORIES.map((c, order) => ({
    id: c.id, name: c.name, color: c.hex, icon: c.icon, order, preset: true, createdAt: now, updatedAt: now,
  }));
}

/** Christina v1 event → v2 record of kind 'activity'. Same id; nothing is dropped. */
function activityFromV1(e, now) {
  return {
    id: e.id,
    kind: 'activity',
    occurredAt: e.dateOccurred,
    title: e.title,
    text: e.notes ?? null,
    categoryIds: [categoryIdForName(e.category)],
    threadIds: e.threadId ? [e.threadId] : [],
    tagIds: [],
    mediaIds: e.photoPath ? [e.photoPath] : [],
    linkedRecordIds: [],
    payload: { duration: e.duration ?? null },
    archived: !!e.archived,
    createdAt: e.createdAt,
    updatedAt: e.createdAt || now,
  };
}

function threadFromV1(t, now) {
  const { category, ...rest } = t;
  return { ...rest, categoryId: categoryIdForName(category), updatedAt: t.updatedAt || t.createdAt || now };
}

/** Runs inside the upgrade transaction, so it either completes fully or leaves version 1 as it was. */
function upgrade(db, tx, oldVersion) {
  const now = new Date().toISOString();
  createV2Stores(db);
  const meta = tx.objectStore('meta');
  meta.put({ key: 'schema', version: DB_VERSION, migratedFrom: oldVersion || null, migratedAt: now });
  // Preset categories only for a new database or one coming from version 1 — never over the person's own edits.
  if (oldVersion < 2) presetCategories(now).forEach((c) => tx.objectStore('categories').put(c));
  if (oldVersion === 2) return toV3(tx, now);
  if (oldVersion !== 1) return;

  const legacy = tx.objectStore('legacy');
  const threads = tx.objectStore('threads');
  threads.getAll().onsuccess = (event) => {
    const rows = event.target.result;
    legacy.put({ store: 'threads', version: 1, rows });
    rows.forEach((t) => threads.put(threadFromV1(t, now)));
  };
  tx.objectStore('months').getAll().onsuccess = (event) => {
    legacy.put({ store: 'months', version: 1, rows: event.target.result });
  };
  tx.objectStore('events').getAll().onsuccess = (event) => {
    const rows = event.target.result;
    legacy.put({ store: 'events', version: 1, rows });
    const records = tx.objectStore('records');
    rows.forEach((e) => records.put(activityFromV1(e, now)));
    db.deleteObjectStore('events');
  };
}

/** Version 2 → 3: threads made in Body Oracle become themes; its notes, photos and body observations become
 *  journal entries; links follow. Copies of threads and records as they were go to `legacy`. */
function toV3(tx, now) {
  const legacy = tx.objectStore('legacy');
  const stateNames = new Map();
  tx.objectStore('states').getAll().onsuccess = (ev) => {
    ev.target.result.forEach((s) => stateNames.set(s.id, s.name));
    const threads = tx.objectStore('threads');
    threads.getAll().onsuccess = (e1) => {
      const rows = e1.target.result;
      const moving = rows.filter(isFormerOracleThread);
      const themeIds = new Set(moving.map((t) => t.id));
      if (moving.length) legacy.put({ store: 'threads@v2', version: 2, rows });
      moving.forEach((t, i) => {
        tx.objectStore('themes').put(themeFromThread(t, i));
        threads.delete(t.id);
      });
      const records = tx.objectStore('records');
      records.getAll().onsuccess = (e2) => {
        const all = e2.target.result;
        const changed = [];
        for (const r of all) {
          let next = modernizeRecord(r, themeIds);
          if (next.kind === 'state' && !next.title) {
            const names = ((next.payload && next.payload.stateIds) || []).map((id) => stateNames.get(id)).filter(Boolean);
            if (names.length) next = { ...next, title: names.join(', ') };
          }
          if (next !== r) changed.push({ ...next, updatedAt: now });
        }
        if (changed.length) {
          legacy.put({ store: 'records@v2', version: 2, rows: all.filter((r) => changed.some((c) => c.id === r.id)) });
          changed.forEach((r) => records.put(r));
        }
      };
      const rituals = tx.objectStore('rituals');
      rituals.getAll().onsuccess = (e3) => e3.target.result.forEach((x) => {
        const next = modernizeRitual(x, themeIds);
        if (next !== x) rituals.put(next);
      });
      const projects = tx.objectStore('projects');
      projects.getAll().onsuccess = (e4) => e4.target.result.forEach((p) => {
        if (p.threadId && themeIds.has(p.threadId)) projects.put({ ...p, threadId: null });
      });
    };
  };
  // "For tonight" and the situation words move from the old app's settings to the Rituals section's.
  const meta = tx.objectStore('meta');
  meta.get('bodyOracle').onsuccess = (ev) => {
    const old = ev.target.result && ev.target.result.value;
    if (old) meta.put({ key: 'rituals', tonight: old.tonight || null, situations: old.situations || null });
  };
}

export { DB_NAME, DB_VERSION, DATA_STORES, upgrade, activityFromV1, threadFromV1, presetCategories };
