/* Christina — saving and removing items in the simple stores (schedule, tasks, projects, habits, habitLogs, tags).
 * Each write goes to IndexedDB first; the in-memory copy in `data` changes only once the write has succeeded. */
import { DB, data, requestPersistence } from './db.js';

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.push(item);
  else list[i] = item;
}

/** Saves items (one or more) to a store in one transaction. Sets createdAt/updatedAt. */
async function putItems(store, items) {
  const now = new Date().toISOString();
  const saved = items.map((x) => ({ ...x, createdAt: x.createdAt || now, updatedAt: now }));
  await DB.write([store], (tx) => saved.forEach((x) => tx.objectStore(store).put(x)));
  requestPersistence();
  saved.forEach((x) => upsert(data[store], x));
  return saved;
}
const putItem = async (store, item) => (await putItems(store, [item]))[0];

async function removeItems(store, ids) {
  await DB.write([store], (tx) => ids.forEach((id) => tx.objectStore(store).delete(id)));
  data[store] = data[store].filter((x) => !ids.includes(x.id));
}
const removeItem = (store, id) => removeItems(store, [id]);

export { putItem, putItems, removeItem, removeItems, upsert };
