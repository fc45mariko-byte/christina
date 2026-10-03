/* Christina — a visual system for seeing life accumulate over time.
 * All data stays on this device (IndexedDB). No sync, no cloud, no API. */
'use strict';

// ============================================================ Constants

const CATEGORIES = [
  { name: 'Study', hex: '4A90E2', icon: 'book' },
  { name: 'Work', hex: '7B68EE', icon: 'briefcase' },
  { name: 'Body', hex: 'FF6B9D', icon: 'activity' },
  { name: 'Social', hex: 'FFB347', icon: 'users' },
  { name: 'Personal', hex: '50C878', icon: 'user' },
  { name: 'Home', hex: 'D4AF37', icon: 'home' },
  { name: 'Enjoyed', hex: 'FF69B4', icon: 'heart' },
  { name: 'Other', hex: 'A9A9A9', icon: 'more' },
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));
const catOf = (name) => CAT[name] || CAT.Other;

const THREAD_COLORS = ['FF6B9D', '4A90E2', '7B68EE', 'FFB347', '50C878', 'D4AF37', 'FF69B4', '2EC4B6', 'E07A5F', 'A9A9A9'];

const PALETTES = [
  { name: 'Paper', colors: ['F2EDE4', 'D9CBB8', 'A68A64', '5E503F', '2B2118'] },
  { name: 'Dusk', colors: ['2E2A4F', '5B4B8A', 'A675A1', 'E8A0BF', 'F7D6E0'] },
  { name: 'Coast', colors: ['0B3954', '087E8B', 'BFD7EA', 'FF5A5F', 'C81D25'] },
  { name: 'Moss', colors: ['283618', '606C38', 'DDA15E', 'BC6C25', 'FEFAE0'] },
  { name: 'Citrus', colors: ['FFBE0B', 'FB5607', 'FF006E', '8338EC', '3A86FF'] },
  { name: 'Ink', colors: ['111111', '3D3D3D', '7A7A7A', 'BDBDBD', 'F0F0F0'] },
  { name: 'Bloom', colors: ['FF6B9D', 'FFB347', 'FFF3B0', '9ED8DB', '467599'] },
  { name: 'Winter', colors: ['E0FBFC', 'C2DFE3', '9DB4C0', '5C6B73', '253237'] },
];

const MAX_MONTH_IMAGES = 12;
const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.8;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const LANE_HEIGHT = 31; // label 15 + 2 + bar 10 + 4

// ============================================================ Icons

const ICON_PATHS = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  more: '<circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  threads: '<line x1="3" y1="6" x2="15" y2="6"/><line x1="7" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="13" y2="18"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.5 0-.4-.15-.74-.4-1-.25-.26-.4-.6-.4-1 0-.83.67-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.97-4.5-9-10-9z"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  drive: '<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
};

function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

// ============================================================ Utilities

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID().toUpperCase();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase();
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYMD = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const monthStart = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
};
const addMonths = (key, n) => {
  const d = monthStart(key);
  return monthKeyOf(new Date(d.getFullYear(), d.getMonth() + n, 1));
};
const currentMonth = () => monthKeyOf(new Date());
const localInputValue = (d) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const maxStr = (a, b) => (a > b ? a : b);

const F = {
  monthYear: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }),
  shortMonthYear: new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }),
  monthName: new Intl.DateTimeFormat(undefined, { month: 'long' }),
  dayMonth: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }),
  weekdayDayMonth: new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
  time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }),
  full: new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }),
};
const monthTitle = (key) => F.monthYear.format(monthStart(key)); // "October 2026"
const monthShort = (key) => F.shortMonthYear.format(monthStart(key)); // "Oct 2026"
const monthName = (key) => F.monthName.format(monthStart(key)); // "October"
const timestamp = (d) => `${F.weekdayDayMonth.format(d)} · ${F.time.format(d)}`;
const rangeText = (start, end) => `${F.dayMonth.format(parseYMD(start))} – ${end ? F.dayMonth.format(parseYMD(end)) : 'ongoing'}`;

function brightness(hex) {
  const v = parseInt(hex, 16);
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
}

// ============================================================ Settings (per device)

const Settings = {
  read(key, fallback) {
    try {
      const v = localStorage.getItem(`christina.${key}`);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(`christina.${key}`, JSON.stringify(value));
    } catch {
      /* private mode — keep in memory only */
    }
  },
};
const prefs = {
  mondayFirst: Settings.read('mondayFirst', true),
  weekView: Settings.read('weekView', false),
  hideInstallHint: Settings.read('hideInstallHint', false),
};
const firstWeekday = () => (prefs.mondayFirst ? 1 : 0);

// ============================================================ Storage (IndexedDB)
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

// ============================================================ Photos

/** Scales to fit 1080×1080 and encodes JPEG at quality 0.8. */
async function compressImage(file) {
  const source = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This photo couldn't be read."));
      image.src = source;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("This photo couldn't be read.");
    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error("This photo couldn't be read.");
    if (blob.size > MAX_PHOTO_BYTES) {
      throw new Error(`This photo is still too large after compression (${(blob.size / 1048576).toFixed(1)} MB). Choose another photo to try again.`);
    }
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function ensureSpace(bytes) {
  if (!navigator.storage || !navigator.storage.estimate) return;
  const { quota, usage } = await navigator.storage.estimate();
  if (quota && usage != null && quota - usage < bytes * 2) {
    throw new Error("There isn't enough free storage on this device to save this photo.");
  }
}

// ============================================================ Queries

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
const monthImageKey = (month, name) => `months/${month}/${name}`;

function monthsWithContent() {
  const set = new Set(data.events.filter((e) => !e.archived).map(eventMonth));
  for (const key of Object.keys(data.months)) if (!lookIsEmpty(lookFor(key))) set.add(key);
  return [...set].sort();
}

// ============================================================ State

const TABS = ['home', 'map', 'add', 'threads', 'archive', 'settings'];
const state = {
  tab: 'home',
  stacks: Object.fromEntries(TABS.map((t) => [t, []])),
  mapMonth: currentMonth(),
  weekAnchor: ymd(new Date()),
  addMode: 'did',
  threadSort: 'relevance',
  ef: null, // event form (Mode A)
  tf: null, // thread form (Mode B)
  te: null, // thread edit
  pm: null, // personalized mode
};

function newEventForm() {
  return { date: localInputValue(new Date()), title: '', category: null, duration: '', threadId: '', notes: '', photo: null, photoURL: null, processing: false };
}
function newThreadForm() {
  const today = ymd(new Date());
  return { start: today, end: today, ongoing: false, title: '', category: null, tieTo: '', color: THREAD_COLORS[0] };
}
state.ef = newEventForm();
state.tf = newThreadForm();

const stack = () => state.stacks[state.tab];
const topView = () => stack()[stack().length - 1];
function push(view) {
  stack().push(view);
  render();
}
function back() {
  stack().pop();
  render();
}

// ============================================================ Rendering

const $ = (sel, root = document) => root.querySelector(sel);

function render() {
  const main = $('#main');
  const view = topView();
  const key = `${state.tab}:${view ? JSON.stringify(view) : 'root'}`;
  const sameView = main.dataset.view === key;
  const scroll = main.scrollTop;
  main.innerHTML = view ? renderPushed(view) : renderRoot();
  main.dataset.view = key;
  main.scrollTop = sameView ? scroll : 0;
  renderTabBar();
  hydrateImages(main);
  refreshValidity();
}

function renderRoot() {
  switch (state.tab) {
    case 'home': return viewHome();
    case 'map': return viewMap();
    case 'add': return viewAdd();
    case 'threads': return viewThreads();
    case 'archive': return viewArchive();
    case 'settings': return viewSettings();
    default: return '';
  }
}

function renderPushed(view) {
  switch (view.name) {
    case 'event': return viewEventDetail(view.id, view.readOnly);
    case 'thread': return viewThreadDetail(view.id);
    case 'threadEdit': return viewThreadEdit();
    case 'archiveMonth': return viewArchiveMonth(view.month);
    case 'appearance': return viewAppearance();
    case 'personalize': return viewPersonalize();
    case 'calendarSettings': return viewCalendarSettings();
    case 'categories': return viewCategories();
    case 'data': return viewNotInBuild('Data & Export', ['iCloud backup', 'Export to CSV'], 'All data stays on this device.');
    case 'notifications': return viewNotInBuild('Notifications', ['Notifications'], '');
    case 'privacy': return viewPrivacy();
    case 'about': return viewAbout();
    default: return '';
  }
}

function navbar(title, right = '') {
  return `<div class="navbar">
    <div class="left"><button class="nav-btn" data-action="back" aria-label="Back">${icon('left')}Back</button></div>
    <div class="nav-title">${esc(title)}</div>
    <div class="right">${right}</div>
  </div>`;
}

function renderTabBar() {
  const item = (tab, label, ic) =>
    `<button class="tab ${state.tab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}" aria-label="${label}">${icon(ic)}<span>${label}</span></button>`;
  $('#tabbar').innerHTML =
    item('home', 'Home', 'home') +
    item('map', 'Map', 'calendar') +
    `<div class="tab-add-wrap"><button class="tab-add" data-action="tab" data-tab="add" aria-label="Add">${icon('plus')}</button></div>` +
    item('threads', 'Threads', 'threads') +
    item('archive', 'Archive', 'archive') +
    item('settings', 'Settings', 'settings');
}

/** Loads <img data-file="key"> sources from IndexedDB. */
function hydrateImages(root) {
  root.querySelectorAll('img[data-file]').forEach((img) => {
    const key = img.dataset.file;
    const holder = img.closest('.sq, .photo');
    if (holder) holder.classList.add('loading');
    fileURL(key)
      .then((url) => {
        if (holder) holder.classList.remove('loading');
        if (url) img.src = url;
      })
      .catch(() => holder && holder.classList.remove('loading'));
  });
}

const paletteDots = (colors, size = 10) =>
  colors.length ? `<div class="palette">${colors.map((c) => `<i style="background:#${esc(c)};width:${size}px;height:${size}px"></i>`).join('')}</div>` : '';

const catIcon = (name, size = 32) => {
  const c = catOf(name);
  return `<span class="cat-icon" style="width:${size}px;height:${size}px;background:#${c.hex}2e;color:#${c.hex}">${icon(c.icon)}</span>`;
};

const badge = (name) => (name ? `<span class="badge" style="background:#${catOf(name).hex}33">${esc(name)}</span>` : '');

function eventRow(e, readOnly) {
  const line = e.duration != null ? `${e.title} — ${e.duration} min` : e.title;
  return `<button class="row" data-action="openEvent" data-id="${e.id}" data-readonly="${readOnly ? 1 : 0}">
    ${catIcon(e.category)}
    <span class="row-text"><span class="body">${esc(line)}</span><span class="caption">${esc(timestamp(new Date(e.dateOccurred)))}</span></span>
  </button>`;
}

// ------------------------------------------------------------ Home

function viewHome() {
  const key = currentMonth();
  const look = lookFor(key);
  const start = monthStart(key);
  const events = eventsBetween(start, monthStart(addMonths(key, 1))).sort(
    (a, b) => b.dateOccurred.localeCompare(a.dateOccurred) || b.createdAt.localeCompare(a.createdAt)
  );
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  const hint =
    !standalone && !prefs.hideInstallHint
      ? `<div class="install-hint">${icon('share')}<p>To install: tap <b>Share</b>, then <b>Add to Home Screen</b>.</p><button data-action="hideHint">Hide</button></div>`
      : '';

  return `<div class="page tight">
    ${hint}
    <h1>${esc(monthTitle(key))}</h1>
    ${look.title ? `<div class="body muted">${esc(look.title)}</div>` : ''}
    ${paletteDots(look.palette)}
    ${look.images.length ? `<div class="strip">${look.images.map((n) => `<div class="sq"><img data-file="${esc(monthImageKey(key, n))}" alt=""></div>`).join('')}</div>` : ''}
    ${
      events.length
        ? `<div class="list">${events.map((e) => eventRow(e, false)).join('')}</div>`
        : `<div class="blank">${esc(monthName(key))} is blank. Tap + to add something.</div>`
    }
  </div>`;
}

// ------------------------------------------------------------ Calendar (Map + Archive)

function monthWeeks(key) {
  const first = monthStart(key);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() - firstWeekday() + 7) % 7;
  const cells = Array(lead).fill(null);
  for (let i = 0; i < count; i++) cells.push(new Date(first.getFullYear(), first.getMonth(), i + 1));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function weekStartOf(date) {
  const d = startOfDay(date);
  return addDays(d, -((d.getDay() - firstWeekday() + 7) % 7));
}

/** Thread bars for one week row, lanes assigned so bars and labels never overlap. */
function barSegments(days, threads, visibleStartYMD) {
  const candidates = [];
  for (const t of threads) {
    const cols = [];
    days.forEach((d, i) => {
      if (!d) return;
      const s = ymd(d);
      if (s >= t.startDate && (!t.endDate || s <= t.endDate)) cols.push(i);
    });
    if (!cols.length) continue;
    const first = cols[0];
    const last = cols[cols.length - 1];
    const showsLabel = ymd(days[first]) === maxStr(t.startDate, visibleStartYMD);
    candidates.push({
      t,
      first,
      last,
      labelEnd: showsLabel ? Math.min(6, Math.max(last, first + 2)) : last,
      label: showsLabel ? (t.endDate ? t.title : `${t.title} · ongoing`) : null,
    });
  }
  candidates.sort((a, b) => a.first - b.first || a.t.startDate.localeCompare(b.t.startDate));
  const laneEnds = [];
  for (const c of candidates) {
    const occupied = Math.max(c.last, c.labelEnd);
    let lane = laneEnds.findIndex((end) => end < c.first);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(occupied);
    } else {
      laneEnds[lane] = occupied;
    }
    c.lane = lane;
  }
  return { segments: candidates, lanes: laneEnds.length };
}

function calendarGrid(weeks, startDate, endDate, accentHex, readOnly) {
  const startYMD = ymd(startDate);
  const lastYMD = ymd(addDays(endDate, -1));
  const threads = threadsOverlapping(startYMD, lastYMD);
  const byDay = {};
  for (const e of eventsBetween(startDate, endDate).sort((a, b) => a.dateOccurred.localeCompare(b.dateOccurred))) {
    const k = ymd(new Date(e.dateOccurred));
    (byDay[k] = byDay[k] || []).push(e);
  }
  const todayYMD = ymd(new Date());
  const sunday = new Date(2023, 0, 1); // a Sunday
  const headers = [...Array(7)].map((_, i) => F.weekday.format(addDays(sunday, (firstWeekday() + i) % 7)));
  const todayBg = accentHex ? `#${accentHex}` : 'var(--text)';
  const todayFg = accentHex ? (brightness(accentHex) > 0.6 ? '#000' : '#fff') : 'var(--bg)';

  const rows = weeks
    .map((days) => {
      const { segments, lanes } = barSegments(days, threads, startYMD);
      const nums = days
        .map((d) => {
          if (!d) return '<div class="day"><span class="num"></span></div>';
          const isToday = ymd(d) === todayYMD;
          const style = isToday ? ` style="background:${todayBg};color:${todayFg}"` : '';
          return `<div class="day"><span class="num${isToday ? ' today' : ''}"${style}>${d.getDate()}</span></div>`;
        })
        .join('');
      const bars = lanes
        ? `<div class="bars" style="height:${lanes * LANE_HEIGHT}px">${segments
            .map((s) => {
              const left = `calc(${s.first} * 100% / 7 + 3px)`;
              const y = s.lane * LANE_HEIGHT;
              const label = s.label
                ? `<div class="bar-label" style="left:${left};top:${y}px;width:calc(${s.labelEnd - s.first + 1} * 100% / 7 - 6px)">${esc(s.label)}</div>`
                : '';
              return `${label}<div class="bar" style="left:${left};top:${y + 17}px;width:calc(${s.last - s.first + 1} * 100% / 7 - 6px);background:#${esc(s.t.color)}"></div>`;
            })
            .join('')}</div>`
        : '';
      const dots = days
        .map((d) => {
          const items = d ? byDay[ymd(d)] || [] : [];
          const readonlyFlag = readOnly ? 1 : -1;
          return `<div class="cell">${items
            .map((e) => `<button class="ev-dot" data-action="openEvent" data-id="${e.id}" data-readonly="${readonlyFlag}" aria-label="${esc(e.title)}"><i style="background:#${catOf(e.category).hex}"></i></button>`)
            .join('')}</div>`;
        })
        .join('');
      return `<div class="week"><div class="days">${nums}</div>${bars}<div class="dots">${dots}</div></div>`;
    })
    .join('');

  return `<div class="cal"><div class="wk-head">${headers.map((h) => `<span>${esc(h)}</span>`).join('')}</div>${rows}</div>`;
}

function monthField(lookKey, startDate, endDate, weeks, readOnly) {
  const look = lookFor(lookKey);
  return `
    ${look.title ? `<div class="body muted">${esc(look.title)}</div>` : ''}
    ${paletteDots(look.palette)}
    ${calendarGrid(weeks, startDate, endDate, look.palette[0], readOnly)}
    ${look.images.length ? `<div class="img-grid">${look.images.map((n) => `<div class="sq"><img data-file="${esc(monthImageKey(lookKey, n))}" alt=""></div>`).join('')}</div>` : ''}`;
}

// ------------------------------------------------------------ Map

function viewMap() {
  let start, end, weeks, lookKey, title;
  if (prefs.weekView) {
    start = weekStartOf(parseYMD(state.weekAnchor));
    end = addDays(start, 7);
    weeks = [[...Array(7)].map((_, i) => addDays(start, i))];
    lookKey = monthKeyOf(addDays(start, 3));
    title = rangeText(ymd(start), ymd(addDays(start, 6)));
  } else {
    start = monthStart(state.mapMonth);
    end = monthStart(addMonths(state.mapMonth, 1));
    weeks = monthWeeks(state.mapMonth);
    lookKey = state.mapMonth;
    title = monthTitle(state.mapMonth);
  }
  const unit = prefs.weekView ? 'week' : 'month';
  return `<div class="page">
    <div class="month-head">
      <button class="arrow" data-action="mapStep" data-dir="-1" aria-label="Previous ${unit}">${icon('left')}</button>
      <h1>${esc(title)}</h1>
      <button class="arrow" data-action="mapStep" data-dir="1" aria-label="Next ${unit}">${icon('right')}</button>
    </div>
    ${monthField(lookKey, start, end, weeks, false)}
  </div>`;
}

// ------------------------------------------------------------ Add

function chips(form, selected) {
  return `<div class="chips">${CATEGORIES.map((c) => {
    const on = selected === c.name;
    return `<button class="chip${on ? ' on' : ''}" style="${on ? `background:#${c.hex}` : ''}" data-action="pickCategory" data-form="${form}" data-category="${c.name}" aria-pressed="${on}">${icon(c.icon)}<span>${c.name}</span></button>`;
  }).join('')}</div>`;
}

function swatches(form, selected, colors = THREAD_COLORS) {
  return `<div class="swatches">${colors
    .map((hex) => `<button class="swatch${selected === hex ? ' on' : ''}" data-action="pickColor" data-form="${form}" data-hex="${hex}" aria-label="Color ${hex}" aria-pressed="${selected === hex}"><span style="background:#${hex}"></span></button>`)
    .join('')}</div>`;
}

const activeThreads = () => data.threads.filter((t) => !t.archived).sort((a, b) => a.title.localeCompare(b.title) || a.startDate.localeCompare(b.startDate));

function viewAdd() {
  return `<div class="page">
    <div class="segmented" role="tablist">
      <button class="${state.addMode === 'did' ? 'on' : ''}" data-action="addMode" data-mode="did">I did something</button>
      <button class="${state.addMode === 'want' ? 'on' : ''}" data-action="addMode" data-mode="want">I want this to happen</button>
    </div>
    ${state.addMode === 'did' ? eventFormHTML() : threadFormHTML()}
  </div>`;
}

function eventFormHTML() {
  const f = state.ef;
  const threads = activeThreads();
  return `
    <div class="section"><span class="label">When</span>
      <input class="field" type="datetime-local" data-bind="ef.date" value="${esc(f.date)}" max="${esc(localInputValue(new Date()))}">
    </div>
    <div class="section"><span class="label">Title</span>
      <input class="field" type="text" data-bind="ef.title" value="${esc(f.title)}" placeholder="e.g. Studied Spanish" enterkeyhint="done" autocomplete="off">
    </div>
    <div class="section"><span class="label">Category</span>${chips('ef', f.category)}</div>
    <div class="section"><span class="label">Duration (minutes, optional)</span>
      <input class="field" type="text" inputmode="numeric" pattern="[0-9]*" data-bind="ef.duration" value="${esc(f.duration)}" placeholder="e.g. 25">
      <span class="caption danger hidden" id="durationError">Enter a whole number of minutes.</span>
    </div>
    <div class="section"><span class="label">Thread (optional)</span>
      <select class="field" data-bind="ef.threadId">
        <option value="">None</option>
        ${threads.map((t) => `<option value="${t.id}" ${f.threadId === t.id ? 'selected' : ''}>${esc(t.title)} · ${esc(rangeText(t.startDate, t.endDate))}</option>`).join('')}
      </select>
    </div>
    <div class="section"><span class="label">Notes (optional)</span>
      <textarea class="field" data-bind="ef.notes">${esc(f.notes)}</textarea>
    </div>
    <div class="section"><span class="label">Photo (optional)</span>
      <label class="field file-btn">${icon('camera')}<span>${f.photo ? 'Replace photo' : 'Add photo'}</span>${f.processing ? '<span class="muted">Processing…</span>' : ''}
        <input type="file" accept="image/*" data-file-input="eventPhoto">
      </label>
      ${f.photoURL ? `<div class="photo"><img src="${f.photoURL}" alt=""><button class="remove-x" data-action="removeEventPhoto" aria-label="Remove photo">${icon('x')}</button></div>` : ''}
    </div>
    <button class="btn-primary" data-action="saveEvent" data-valid="event">Save</button>`;
}

function threadFormHTML() {
  const f = state.tf;
  const tied = f.tieTo ? threadById(f.tieTo) : null;
  const threads = activeThreads();
  return `
    <div class="section"><span class="label">Start date</span>
      <input class="field" type="date" data-bind="tf.start" data-rerender="1" value="${esc(f.start)}">
    </div>
    <div class="section"><span class="label">End date</span>
      <div class="field row-field"><span>No end date (ongoing)</span>
        <label class="toggle"><input type="checkbox" data-bind="tf.ongoing" data-rerender="1" ${f.ongoing ? 'checked' : ''}><span></span></label>
      </div>
      ${f.ongoing ? '' : `<input class="field" type="date" data-bind="tf.end" value="${esc(f.end)}" min="${esc(f.start)}">`}
    </div>
    <div class="section"><span class="label">Title</span>
      ${
        tied
          ? `<div class="field muted">${esc(tied.title)}</div>`
          : `<input class="field" type="text" data-bind="tf.title" value="${esc(f.title)}" placeholder="e.g. Master applications" enterkeyhint="done" autocomplete="off">`
      }
    </div>
    <div class="section"><span class="label">Category</span>${chips('tf', f.category)}</div>
    <div class="section"><span class="label">Thread</span>
      <select class="field" data-bind="tf.tieTo" data-rerender="1">
        <option value="">Create a new thread</option>
        ${threads.map((t) => `<option value="${t.id}" ${f.tieTo === t.id ? 'selected' : ''}>Tie to: ${esc(t.title)} · ${esc(rangeText(t.startDate, t.endDate))}</option>`).join('')}
      </select>
    </div>
    <div class="section"><span class="label">Color</span>
      ${
        tied
          ? `<div class="field row-field" style="justify-content:flex-start"><span class="dot" style="width:24px;height:24px;background:#${esc(tied.color)}"></span><span class="label">Uses the color of “${esc(tied.title)}”</span></div>`
          : swatches('tf', f.color)
      }
    </div>
    <button class="btn-primary" data-action="saveThread" data-valid="thread">Save</button>`;
}

// ------------------------------------------------------------ Event detail

function viewEventDetail(id, readOnly) {
  const e = eventById(id);
  if (!e) return `${navbar('')}<div class="page"><div class="blank">This event no longer exists.</div></div>`;
  const c = catOf(e.category);
  const thread = e.threadId ? threadById(e.threadId) : null;
  return `${navbar('')}
  <div class="page">
    <div class="row-field" style="justify-content:flex-start;gap:8px">${catIcon(e.category, 28)}<span class="label">${esc(c.name)}</span>${readOnly ? '<span class="caption" style="margin-left:auto">Archived</span>' : ''}</div>
    <h1>${esc(e.title)}</h1>
    <div class="section"><span class="label">When</span><span>${esc(F.full.format(new Date(e.dateOccurred)))}</span></div>
    ${e.duration != null ? `<div class="section"><span class="label">Duration</span><span>${e.duration} min</span></div>` : ''}
    ${
      e.threadId
        ? `<div class="section"><span class="label">Thread</span>${
            thread
              ? `<button class="card" ${readOnly ? 'disabled style="opacity:1"' : `data-action="openThread" data-id="${thread.id}"`}>
                  <span class="dot" style="background:#${esc(thread.color)}"></span>
                  <span class="row-text"><span>${esc(thread.title)}</span><span class="caption">${esc(rangeText(thread.startDate, thread.endDate))}</span></span>
                  ${readOnly ? '' : icon('right', 'chev')}
                </button>`
              : '<span class="muted">Thread removed</span>'
          }</div>`
        : ''
    }
    ${e.notes ? `<div class="section"><span class="label">Notes</span><span style="white-space:pre-wrap">${esc(e.notes)}</span></div>` : ''}
    ${e.photoPath ? `<div class="photo"><img data-file="${esc(e.photoPath)}" alt=""></div>` : ''}
    ${readOnly ? '' : `<button class="btn-secondary danger" data-action="deleteEvent" data-id="${e.id}" style="margin-top:8px">Delete</button>`}
  </div>`;
}

// ------------------------------------------------------------ Threads

function relevanceSorted(list) {
  const today = ymd(new Date());
  const rank = (t) => (t.startDate > today ? 1 : t.endDate && t.endDate < today ? 2 : 0);
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return b.startDate.localeCompare(a.startDate);
    if (ra === 1) return a.startDate.localeCompare(b.startDate);
    return (b.endDate || '').localeCompare(a.endDate || '');
  });
}

function threadCard(t) {
  return `<button class="card${t.archived ? ' dim' : ''}" data-action="openThread" data-id="${t.id}" data-longpress="threadMenu">
    <span class="dot" style="background:#${esc(t.color)}"></span>
    <span class="row-text"><span>${esc(t.title)}</span><span class="caption">${esc(rangeText(t.startDate, t.endDate))}</span></span>
    ${badge(t.category)}
  </button>`;
}

function viewThreads() {
  if (!data.threads.length) {
    return `<div class="page"><h1>Threads</h1><div class="blank">No threads yet. Create one in Add &gt; Mode B or via +.</div></div>`;
  }
  const sort = (list) => (state.threadSort === 'alpha' ? [...list].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })) : relevanceSorted(list));
  const active = sort(data.threads.filter((t) => !t.archived));
  const archived = sort(data.threads.filter((t) => t.archived));
  return `<div class="page tight">
    <h1>Threads</h1>
    <div class="segmented" style="margin:8px 0">
      <button class="${state.threadSort === 'relevance' ? 'on' : ''}" data-action="threadSort" data-sort="relevance">Relevance</button>
      <button class="${state.threadSort === 'alpha' ? 'on' : ''}" data-action="threadSort" data-sort="alpha">A–Z</button>
    </div>
    ${active.map(threadCard).join('')}
    ${archived.length ? `<span class="label" style="margin-top:16px">Archived</span>${archived.map(threadCard).join('')}` : ''}
  </div>`;
}

function viewThreadDetail(id) {
  const t = threadById(id);
  if (!t) return `${navbar('')}<div class="page"><div class="blank">This thread was removed.</div></div>`;
  const linked = data.events
    .filter((e) => e.threadId === t.id && !e.archived)
    .sort((a, b) => b.dateOccurred.localeCompare(a.dateOccurred) || b.createdAt.localeCompare(a.createdAt));
  return `${navbar('', `<button class="nav-btn" data-action="editThread" data-id="${t.id}">Edit</button>`)}
  <div class="page">
    <div class="row-field" style="justify-content:flex-start">
      <span class="dot" style="width:14px;height:14px;background:#${esc(t.color)}"></span>${badge(t.category)}${t.archived ? '<span class="caption">Archived</span>' : ''}
    </div>
    <h1>${esc(t.title)}</h1>
    <div class="section">
      <span class="label">Start</span>
      <input class="field" type="date" value="${esc(t.startDate)}" data-change="threadStart" data-id="${t.id}">
      <div class="field row-field"><span>No end date (ongoing)</span>
        <label class="toggle"><input type="checkbox" ${t.endDate ? '' : 'checked'} data-change="threadOngoing" data-id="${t.id}"><span></span></label>
      </div>
      ${t.endDate ? `<span class="label">End</span><input class="field" type="date" value="${esc(t.endDate)}" min="${esc(t.startDate)}" data-change="threadEnd" data-id="${t.id}">` : ''}
    </div>
    <div class="section"><span class="label">Linked events</span>
      ${linked.length ? `<div class="list">${linked.map((e) => eventRow(e, isPastMonth(eventMonth(e)))).join('')}</div>` : '<span class="muted">No linked events.</span>'}
    </div>
    <div class="section" style="margin-top:8px">
      <button class="btn-secondary" data-action="archiveThread" data-id="${t.id}">${t.archived ? 'Unarchive' : 'Archive'}</button>
      <button class="btn-secondary danger" data-action="deleteThread" data-id="${t.id}">Delete</button>
    </div>
  </div>`;
}

function viewThreadEdit() {
  const f = state.te;
  if (!f || !threadById(f.id)) return `${navbar('')}<div class="page"><div class="blank">This thread was removed.</div></div>`;
  const colors = THREAD_COLORS.includes(f.color) ? THREAD_COLORS : [...THREAD_COLORS, f.color];
  return `${navbar('Edit thread', '<button class="nav-btn strong" data-action="saveThreadEdit" data-valid="threadEdit">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Title</span><input class="field" type="text" data-bind="te.title" value="${esc(f.title)}" autocomplete="off"></div>
    <div class="section"><span class="label">Category</span>${chips('te', f.category)}</div>
    <div class="section"><span class="label">Color</span>${swatches('te', f.color, colors)}</div>
    <div class="section"><span class="label">Start date</span><input class="field" type="date" data-bind="te.start" data-rerender="1" value="${esc(f.start)}"></div>
    <div class="section"><span class="label">End date</span>
      <div class="field row-field"><span>No end date (ongoing)</span>
        <label class="toggle"><input type="checkbox" data-bind="te.ongoing" data-rerender="1" ${f.ongoing ? 'checked' : ''}><span></span></label>
      </div>
      ${f.ongoing ? '' : `<input class="field" type="date" data-bind="te.end" value="${esc(f.end)}" min="${esc(f.start)}">`}
    </div>
  </div>`;
}

// ------------------------------------------------------------ Archive

function viewArchive() {
  const months = monthsWithContent();
  if (!months.length) return `<div class="page"><h1>Archive</h1><div class="blank">Nothing recorded yet.</div></div>`;
  return `<div class="page"><h1>Archive</h1><div class="tiles">${months
    .map((key) => {
      const look = lookFor(key);
      const cover = look.images[0]
        ? `<div class="sq"><img data-file="${esc(monthImageKey(key, look.images[0]))}" alt=""></div>`
        : `<div class="sq">${esc(monthName(key))}</div>`;
      return `<button class="tile" data-action="openMonth" data-month="${key}">${cover}<span class="tile-label">${esc(monthShort(key))}</span>${paletteDots(look.palette.slice(0, 4), 8)}</button>`;
    })
    .join('')}</div></div>`;
}

function viewArchiveMonth(key) {
  return `${navbar('')}<div class="page">
    <h1>${esc(monthTitle(key))}</h1>
    ${monthField(key, monthStart(key), monthStart(addMonths(key, 1)), monthWeeks(key), true)}
  </div>`;
}

// ------------------------------------------------------------ Settings

function settingsRow(label, ic, action, extra = '') {
  return `<button class="settings-row" data-action="${action}">${icon(ic, 'ic')}<span class="grow">${label}</span>${extra}${icon('right', 'chev')}</button>`;
}

function viewSettings() {
  return `<div class="page"><h1>Settings</h1>
    <div class="settings-list">
      ${settingsRow('Appearance', 'palette', 'openAppearance')}
      ${settingsRow('Calendar &amp; Time', 'calendar', 'openCalendarSettings')}
      ${settingsRow('Categories', 'grid', 'openCategories')}
      ${settingsRow('Data &amp; Export', 'drive', 'openData')}
      ${settingsRow('Notifications', 'bell', 'openNotifications')}
      ${settingsRow('Privacy', 'lock', 'openPrivacy')}
      ${settingsRow('About', 'info', 'openAbout')}
    </div></div>`;
}

function viewAppearance() {
  return `${navbar('Appearance')}<div class="page tight">
    <div class="settings-list">${settingsRow('Personalized Mode', 'palette', 'openPersonalize')}</div>
    <p class="footnote">Give each month its own images, colors and title.</p>
  </div>`;
}

function viewCalendarSettings() {
  return `${navbar('Calendar & Time')}<div class="page tight">
    <div class="settings-list">
      <div class="settings-row"><span class="grow">Start day</span>
        <select data-change="setStartDay" style="border:0;background:none;font-size:16px;color:var(--text2)">
          <option value="mon" ${prefs.mondayFirst ? 'selected' : ''}>Monday</option>
          <option value="sun" ${prefs.mondayFirst ? '' : 'selected'}>Sunday</option>
        </select>
      </div>
      <div class="settings-row"><span class="grow">Week view</span>
        <label class="toggle"><input type="checkbox" data-change="setWeekView" ${prefs.weekView ? 'checked' : ''}><span></span></label>
      </div>
    </div>
    <p class="footnote">Week view shows one week at a time on the Map.</p>
  </div>`;
}

function viewCategories() {
  return `${navbar('Categories')}<div class="page tight">
    <div class="settings-list">${CATEGORIES.map(
      (c) => `<div class="settings-row">${catIcon(c.name, 28)}<span class="grow">${c.name}</span><span class="caption">#${c.hex}</span></div>`
    ).join('')}</div>
    <p class="footnote">Preset list. Custom categories are not in this build.</p>
  </div>`;
}

function viewNotInBuild(title, rows, note) {
  return `${navbar(title)}<div class="page tight">
    <div class="settings-list">${rows.map((r) => `<div class="settings-row"><span class="grow">${esc(r)}</span><span class="label">Not in this build</span></div>`).join('')}</div>
    ${note ? `<p class="footnote">${esc(note)}</p>` : ''}
  </div>`;
}

function viewPrivacy() {
  return `${navbar('Privacy')}<div class="page tight">
    <h1>Everything stays on this device.</h1>
    <p>Events, threads, photos and month personalization are stored only in this app's storage on your iPhone. Nothing is synced, uploaded or sent to any server. There is no account and no API.</p>
  </div>`;
}

function viewAbout() {
  return `${navbar('About')}<div class="page tight">
    <h1>Christina</h1>
    <span class="label">Version 1.0</span>
    <p style="margin-top:16px">A visual system for seeing life accumulate over time.</p>
    <p style="margin:0">What actually happened?</p>
    <p style="margin:0">Evidence over guilt. Temporal continuity over streaks.</p>
  </div>`;
}

// ------------------------------------------------------------ Personalized Mode

function loadPersonalization(month) {
  if (state.pm) state.pm.images.forEach((img) => img.blob && URL.revokeObjectURL(img.url));
  const look = lookFor(month);
  state.pm = {
    month,
    images: look.images.map((name) => ({ id: uuid(), name })),
    original: [...look.images],
    palette: [...look.palette],
    title: look.title || '',
    custom: '#4A90E2',
    processing: false,
  };
}

function viewPersonalize() {
  const p = state.pm;
  const cur = currentMonth();
  const editable = p.month === cur;
  const past = monthsWithContent().filter((k) => k < cur).reverse();
  const paletteOK = p.palette.length === 0 || (p.palette.length >= 3 && p.palette.length <= 5);

  const thumbs = p.images
    .map((img) => {
      const src = img.blob ? `src="${img.url}"` : `data-file="${esc(monthImageKey(p.month, img.name))}"`;
      return `<div class="sq">
        ${
          editable
            ? `<label style="display:block;width:100%;height:100%"><img ${src} alt=""><input type="file" accept="image/*" data-file-input="pmReplace" data-id="${img.id}"></label>
               <button class="remove-x" data-action="pmRemove" data-id="${img.id}" aria-label="Remove image">${icon('x')}</button>`
            : `<img ${src} alt="">`
        }
      </div>`;
    })
    .join('');
  const addTile =
    editable && p.images.length < MAX_MONTH_IMAGES
      ? `<label class="sq add-tile" aria-label="Add images">${p.processing ? '<span class="muted">…</span>' : icon('plus')}<input type="file" accept="image/*" multiple data-file-input="pmAdd"></label>`
      : '';

  return `${navbar('Personalized Mode')}<div class="page">
    <div class="section"><span class="label">Month</span>
      <select class="field" data-change="pmMonth">
        <option value="${cur}" ${editable ? 'selected' : ''}>Current month (${esc(monthTitle(cur))})</option>
        ${past.map((k) => `<option value="${k}" ${p.month === k ? 'selected' : ''}>${esc(monthTitle(k))}</option>`).join('')}
      </select>
      ${editable ? '' : '<span class="caption">Past months are archived and read-only. Changing the current month never affects them.</span>'}
    </div>

    <div class="section"><span class="label">Images (${p.images.length}/${MAX_MONTH_IMAGES})</span>
      <div class="img-grid">${thumbs}${addTile}</div>
      ${!editable && !p.images.length ? '<span class="muted">No images.</span>' : ''}
    </div>

    <div class="section"><span class="label">Color palette</span>
      <div class="field row-field">
        <div class="palette" style="gap:8px">${
          p.palette.length
            ? p.palette.map((h) => `<button data-action="pmToggle" data-hex="${h}" ${editable ? '' : 'disabled style="opacity:1"'} aria-label="Remove color ${h}"><i style="display:block;width:28px;height:28px;border-radius:50%;background:#${h};box-shadow:inset 0 0 0 1px var(--hair)"></i></button>`).join('')
            : '<span class="muted">No colors selected</span>'
        }</div>
        <span class="caption ${paletteOK ? '' : 'danger'}">${p.palette.length} of 3–5</span>
      </div>
      ${
        editable
          ? PALETTES.map(
              (pal) => `<div class="row-field">
                <button data-action="pmPreset" data-name="${pal.name}" style="width:64px;text-align:left;font-size:14px">${pal.name}</button>
                ${pal.colors
                  .map((h) => {
                    const on = p.palette.includes(h);
                    return `<button class="swatch${on ? ' on' : ''}" style="flex:1;min-height:40px" data-action="pmToggle" data-hex="${h}" aria-pressed="${on}" aria-label="Color ${h}"><span style="width:30px;height:30px;background:#${h}"></span></button>`;
                  })
                  .join('')}
              </div>`
            ).join('') +
            `<div class="field row-field"><span>Custom color</span>
              <span style="display:flex;gap:12px;align-items:center">
                <input type="color" data-bind="pm.custom" value="${esc(p.custom)}" style="width:44px;height:32px;border:0;background:none;padding:0">
                <button data-action="pmAddCustom" style="font-weight:600">Add</button>
              </span></div>
            <span class="caption">Tap a palette name to use it, or tap single colors to build your own (3–5 colors).</span>`
          : ''
      }
    </div>

    <div class="section"><span class="label">Month title (optional)</span>
      ${
        editable
          ? `<input class="field" type="text" data-bind="pm.title" value="${esc(p.title)}" placeholder="e.g. Becoming serious" autocomplete="off">`
          : `<div class="field ${p.title ? '' : 'muted'}">${esc(p.title || 'No title')}</div>`
      }
    </div>

    ${editable ? '<button class="btn-primary" data-action="pmSave" data-valid="pm">Save</button>' : ''}
  </div>`;
}

// ============================================================ Validation

const validators = {
  event() {
    const f = state.ef;
    const d = f.duration.trim();
    const durationOK = d === '' || (/^\d+$/.test(d) && Number(d) > 0);
    const err = $('#durationError');
    if (err) err.classList.toggle('hidden', durationOK);
    return f.title.trim() !== '' && !!f.category && durationOK && !!f.date && !f.processing;
  },
  thread() {
    const f = state.tf;
    const title = f.tieTo ? (threadById(f.tieTo) || {}).title : f.title.trim();
    return !!title && !!f.category && !!f.start && (f.ongoing || (!!f.end && f.end >= f.start));
  },
  threadEdit() {
    const f = state.te;
    return !!f && f.title.trim() !== '' && !!f.category && !!f.start && (f.ongoing || (!!f.end && f.end >= f.start));
  },
  pm() {
    const n = state.pm ? state.pm.palette.length : 0;
    return (n === 0 || (n >= 3 && n <= 5)) && !state.pm.processing;
  },
};

function refreshValidity() {
  document.querySelectorAll('[data-valid]').forEach((el) => {
    const check = validators[el.dataset.valid];
    if (check) el.disabled = !check();
  });
}

// ============================================================ Toast / sheet

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function actionSheet(title, buttons) {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-body">
    <div class="group"><div class="title">${esc(title)}</div>${buttons
      .map((b, i) => `<button data-sheet="${i}" style="${b.destructive ? 'color:var(--danger)' : ''}">${esc(b.label)}</button>`)
      .join('')}</div>
    <div class="group"><button data-sheet="cancel" style="font-weight:600">Cancel</button></div>
  </div>`;
  sheet.classList.remove('hidden');
  sheet.onclick = (event) => {
    const target = event.target.closest('[data-sheet]');
    if (!target && event.target !== sheet) return;
    sheet.classList.add('hidden');
    sheet.innerHTML = '';
    if (target && target.dataset.sheet !== 'cancel') buttons[Number(target.dataset.sheet)].run();
  };
}

function fail(error, action) {
  console.error(error);
  alert(`Couldn't ${action}. ${error && error.message ? error.message : error}`);
}

// ============================================================ Data changes

async function saveEvent() {
  const f = state.ef;
  if (!validators.event()) return;
  const event = {
    id: uuid(),
    dateOccurred: new Date(f.date).toISOString(),
    category: f.category,
    title: f.title.trim(),
    duration: f.duration.trim() ? Number(f.duration.trim()) : null,
    notes: f.notes.trim() || null,
    photoPath: null,
    threadId: f.threadId && threadById(f.threadId) ? f.threadId : null,
    createdAt: new Date().toISOString(),
    archived: false,
  };
  try {
    let record = null;
    if (f.photo) {
      await ensureSpace(f.photo.size);
      event.photoPath = `photos/${uuid()}.jpg`;
      record = await blobRecord(f.photo);
    }
    await DB.write(['events', 'files'], (tx) => {
      if (record) tx.objectStore('files').put(record, event.photoPath);
      tx.objectStore('events').put(event);
    });
  } catch (error) {
    return fail(error, 'save this event');
  }
  requestPersistence();
  data.events.push(event);
  if (f.photoURL) URL.revokeObjectURL(f.photoURL);
  state.ef = newEventForm();
  toast(`Saved to ${monthTitle(eventMonth(event))}`);
  state.tab = 'home';
  state.stacks.home = [];
  render();
}

async function saveThread(skipDuplicateCheck = false) {
  const f = state.tf;
  if (!validators.thread()) return;
  const tied = f.tieTo ? threadById(f.tieTo) : null;
  const title = tied ? tied.title : f.title.trim();
  if (!tied && !skipDuplicateCheck && data.threads.some((t) => t.title.toLowerCase() === title.toLowerCase())) {
    if (!confirm(`A thread named “${title}” already exists.\n\nIt will be saved as a separate thread.`)) return;
  }
  const thread = {
    id: uuid(),
    title,
    category: f.category,
    color: tied ? tied.color : f.color,
    startDate: f.start,
    endDate: f.ongoing ? null : f.end,
    archived: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await DB.write(['threads'], (tx) => tx.objectStore('threads').put(thread));
  } catch (error) {
    return fail(error, 'save this thread');
  }
  requestPersistence();
  data.threads.push(thread);
  state.tf = newThreadForm();
  state.addMode = 'did'; // Add opens in its default mode next time
  toast('Thread saved');
  state.tab = 'map';
  state.stacks.map = [];
  state.mapMonth = thread.startDate.slice(0, 7);
  state.weekAnchor = thread.startDate;
  render();
}

async function updateThread(thread, changes, action = 'update this thread') {
  const next = { ...thread, ...changes };
  try {
    await DB.write(['threads'], (tx) => tx.objectStore('threads').put(next));
  } catch (error) {
    fail(error, action);
    render();
    return false;
  }
  Object.assign(thread, changes);
  render();
  return true;
}

async function deleteEvent(id) {
  const e = eventById(id);
  if (!e) return;
  if (!confirm(e.photoPath ? 'Delete this event and its photo?' : 'Delete this event?')) return;
  try {
    await DB.write(['events', 'files'], (tx) => {
      tx.objectStore('events').delete(e.id);
      if (e.photoPath) tx.objectStore('files').delete(e.photoPath);
    });
  } catch (error) {
    return fail(error, 'delete this event');
  }
  if (e.photoPath) forgetFileURL(e.photoPath);
  data.events = data.events.filter((x) => x.id !== e.id);
  back();
}

/** Deletes the thread; linked events remain (their link is cleared). */
async function deleteThread(id, popAfter) {
  const t = threadById(id);
  if (!t) return;
  if (!confirm('Remove this thread? Linked events will remain.')) return;
  const linked = data.events.filter((e) => e.threadId === id);
  try {
    await DB.write(['threads', 'events'], (tx) => {
      tx.objectStore('threads').delete(id);
      for (const e of linked) tx.objectStore('events').put({ ...e, threadId: null });
    });
  } catch (error) {
    return fail(error, 'remove this thread');
  }
  linked.forEach((e) => (e.threadId = null));
  data.threads = data.threads.filter((x) => x.id !== id);
  if (popAfter) back();
  else render();
}

async function savePersonalization() {
  const p = state.pm;
  if (p.month !== currentMonth() || !validators.pm()) return;
  const month = p.month;
  const names = [];
  const newFiles = [];
  try {
    let bytes = 0;
    for (const img of p.images) {
      if (img.blob) {
        const name = `${uuid()}.jpg`;
        newFiles.push({ key: monthImageKey(month, name), record: await blobRecord(img.blob) });
        bytes += img.blob.size;
        names.push(name);
      } else {
        names.push(img.name);
      }
    }
    if (bytes) await ensureSpace(bytes);
    const removed = p.original.filter((n) => !names.includes(n));
    const existing = data.months[month];
    const record = {
      month,
      imagePaths: names.length ? names : null,
      colorPalette: p.palette.length ? [...p.palette] : null,
      monthTitle: p.title.trim() || null,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };
    await DB.write(['months', 'files'], (tx) => {
      const files = tx.objectStore('files');
      newFiles.forEach((f) => files.put(f.record, f.key));
      removed.forEach((n) => files.delete(monthImageKey(month, n)));
      tx.objectStore('months').put(record);
    });
    removed.forEach((n) => forgetFileURL(monthImageKey(month, n)));
    data.months[month] = record;
  } catch (error) {
    return fail(error, 'save this month');
  }
  requestPersistence();
  loadPersonalization(month);
  toast(`Saved ${monthTitle(month)}`);
  render();
}

// ============================================================ Actions

const actions = {
  tab(el) {
    const tab = el.dataset.tab;
    if (state.tab === tab) state.stacks[tab] = [];
    state.tab = tab;
    render();
  },
  back() {
    back();
  },
  hideHint() {
    prefs.hideInstallHint = true;
    Settings.write('hideInstallHint', true);
    render();
  },
  openEvent(el) {
    const e = eventById(el.dataset.id);
    if (!e) return;
    const flag = el.dataset.readonly;
    const readOnly = flag === '1' || (flag === '-1' && isPastMonth(eventMonth(e)));
    push({ name: 'event', id: e.id, readOnly });
  },
  deleteEvent(el) {
    deleteEvent(el.dataset.id);
  },
  mapStep(el) {
    const dir = Number(el.dataset.dir);
    if (prefs.weekView) state.weekAnchor = ymd(addDays(parseYMD(state.weekAnchor), 7 * dir));
    else state.mapMonth = addMonths(state.mapMonth, dir);
    render();
  },
  addMode(el) {
    state.addMode = el.dataset.mode;
    render();
  },
  pickCategory(el) {
    state[el.dataset.form].category = el.dataset.category;
    render();
  },
  pickColor(el) {
    state[el.dataset.form].color = el.dataset.hex;
    render();
  },
  removeEventPhoto() {
    if (state.ef.photoURL) URL.revokeObjectURL(state.ef.photoURL);
    state.ef.photo = null;
    state.ef.photoURL = null;
    render();
  },
  saveEvent() {
    saveEvent();
  },
  saveThread() {
    saveThread();
  },
  threadSort(el) {
    state.threadSort = el.dataset.sort;
    render();
  },
  openThread(el) {
    if (threadById(el.dataset.id)) push({ name: 'thread', id: el.dataset.id });
  },
  editThread(el) {
    const t = threadById(el.dataset.id);
    if (!t) return;
    state.te = { id: t.id, title: t.title, category: CAT[t.category] ? t.category : null, color: t.color, start: t.startDate, end: t.endDate || t.startDate, ongoing: !t.endDate };
    push({ name: 'threadEdit', id: t.id });
  },
  async saveThreadEdit() {
    const f = state.te;
    const t = threadById(f.id);
    if (!t || !validators.threadEdit()) return;
    const title = f.title.trim();
    if (title.toLowerCase() !== t.title.toLowerCase() && data.threads.some((x) => x.id !== t.id && x.title.toLowerCase() === title.toLowerCase())) {
      if (!confirm(`A thread named “${title}” already exists.\n\nBoth threads will be kept separately.`)) return;
    }
    const ok = await updateThread(t, { title, category: f.category, color: f.color, startDate: f.start, endDate: f.ongoing ? null : f.end });
    if (ok) back();
  },
  threadMenu(el) {
    const id = el.dataset.id;
    const t = threadById(id);
    if (!t) return;
    actionSheet(t.title, [
      { label: 'Edit', run: () => actions.editThread({ dataset: { id } }) },
      { label: 'Delete', destructive: true, run: () => deleteThread(id, false) },
    ]);
  },
  archiveThread(el) {
    const t = threadById(el.dataset.id);
    if (t) updateThread(t, { archived: !t.archived });
  },
  deleteThread(el) {
    deleteThread(el.dataset.id, true);
  },
  openMonth(el) {
    push({ name: 'archiveMonth', month: el.dataset.month });
  },
  openAppearance: () => push({ name: 'appearance' }),
  openPersonalize() {
    loadPersonalization(currentMonth());
    push({ name: 'personalize' });
  },
  openCalendarSettings: () => push({ name: 'calendarSettings' }),
  openCategories: () => push({ name: 'categories' }),
  openData: () => push({ name: 'data' }),
  openNotifications: () => push({ name: 'notifications' }),
  openPrivacy: () => push({ name: 'privacy' }),
  openAbout: () => push({ name: 'about' }),
  pmRemove(el) {
    const p = state.pm;
    const img = p.images.find((i) => i.id === el.dataset.id);
    if (img && img.blob) URL.revokeObjectURL(img.url);
    p.images = p.images.filter((i) => i.id !== el.dataset.id);
    render();
  },
  pmToggle(el) {
    const p = state.pm;
    if (p.month !== currentMonth()) return;
    const hex = el.dataset.hex;
    if (p.palette.includes(hex)) p.palette = p.palette.filter((h) => h !== hex);
    else if (p.palette.length < 5) p.palette.push(hex);
    render();
  },
  pmPreset(el) {
    const pal = PALETTES.find((x) => x.name === el.dataset.name);
    if (pal) state.pm.palette = pal.colors.slice(0, 5);
    render();
  },
  pmAddCustom() {
    const hex = state.pm.custom.replace('#', '').toUpperCase();
    if (/^[0-9A-F]{6}$/.test(hex) && !state.pm.palette.includes(hex) && state.pm.palette.length < 5) state.pm.palette.push(hex);
    render();
  },
  pmSave() {
    savePersonalization();
  },
};

const changeActions = {
  threadStart(el) {
    const t = threadById(el.dataset.id);
    if (!t || !el.value) return render();
    const changes = { startDate: el.value };
    if (t.endDate && t.endDate < el.value) changes.endDate = el.value;
    updateThread(t, changes);
  },
  threadEnd(el) {
    const t = threadById(el.dataset.id);
    if (!t || !el.value) return render();
    updateThread(t, { endDate: el.value < t.startDate ? t.startDate : el.value });
  },
  threadOngoing(el) {
    const t = threadById(el.dataset.id);
    if (t) updateThread(t, { endDate: el.checked ? null : t.startDate });
  },
  setStartDay(el) {
    prefs.mondayFirst = el.value === 'mon';
    Settings.write('mondayFirst', prefs.mondayFirst);
    render();
  },
  setWeekView(el) {
    prefs.weekView = el.checked;
    Settings.write('weekView', prefs.weekView);
    render();
  },
  pmMonth(el) {
    loadPersonalization(el.value);
    render();
  },
};

const fileActions = {
  async eventPhoto(files) {
    const f = state.ef;
    f.processing = true;
    render();
    try {
      const blob = await compressImage(files[0]);
      if (f.photoURL) URL.revokeObjectURL(f.photoURL);
      f.photo = blob;
      f.photoURL = URL.createObjectURL(blob);
    } catch (error) {
      alert(`Photo problem. ${error.message}`);
    } finally {
      f.processing = false;
      render();
    }
  },
  async pmAdd(files) {
    const p = state.pm;
    p.processing = true;
    render();
    const room = MAX_MONTH_IMAGES - p.images.length;
    let failure = null;
    for (const file of [...files].slice(0, room)) {
      try {
        const blob = await compressImage(file);
        p.images.push({ id: uuid(), blob, url: URL.createObjectURL(blob) });
      } catch (error) {
        failure = error;
      }
    }
    p.processing = false;
    if (files.length > room) alert(`Only ${MAX_MONTH_IMAGES} images per month. The extra ones were left out.`);
    if (failure) alert(`Photo problem. ${failure.message}`);
    render();
  },
  async pmReplace(files, el) {
    const p = state.pm;
    const index = p.images.findIndex((i) => i.id === el.dataset.id);
    if (index === -1) return;
    p.processing = true;
    render();
    try {
      const blob = await compressImage(files[0]);
      const old = p.images[index];
      if (old.blob) URL.revokeObjectURL(old.url);
      p.images[index] = { id: uuid(), blob, url: URL.createObjectURL(blob) };
    } catch (error) {
      alert(`Photo problem. ${error.message}`);
    } finally {
      p.processing = false;
      render();
    }
  },
};

function setPath(path, value) {
  const [form, field] = path.split('.');
  if (state[form]) state[form][field] = value;
}

// ============================================================ Events

let longPressTimer = null;
let suppressClick = false;

function bindEvents() {
  document.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = actions[el.dataset.action];
    if (action) {
      event.preventDefault();
      action(el, event);
    }
  });

  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset && el.dataset.bind && el.type !== 'checkbox' && el.tagName !== 'SELECT') {
      setPath(el.dataset.bind, el.value);
      refreshValidity();
    }
  });

  document.addEventListener('change', (event) => {
    const el = event.target;
    if (!el.dataset) return;
    if (el.dataset.bind) {
      setPath(el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
      if (el.dataset.rerender) {
        if (el.dataset.bind === 'tf.start' && !state.tf.ongoing && state.tf.end < state.tf.start) state.tf.end = state.tf.start;
        if (el.dataset.bind === 'te.start' && state.te && !state.te.ongoing && state.te.end < state.te.start) state.te.end = state.te.start;
        render();
      } else {
        refreshValidity();
      }
    } else if (el.dataset.change && changeActions[el.dataset.change]) {
      changeActions[el.dataset.change](el);
    } else if (el.dataset.fileInput && el.files && el.files.length) {
      const files = [...el.files];
      el.value = '';
      fileActions[el.dataset.fileInput](files, el);
    }
  });

  // Long-press (thread cards → Edit / Delete).
  const cancelLongPress = () => clearTimeout(longPressTimer);
  document.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('[data-longpress]');
    if (!el) return;
    const startX = event.clientX;
    const startY = event.clientY;
    cancelLongPress();
    longPressTimer = setTimeout(() => {
      suppressClick = true;
      if (navigator.vibrate) navigator.vibrate(10);
      actions[el.dataset.longpress](el);
    }, 500);
    const move = (e) => {
      if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) cancelLongPress();
    };
    el.addEventListener('pointermove', move, { once: false });
    const end = () => {
      cancelLongPress();
      el.removeEventListener('pointermove', move);
    };
    el.addEventListener('pointerup', end, { once: true });
    el.addEventListener('pointercancel', end, { once: true });
  });
  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest('[data-longpress]')) event.preventDefault();
  });
}

// ============================================================ Boot

async function boot() {
  bindEvents();
  try {
    await DB.open();
    const [events, threads, months] = await Promise.all([DB.getAll('events'), DB.getAll('threads'), DB.getAll('months')]);
    data.events = events;
    data.threads = threads;
    data.months = Object.fromEntries(months.map((m) => [m.month, m]));
  } catch (error) {
    $('#main').innerHTML = `<div class="page"><div class="blank">Christina couldn't open its data. ${esc(error && error.message ? error.message : String(error))}</div></div>`;
    return;
  }
  render();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

boot();
