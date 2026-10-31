/* Christina — dates, formatting, ids, escaping. No app state. */
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

const $ = (sel, root = document) => root.querySelector(sel);
export {
  esc, uuid, pad, ymd, parseYMD, startOfDay, addDays, monthKeyOf, monthStart, addMonths, currentMonth,
  localInputValue, maxStr, F, monthTitle, monthShort, monthName, timestamp, rangeText, brightness, $,
};
