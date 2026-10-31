/* Body Oracle ↔ Christina storage adapter.
 *
 * Body Oracle's code keeps working with its own item shapes ({ id, type, … }, times in milliseconds).
 * This adapter stores them in Christina's shared database instead of Body Oracle's old one:
 *
 *   entry      → records (kind = entry.kind; extra fields in payload; photos as mediaIds 'media/<id>')
 *   thread     → threads (shared with Christina: name ↔ title, '#rrggbb' ↔ 'RRGGBB')
 *   category   → categories (shared with Christina, same colour conversion)
 *   state, ritual, prayer, intention, sigil, oracle → their own stores (times stored as ISO)
 *   settings   → meta, key 'bodyOracle'
 *   images and videos → files, key 'media/<id>' (stored as Blobs)
 *
 * Every write also updates Christina's in-memory `data`, so both sides see the same records.
 * Christina's own activities (kind 'activity') are not shown to Body Oracle. */
import { DB, data } from '../../core/db.js';
import { OTHER_CATEGORY_ID } from '../../core/catalog.js';

const MEDIA = 'media/';
const LIBRARY = { state: 'states', ritual: 'rituals', prayer: 'prayers', intention: 'intentions', sigil: 'sigils', oracle: 'oracleReadings' };
const LIBRARY_TYPE = Object.fromEntries(Object.entries(LIBRARY).map(([type, store]) => [store, type]));
const TIME_FIELDS = ['createdAt', 'updatedAt', 'date', 'lastPerformedAt', 'lastReadAt'];
const ENTRY_OWN = new Set(['id', 'type', 'kind', 'date', 'text', 'categoryIds', 'threadIds', 'photoIds', 'createdAt', 'updatedAt']);
const BO_STORES = ['records', 'threads', 'categories', ...Object.values(LIBRARY), 'meta', 'files'];

const iso = (v) => (typeof v === 'number' ? new Date(v).toISOString() : v ?? null);
const ms = (v) => (typeof v === 'string' ? Date.parse(v) : v ?? null);
const hex6 = (c) => String(c || '').replace('#', '').toUpperCase() || 'A9A9A9';
const hash = (c) => (c ? `#${String(c).replace('#', '')}` : c);

// ------------------------------------------------------------ conversions

function recordFromEntry(e, existing) {
  const payload = {};
  for (const [k, v] of Object.entries(e)) if (!ENTRY_OWN.has(k)) payload[k] = v;
  return {
    id: e.id,
    kind: e.kind || 'note',
    occurredAt: iso(e.date) || new Date().toISOString(),
    title: existing ? existing.title ?? null : null,
    text: e.text && e.text.trim() ? e.text : null,
    categoryIds: e.categoryIds || [],
    threadIds: e.threadIds || [],
    tagIds: existing ? existing.tagIds || [] : [],
    mediaIds: (e.photoIds || []).map((id) => MEDIA + id),
    linkedRecordIds: existing ? existing.linkedRecordIds || [] : [],
    payload,
    archived: existing ? !!existing.archived : false,
    createdAt: iso(e.createdAt) || new Date().toISOString(),
    updatedAt: iso(e.updatedAt) || new Date().toISOString(),
  };
}

function entryFromRecord(r) {
  return {
    ...(r.payload || {}),
    id: r.id,
    type: 'entry',
    kind: r.kind,
    date: ms(r.occurredAt),
    text: r.text || '',
    categoryIds: r.categoryIds || [],
    threadIds: r.threadIds || [],
    photoIds: (r.mediaIds || []).filter((k) => k.startsWith(MEDIA)).map((k) => k.slice(MEDIA.length)),
    createdAt: ms(r.createdAt),
    updatedAt: ms(r.updatedAt),
  };
}

/** Threads and categories are shared: Body Oracle's fields are merged into what Christina already stores. */
function threadFromBO(t, existing) {
  const { type, name, color, createdAt, updatedAt, ...rest } = t;
  return {
    categoryId: null, startDate: null, endDate: null, archived: false,
    ...(existing || {}),
    ...rest,
    title: name || (existing && existing.title) || '',
    color: hex6(color),
    createdAt: (existing && existing.createdAt) || iso(createdAt) || new Date().toISOString(),
    updatedAt: iso(updatedAt) || new Date().toISOString(),
  };
}
function threadToBO(t) {
  const { title, color, createdAt, updatedAt, ...rest } = t;
  return { ...rest, type: 'thread', name: title, color: hash(color), icon: t.icon || 'threads', createdAt: ms(createdAt), updatedAt: ms(updatedAt) };
}

function categoryFromBO(c, existing) {
  const { type, color, createdAt, updatedAt, ...rest } = c;
  return {
    preset: false,
    ...(existing || {}),
    ...rest,
    color: hex6(color),
    createdAt: (existing && existing.createdAt) || iso(createdAt) || new Date().toISOString(),
    updatedAt: iso(updatedAt) || new Date().toISOString(),
  };
}
function categoryToBO(c) {
  const { color, createdAt, updatedAt, ...rest } = c;
  return { ...rest, type: 'category', color: hash(color), createdAt: ms(createdAt), updatedAt: ms(updatedAt) };
}

function toStored(x) {
  const { type, ...rest } = x;
  for (const f of TIME_FIELDS) if (f in rest) rest[f] = iso(rest[f]);
  return rest;
}
function fromStored(x, type) {
  const out = { ...x, type };
  for (const f of TIME_FIELDS) if (f in out) out[f] = ms(out[f]);
  return out;
}

// ------------------------------------------------------------ keeping Christina's memory in step

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.push(item);
  else list[i] = item;
}
const sortCategories = () => data.categories.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.createdAt).localeCompare(String(b.createdAt)));

// ------------------------------------------------------------ bringing data in

const lower = (s) => String(s || '').trim().toLowerCase();

/** Categories and threads are shared with Christina. Incoming ones whose name matches an existing one are
 *  merged into it: they are left out, and every link to them is pointed at the existing id. */
function mergeShared(items) {
  const catByName = new Map(data.categories.map((c) => [lower(c.name), c.id]));
  const threadByName = new Map(data.threads.map((t) => [lower(t.title), t.id]));
  const catAlias = new Map();
  const threadAlias = new Map();
  const kept = items.filter((x) => {
    if (x.type === 'category') {
      const existing = catByName.get(lower(x.name));
      if (existing && existing !== x.id) { catAlias.set(x.id, existing); return false; }
    }
    if (x.type === 'thread') {
      const existing = threadByName.get(lower(x.name));
      if (existing && existing !== x.id) { threadAlias.set(x.id, existing); return false; }
    }
    return true;
  });
  const fixCategory = (id) => catAlias.get(id) || id;
  const fixThread = (id) => threadAlias.get(id) || id;
  for (const x of kept) {
    if (Array.isArray(x.categoryIds)) x.categoryIds = [...new Set(x.categoryIds.map(fixCategory))];
    if (Array.isArray(x.threadIds)) x.threadIds = [...new Set(x.threadIds.map(fixThread))];
    if (x.threadId) x.threadId = fixThread(x.threadId);
    if (x.type === 'settings' && Array.isArray(x.radial)) {
      x.radial.forEach((r) => { if (r.action && r.action.startsWith('cat:')) r.action = 'cat:' + fixCategory(r.action.slice(4)); });
    }
  }
  return { items: kept, fixCategory, fixThread };
}

// ------------------------------------------------------------ the interface Body Oracle's code uses

const BODB = {
  mem: false,
  /** Database generation that Body Oracle's in-memory items reflect. */
  synced: 0,
  async open() {
    /* Christina opens the database at boot. */
  },

  async all() {
    const stores = ['records', 'threads', 'categories', ...Object.values(LIBRARY)];
    const [records, threads, categories, ...library] = await Promise.all(stores.map((s) => DB.getAll(s)));
    const settings = await DB.get('meta', 'bodyOracle');
    const items = [
      ...records.filter((r) => r.kind !== 'activity').map(entryFromRecord),
      ...threads.map(threadToBO),
      ...categories.map(categoryToBO),
    ];
    Object.values(LIBRARY).forEach((store, i) => library[i].forEach((x) => items.push(fromStored(x, LIBRARY_TYPE[store]))));
    if (settings) items.push({ ...settings.value, id: 'settings', type: 'settings' });
    this.synced = DB.generation;
    return items;
  },

  async put(x) {
    let after = () => {};
    if (x.type === 'settings') {
      const { id, type, ...value } = x;
      await DB.write(['meta'], (tx) => tx.objectStore('meta').put({ key: 'bodyOracle', value }));
    } else if (x.type === 'entry') {
      const record = recordFromEntry(x, data.records.find((r) => r.id === x.id));
      await DB.write(['records'], (tx) => tx.objectStore('records').put(record));
      after = () => upsert(data.records, record);
    } else if (x.type === 'thread') {
      const thread = threadFromBO(x, data.threads.find((t) => t.id === x.id));
      await DB.write(['threads'], (tx) => tx.objectStore('threads').put(thread));
      after = () => upsert(data.threads, thread);
    } else if (x.type === 'category') {
      const category = categoryFromBO(x, data.categories.find((c) => c.id === x.id));
      await DB.write(['categories'], (tx) => tx.objectStore('categories').put(category));
      after = () => {
        upsert(data.categories, category);
        sortCategories();
      };
    } else if (LIBRARY[x.type]) {
      const store = LIBRARY[x.type];
      await DB.write([store], (tx) => tx.objectStore(store).put(toStored(x)));
    } else {
      throw new Error(`Unknown item type: ${x.type}`);
    }
    after();
    this.synced = DB.generation;
  },

  /** Removes an item by id from whichever store holds it. Deleting a thread also unlinks Christina's activities. */
  async del(id) {
    if (id === OTHER_CATEGORY_ID) return;
    const linked = data.records.filter((r) => (r.threadIds || []).includes(id));
    const unlinked = linked.map((r) => ({ ...r, threadIds: r.threadIds.filter((t) => t !== id), updatedAt: new Date().toISOString() }));
    const stores = ['records', 'threads', 'categories', ...Object.values(LIBRARY)];
    await DB.write(stores, (tx) => {
      stores.forEach((s) => tx.objectStore(s).delete(id));
      unlinked.forEach((r) => tx.objectStore('records').put(r));
    });
    linked.forEach((r, i) => Object.assign(r, unlinked[i]));
    data.records = data.records.filter((r) => r.id !== id);
    data.threads = data.threads.filter((t) => t.id !== id);
    data.categories = data.categories.filter((c) => c.id !== id);
    this.synced = DB.generation;
  },

  async putBlob(key, blob) {
    await DB.write(['files'], (tx) => tx.objectStore('files').put(blob, MEDIA + key));
    this.synced = DB.generation;
  },
  async getBlob(key) {
    const v = await DB.get('files', MEDIA + key);
    if (!v) return undefined;
    return v instanceof Blob ? v : new Blob([v.data], { type: v.type });
  },
  async delBlob(key) {
    await DB.write(['files'], (tx) => tx.objectStore('files').delete(MEDIA + key));
    this.synced = DB.generation;
  },
  async allBlobs() {
    const out = [];
    await new Promise((resolve, reject) => {
      const tx = DB.db.transaction('files');
      const req = tx.objectStore('files').openCursor(IDBKeyRange.bound(MEDIA, `${MEDIA}￿`));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const v = cursor.value;
        out.push([String(cursor.key).slice(MEDIA.length), v instanceof Blob ? v : new Blob([v.data], { type: v.type })]);
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return out;
  },

  /** Erases Body Oracle's own data: its entries, library, settings and media.
   *  Christina's activities, and the shared threads and categories, are kept. */
  async clear() {
    const library = Object.values(LIBRARY);
    const ids = data.records.filter((r) => r.kind !== 'activity').map((r) => r.id);
    await DB.write(['records', 'meta', 'files', ...library], (tx) => {
      ids.forEach((id) => tx.objectStore('records').delete(id));
      library.forEach((s) => tx.objectStore(s).clear());
      tx.objectStore('meta').delete('bodyOracle');
      tx.objectStore('files').delete(IDBKeyRange.bound(MEDIA, `${MEDIA}￿`));
    });
    data.records = data.records.filter((r) => r.kind === 'activity');
    this.synced = DB.generation;
  },
};

export { BODB, BO_STORES, mergeShared, recordFromEntry, entryFromRecord, threadFromBO, threadToBO, categoryFromBO, categoryToBO };
