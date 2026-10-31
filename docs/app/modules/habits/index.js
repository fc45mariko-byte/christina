/* Habits: routines with a daily or weekly rhythm, check-ins, history and streaks.
 * Stores:
 *   habits     { id, name, frequency ('daily'|'weekly'), target (check-ins per week, weekly habits),
 *                categoryId, color, archived, order, createdAt, updatedAt }
 *   habitLogs  { id: '<habitId>:<YYYY-MM-DD>', habitId, date, createdAt, updatedAt } — one row per check-in day,
 *              so history is never overwritten.
 * Streaks: a daily habit counts consecutive days with a check-in (today may still be open); a weekly habit counts
 * consecutive weeks that reached the target (this week may still be open).
 * Check-ins can be changed for any day of the current month; earlier months are read-only. */
import { esc, uuid, ymd, parseYMD, addDays, monthKeyOf, F, currentMonth } from '../../core/util.js';
import { data } from '../../core/db.js';
import { categoryById } from '../../core/queries.js';
import { THREAD_COLORS } from '../../core/catalog.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { putItem, removeItems } from '../../core/repo.js';
import { DB } from '../../core/db.js';
import { icon } from '../../ui/icons.js';
import { navbar, chips, swatches, toast, fail } from '../../ui/components.js';
import { weekStartOf } from '../calendar/grid.js';

state.hf = null;

const activeHabits = () => data.habits.filter((h) => !h.archived).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
const habitById = (id) => data.habits.find((h) => h.id === id);
const logId = (habitId, day) => `${habitId}:${day}`;
const isDone = (habitId, day) => data.habitLogs.some((l) => l.id === logId(habitId, day));
const daysOf = (h) => new Set(data.habitLogs.filter((l) => l.habitId === h.id).map((l) => l.date));
const canChange = (day) => monthKeyOf(parseYMD(day)) === currentMonth() && day <= ymd(new Date());
const habitHex = (h) => h.color || (h.categoryId ? categoryById(h.categoryId).color : '7A7A7A');

function weekCount(days, weekStart) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (days.has(ymd(addDays(weekStart, i)))) n++;
  return n;
}

/** { current, longest, rate30 } — rate30: share of the last 30 days (daily) or last 4 weeks (weekly) on target. */
function habitStats(h) {
  const days = daysOf(h);
  const today = new Date();
  if (h.frequency === 'weekly') {
    const target = Math.max(1, h.target || 1);
    const thisWeek = weekStartOf(today);
    let current = 0;
    let w = weekCount(days, thisWeek) >= target ? thisWeek : addDays(thisWeek, -7);
    while (weekCount(days, w) >= target) {
      current++;
      w = addDays(w, -7);
    }
    let longest = 0;
    let run = 0;
    const first = [...days].sort()[0];
    if (first) {
      for (let x = weekStartOf(parseYMD(first)); x <= thisWeek; x = addDays(x, 7)) {
        run = weekCount(days, x) >= target ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
    }
    let met = 0;
    for (let i = 1; i <= 4; i++) if (weekCount(days, addDays(thisWeek, -7 * i)) >= target) met++;
    return { current, longest, rate: met / 4, unit: 'week' };
  }
  let current = 0;
  let d = days.has(ymd(today)) ? today : addDays(today, -1);
  while (days.has(ymd(d))) {
    current++;
    d = addDays(d, -1);
  }
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const day of [...days].sort()) {
    run = prev && ymd(addDays(parseYMD(prev), 1)) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  let hit = 0;
  for (let i = 0; i < 30; i++) if (days.has(ymd(addDays(today, -i)))) hit++;
  return { current, longest, rate: hit / 30, unit: 'day' };
}
const streakText = (s) => (s.current ? `${s.current}-${s.unit} streak` : 'No streak yet');

/** Habit line with today's check: used by Habits and the Overview widget. */
function habitRow(h) {
  const today = ymd(new Date());
  const done = isDone(h.id, today);
  const s = habitStats(h);
  const hex = habitHex(h);
  const week = h.frequency === 'weekly' ? ` · ${weekCount(daysOf(h), weekStartOf(new Date()))} of ${h.target || 1} this week` : '';
  return `<div class="row">
    <button class="check ${done ? 'on' : ''}" style="${done ? `background:#${esc(hex)}` : `box-shadow:inset 0 0 0 2px #${esc(hex)}`}" data-action="toggleHabit" data-id="${esc(h.id)}" data-day="${today}" aria-label="${done ? 'Undo today' : 'Done today'}" aria-pressed="${done}">${icon('check')}</button>
    <button class="row-text" data-action="openHabit" data-id="${esc(h.id)}" style="text-align:left">
      <span class="body">${esc(h.name)}</span><span class="caption">${esc(streakText(s))}${esc(week)}</span>
    </button>
  </div>`;
}

function viewHabits() {
  const list = activeHabits();
  const archived = data.habits.filter((h) => h.archived);
  return `<div class="page tight">
    <div class="page-head"><h1>Habits</h1><button class="nav-btn strong" data-action="newHabit">${icon('plus')}New</button></div>
    <span class="caption">${esc(F.weekdayDayMonth.format(new Date()))}</span>
    ${list.length ? `<div class="list">${list.map(habitRow).join('')}</div>` : '<div class="blank">No habits yet. Tap New to add one that fits your own routine.</div>'}
    ${archived.length ? `<span class="label" style="margin-top:16px">Archived</span><div class="list">${archived.map((h) => `<button class="row" data-action="openHabit" data-id="${esc(h.id)}"><span class="row-text"><span class="body muted">${esc(h.name)}</span></span>${icon('right', 'chev')}</button>`).join('')}</div>` : ''}
  </div>`;
}

/** Last 16 weeks as a grid (columns = weeks, rows = weekdays). Days of the current month can be tapped. */
function historyGrid(h) {
  const days = daysOf(h);
  const end = weekStartOf(new Date());
  const hex = habitHex(h);
  const today = ymd(new Date());
  let cols = '';
  for (let w = 15; w >= 0; w--) {
    const start = addDays(end, -7 * w);
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const day = ymd(addDays(start, i));
      const on = days.has(day);
      const future = day > today;
      const label = `${F.weekdayDayMonth.format(parseYMD(day))}${on ? ', done' : ''}`;
      const style = `background:${on ? `#${hex}` : 'var(--hair)'};${future ? 'opacity:.35' : ''}`;
      cells += canChange(day)
        ? `<button class="hcell" style="${style}" data-action="toggleHabit" data-id="${esc(h.id)}" data-day="${day}" aria-label="${esc(label)}" aria-pressed="${on}"></button>`
        : `<span class="hcell" style="${style}" title="${esc(label)}"></span>`;
    }
    cols += `<div class="hcol">${cells}</div>`;
  }
  return `<div class="hgrid" role="group" aria-label="Last 16 weeks">${cols}</div>`;
}

function viewHabit(id) {
  const h = habitById(id);
  if (!h) return `${navbar('')}<div class="page"><div class="blank">This habit no longer exists.</div></div>`;
  const s = habitStats(h);
  const total = daysOf(h).size;
  return `${navbar('', `<button class="nav-btn" data-action="editHabit" data-id="${esc(h.id)}">Edit</button>`)}
  <div class="page">
    <div class="row-field" style="justify-content:flex-start;gap:8px"><span class="dot" style="background:#${esc(habitHex(h))};width:14px;height:14px"></span><span class="label">${h.frequency === 'weekly' ? `${h.target || 1} × a week` : 'Every day'}${h.archived ? ' · Archived' : ''}</span></div>
    <h1>${esc(h.name)}</h1>
    <div class="stats">
      <div class="stat"><span class="caption">Current streak</span><b>${s.current}</b><span class="caption">${s.unit === 'week' ? 'weeks' : 'days'}</span></div>
      <div class="stat"><span class="caption">Longest</span><b>${s.longest}</b><span class="caption">${s.unit === 'week' ? 'weeks' : 'days'}</span></div>
      <div class="stat"><span class="caption">${s.unit === 'week' ? 'Last 4 weeks' : 'Last 30 days'}</span><b>${Math.round(s.rate * 100)}%</b><span class="caption">${total} check-ins in all</span></div>
    </div>
    <div class="section"><span class="label">Last 16 weeks</span>${historyGrid(h)}<span class="caption">Tap a day this month to change it. Earlier months are kept as they were.</span></div>
    <div class="section" style="margin-top:8px">
      <button class="btn-secondary" data-action="archiveHabit" data-id="${esc(h.id)}">${h.archived ? 'Unarchive' : 'Archive'}</button>
      <button class="btn-secondary danger" data-action="deleteHabit" data-id="${esc(h.id)}">Delete</button>
    </div>
  </div>`;
}

function newHabitForm(h) {
  return {
    id: h ? h.id : null,
    name: h ? h.name : '',
    frequency: h ? h.frequency : 'daily',
    target: h ? h.target || 1 : 3,
    categoryId: h ? h.categoryId || null : null,
    categoryOptional: true,
    color: h ? h.color || THREAD_COLORS[4] : THREAD_COLORS[4],
  };
}

function viewHabitEdit() {
  const f = state.hf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  const colors = THREAD_COLORS.includes(f.color) ? THREAD_COLORS : [...THREAD_COLORS, f.color];
  return `${navbar(f.id ? 'Edit habit' : 'New habit', '<button class="nav-btn strong" data-action="saveHabit" data-valid="habit">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Name</span><input class="field" type="text" data-bind="hf.name" value="${esc(f.name)}" placeholder="e.g. Walk, Spanish, Stretch" autocomplete="off"></div>
    <div class="section"><span class="label">How often</span>
      <div class="segmented"><button class="${f.frequency === 'daily' ? 'on' : ''}" data-action="habitFrequency" data-f="daily">Every day</button><button class="${f.frequency === 'weekly' ? 'on' : ''}" data-action="habitFrequency" data-f="weekly">Times a week</button></div>
      ${
        f.frequency === 'weekly'
          ? `<div class="field row-field"><span>Times a week</span><span style="display:flex;align-items:center;gap:12px"><button class="arrow" data-action="habitTarget" data-d="-1" aria-label="Fewer">−</button><b style="min-width:1.5em;text-align:center">${f.target}</b><button class="arrow" data-action="habitTarget" data-d="1" aria-label="More">+</button></span></div>`
          : ''
      }
    </div>
    <div class="section"><span class="label">Colour</span>${swatches('hf', f.color, colors)}</div>
    <div class="section"><span class="label">Category (optional — tap again to clear)</span>${chips('hf', f.categoryId)}</div>
  </div>`;
}

async function toggleHabit(id, day) {
  const h = habitById(id);
  if (!h || !canChange(day)) return;
  const lid = logId(id, day);
  try {
    if (isDone(id, day)) await removeItems('habitLogs', [lid]);
    else await putItem('habitLogs', { id: lid, habitId: id, date: day });
  } catch (error) {
    return fail(error, 'save this check-in');
  }
  render();
}

register({
  nav: { id: 'habits', label: 'Habits', icon: 'repeat', order: 2.7 },
  tabs: { habits: viewHabits },
  screens: { habit: (v) => viewHabit(v.id), habitEdit: () => viewHabitEdit() },
  validators: { habit: () => !!state.hf && state.hf.name.trim() !== '' },
  actions: {
    newHabit() {
      state.hf = newHabitForm(null);
      push({ name: 'habitEdit' });
    },
    openHabit: (el) => push({ name: 'habit', id: el.dataset.id }),
    editHabit(el) {
      state.hf = newHabitForm(habitById(el.dataset.id));
      push({ name: 'habitEdit' });
    },
    habitFrequency(el) {
      state.hf.frequency = el.dataset.f;
      render();
    },
    habitTarget(el) {
      state.hf.target = Math.min(7, Math.max(1, state.hf.target + Number(el.dataset.d)));
      render();
    },
    async saveHabit() {
      const f = state.hf;
      if (!f || !registry.validators.habit()) return;
      const existing = f.id ? habitById(f.id) : null;
      const habit = {
        ...(existing || { id: uuid(), archived: false, order: data.habits.length }),
        name: f.name.trim(),
        frequency: f.frequency,
        target: f.frequency === 'weekly' ? f.target : 1,
        categoryId: f.categoryId || null,
        color: f.color,
      };
      try {
        await putItem('habits', habit);
      } catch (error) {
        return fail(error, 'save this habit');
      }
      state.hf = null;
      toast(existing ? 'Saved' : 'Habit added');
      back();
    },
    toggleHabit: (el) => toggleHabit(el.dataset.id, el.dataset.day),
    async archiveHabit(el) {
      const h = habitById(el.dataset.id);
      if (!h) return;
      try {
        await putItem('habits', { ...h, archived: !h.archived });
      } catch (error) {
        return fail(error, 'update this habit');
      }
      render();
    },
    async deleteHabit(el) {
      const id = el.dataset.id;
      if (!confirm('Delete this habit and its whole history?')) return;
      const logs = data.habitLogs.filter((l) => l.habitId === id).map((l) => l.id);
      try {
        await DB.write(['habits', 'habitLogs'], (tx) => {
          tx.objectStore('habits').delete(id);
          logs.forEach((l) => tx.objectStore('habitLogs').delete(l));
        });
      } catch (error) {
        return fail(error, 'delete this habit');
      }
      data.habits = data.habits.filter((h) => h.id !== id);
      data.habitLogs = data.habitLogs.filter((l) => l.habitId !== id);
      back();
    },
  },
});

export { habitRow, activeHabits, habitStats, isDone, daysOf, habitHex };
