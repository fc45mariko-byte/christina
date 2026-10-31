/* Christina — read-only questions about the loaded data. */
import { data } from './db.js';
import { currentMonth, monthKeyOf } from './util.js';
import { CATEGORIES, catOf } from './catalog.js';
const isPastMonth = (key) => key < currentMonth();
const eventMonth = (e) => monthKeyOf(new Date(e.dateOccurred));
const threadById = (id) => data.threads.find((t) => t.id === id);
const eventById = (id) => data.events.find((e) => e.id === id);

function eventsBetween(start, end) {
  const s = start.getTime();
  const t = end.getTime();
  return data.events.filter((e) => {
    if (e.archived) return false;
    const time = new Date(e.dateOccurred).getTime();
    return time >= s && time < t;
  });
}

function threadsOverlapping(startYMD, lastYMD) {
  return data.threads
    .filter((t) => t.startDate <= lastYMD && (!t.endDate || t.endDate >= startYMD))
    .sort((a, b) => (a.startDate === b.startDate ? a.createdAt.localeCompare(b.createdAt) : a.startDate.localeCompare(b.startDate)));
}

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

/** A month with a palette is recolored with it: each category gets the palette
 *  color at its position (cycling), and threads take palette colors in turn. */
function categoryHex(name, palette) {
  if (!palette || !palette.length) return catOf(name).hex;
  const index = CATEGORIES.findIndex((c) => c.name === name);
  return palette[(index === -1 ? CATEGORIES.length - 1 : index) % palette.length];
}
const threadHex = (thread, index, palette) => (palette && palette.length ? palette[index % palette.length] : thread.color);
const monthImageKey = (month, name) => `months/${month}/${name}`;

function monthsWithContent() {
  const set = new Set(data.events.filter((e) => !e.archived).map(eventMonth));
  for (const key of Object.keys(data.months)) if (!lookIsEmpty(lookFor(key))) set.add(key);
  return [...set].sort();
}
export {
  isPastMonth, eventMonth, threadById, eventById, eventsBetween, threadsOverlapping, lookFor, lookIsEmpty,
  categoryHex, threadHex, monthImageKey, monthsWithContent,
};
