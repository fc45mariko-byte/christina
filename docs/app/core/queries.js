/* Christina — read-only questions about the loaded data. */
import { data } from './db.js';
import { currentMonth, monthKeyOf } from './util.js';
import { OTHER_CATEGORY_ID } from './catalog.js';

// ------------------------------------------------------------ Records

const recordById = (id) => data.records.find((r) => r.id === id);
const recordMonth = (r) => monthKeyOf(new Date(r.occurredAt));
const isPastMonth = (key) => key < currentMonth();

/** The single values Christina's activity screens show. A record can hold several; the first one is used. */
const recordCategoryId = (r) => (r.categoryIds && r.categoryIds[0]) || OTHER_CATEGORY_ID;
const recordThreadId = (r) => (r.threadIds && r.threadIds[0]) || null;
const recordPhoto = (r) => (r.mediaIds && r.mediaIds[0]) || null;
const recordDuration = (r) => (r.payload && r.payload.duration != null ? r.payload.duration : null);

function recordsBetween(start, end) {
  const s = start.getTime();
  const t = end.getTime();
  return data.records.filter((r) => {
    if (r.archived) return false;
    const time = new Date(r.occurredAt).getTime();
    return time >= s && time < t;
  });
}

const newestFirst = (a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt);

// ------------------------------------------------------------ Categories

const categoryById = (id) => data.categories.find((c) => c.id === id) || data.categories.find((c) => c.id === OTHER_CATEGORY_ID);
const categoryIndex = (id) => {
  const i = data.categories.findIndex((c) => c.id === id);
  return i === -1 ? data.categories.findIndex((c) => c.id === OTHER_CATEGORY_ID) : i;
};

/** A month with a palette is recolored with it: each category gets the palette
 *  color at its position (cycling), and threads take palette colors in turn. */
function categoryHex(id, palette) {
  if (!palette || !palette.length) return categoryById(id).color;
  return palette[categoryIndex(id) % palette.length];
}

// ------------------------------------------------------------ Threads

const threadById = (id) => data.threads.find((t) => t.id === id);

function threadsOverlapping(startYMD, lastYMD) {
  return data.threads
    .filter((t) => t.startDate && t.startDate <= lastYMD && (!t.endDate || t.endDate >= startYMD))
    .sort((a, b) => (a.startDate === b.startDate ? a.createdAt.localeCompare(b.createdAt) : a.startDate.localeCompare(b.startDate)));
}
const threadHex = (thread, index, palette) => (palette && palette.length ? palette[index % palette.length] : thread.color);

// ------------------------------------------------------------ Months

function lookFor(key) {
  const m = data.months[key];
  const title = (m && m.monthTitle ? m.monthTitle : '').trim();
  return {
    title: title || null,
    palette: (m && m.colorPalette) || [],
    images: (m && m.imagePaths) || [],
  };
}
const lookIsEmpty = (l) => !l.title && !l.palette.length && !l.images.length;
const monthImageKey = (month, name) => `months/${month}/${name}`;

function monthsWithContent() {
  const set = new Set(data.records.filter((r) => !r.archived).map(recordMonth));
  for (const key of Object.keys(data.months)) if (!lookIsEmpty(lookFor(key))) set.add(key);
  return [...set].sort();
}

export {
  recordById, recordMonth, isPastMonth, recordCategoryId, recordThreadId, recordPhoto, recordDuration, recordsBetween,
  newestFirst, categoryById, categoryHex, threadById, threadsOverlapping, threadHex, lookFor, lookIsEmpty, monthImageKey,
  monthsWithContent,
};
