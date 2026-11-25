/* Christina — importing a calendar file (.ics) as Calendar plans (store 'schedule').
 * Each event becomes a plan: SUMMARY → title, DTSTART/DTEND → date, time, endTime (all-day events have no time),
 * DESCRIPTION and LOCATION → notes, CATEGORIES → the category with that name, VALARM → reminder.
 * Ids come from the event's UID, so importing the same file again updates those plans instead of adding copies.
 * Plans already in Christina are never removed. */
import { data } from '../core/db.js';
import { putItems } from '../core/repo.js';
import { ymd } from '../core/util.js';

const pad = (n) => String(n).padStart(2, '0');
const unescape = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** Lines unfolded, as [name, params, value]. */
function lines(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(':');
      const head = line.slice(0, i);
      const [name, ...params] = head.split(';');
      return [name.toUpperCase(), params.join(';').toUpperCase(), line.slice(i + 1)];
    });
}

/** { date, time } in local time ('Z' times are converted; floating and TZID times are kept as written). */
function when(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (h === undefined || params.includes('VALUE=DATE')) return { date: `${y}-${mo}-${d}`, time: null };
  if (z) {
    const t = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    return { date: ymd(t), time: `${pad(t.getHours())}:${pad(t.getMinutes())}` };
  }
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

function minutesBefore(trigger) {
  const m = /^-?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(trigger.trim());
  if (!m) return null;
  return (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

/** Parses a calendar file into plans. */
function parseICS(text) {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That file is not a calendar (.ics) file.');
  const cats = new Map(data.categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const plans = [];
  let ev = null;
  let inAlarm = false;
  for (const [name, params, value] of lines(text)) {
    if (name === 'BEGIN' && value.toUpperCase() === 'VEVENT') ev = { notes: [] };
    else if (name === 'BEGIN' && value.toUpperCase() === 'VALARM') inAlarm = true;
    else if (name === 'END' && value.toUpperCase() === 'VALARM') inAlarm = false;
    else if (name === 'END' && value.toUpperCase() === 'VEVENT' && ev) {
      if (ev.start) {
        plans.push({
          id: `ics-${ev.uid || `${ev.start.date}-${ev.start.time}-${ev.title}`}`,
          title: ev.title || 'Event',
          date: ev.start.date,
          time: ev.start.time,
          endTime: ev.start.time && ev.end && ev.end.date === ev.start.date && ev.end.time > ev.start.time ? ev.end.time : null,
          categoryId: ev.category || null,
          notes: ev.notes.filter(Boolean).join('\n\n'),
          reminder: ev.reminder ?? null,
          dismissedAt: null,
        });
      }
      ev = null;
    } else if (ev && inAlarm) {
      if (name === 'TRIGGER') ev.reminder = minutesBefore(value);
    } else if (ev) {
      if (name === 'UID') ev.uid = value.trim();
      else if (name === 'SUMMARY') ev.title = unescape(value).trim();
      else if (name === 'DTSTART') ev.start = when(value, params);
      else if (name === 'DTEND') ev.end = when(value, params);
      else if (name === 'DESCRIPTION') ev.notes.unshift(unescape(value).trim());
      else if (name === 'LOCATION') ev.notes.push(unescape(value).trim());
      else if (name === 'CATEGORIES') ev.category = unescape(value).split(',').map((c) => cats.get(c.trim().toLowerCase())).find(Boolean);
    }
  }
  if (!plans.length) throw new Error('This calendar file has no events.');
  return plans;
}

async function readCalendarFile(file) {
  const plans = parseICS(await file.text());
  const known = new Set(data.schedule.map((p) => p.id));
  const updated = plans.filter((p) => known.has(p.id)).length;
  const first = plans.map((p) => p.date).sort()[0];
  const last = plans.map((p) => p.date).sort().pop();
  return { plans, added: plans.length - updated, updated, first, last };
}

async function importPlans(plans) {
  const existing = new Map(data.schedule.map((p) => [p.id, p]));
  await putItems('schedule', plans.map((p) => ({ ...(existing.get(p.id) || {}), ...p, dismissedAt: (existing.get(p.id) || {}).dismissedAt || null })));
}

export { parseICS, readCalendarFile, importPlans };
