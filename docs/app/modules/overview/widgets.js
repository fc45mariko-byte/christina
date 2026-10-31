/* Overview widgets. Each widget shows real data from one module and offers a way into it.
 * A widget is { label, sizes: ['s'|'m'|'l', …], defaultSize, render(size) → html }.
 * 's' takes half the width in two columns; 'm' and 'l' take the full width ('l' shows more).
 * A widget returns '' when it has nothing to show and nothing to offer (e.g. no reminders due). */
import { esc, ymd, monthTitle, monthName, monthStart, addMonths, currentMonth, F, addDays, uuid } from '../../core/util.js';
import { data } from '../../core/db.js';
import { lookFor, recordsBetween, newestFirst, monthImageKey, recordTitle } from '../../core/queries.js';
import { register, registry } from '../../core/registry.js';
import { prefs } from '../../core/prefs.js';
import { render } from '../../core/render.js';
import { icon } from '../../ui/icons.js';
import { paletteDots, recordRow, fail } from '../../ui/components.js';
import { taskRow, openTasks } from '../tasks/index.js';
import { habitRow, activeHabits, isDone } from '../habits/index.js';
import { projectCard, progress } from '../projects/index.js';
import { planRow, upcomingPlans, plansOn, dueReminders, whenText } from '../calendar/plans.js';
import { weekStartOf } from '../calendar/grid.js';
import { BODB, isBodyOracleRecord } from '../body-oracle/store.js';

const head = (title, link = '', action = '') =>
  `<div class="w-head"><span class="w-title">${esc(title)}</span>${link ? `<button class="w-link" ${action}>${esc(link)}</button>` : ''}</div>`;
const go = (id) => `data-action="goModule" data-id="${id}"`;
const LIMIT = { s: 2, m: 4, l: 10 };

// ------------------------------------------------------------ This month (Christina's Overview)

function month(size) {
  const key = currentMonth();
  const look = lookFor(key);
  const events = recordsBetween(monthStart(key), monthStart(addMonths(key, 1))).sort(newestFirst);
  const shown = size === 'l' ? events : events.slice(0, 5);
  return `<h1>${esc(monthTitle(key))}</h1>
    ${look.title ? `<div class="body muted">${esc(look.title)}</div>` : ''}
    ${paletteDots(look.palette)}
    ${look.images.length ? `<div class="strip">${look.images.map((n) => `<div class="sq"><img data-file="${esc(monthImageKey(key, n))}" alt=""></div>`).join('')}</div>` : ''}
    ${
      events.length
        ? `<div class="list">${shown.map((e) => recordRow(e, false, look.palette)).join('')}</div>${shown.length < events.length ? `<button class="w-link" style="align-self:flex-start" ${go('map')}>${events.length - shown.length} more this month</button>` : ''}`
        : `<div class="blank">${esc(monthName(key))} is blank. Tap + to add something.</div>`
    }`;
}

// ------------------------------------------------------------ Date and time, Today

const LONG_DATE = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const clock = () => `<span class="w-big" data-clock>${esc(F.time.format(new Date()))}</span><span class="caption">${esc(LONG_DATE.format(new Date()))}</span>`;

function today(size) {
  const day = ymd(new Date());
  const plans = plansOn(day);
  const tasks = openTasks().filter((t) => t.due && t.due <= day);
  if (size === 's') {
    return `${head('Today')}${clock()}<span class="caption">${plans.length} planned · ${tasks.length} to do</span>`;
  }
  const n = LIMIT[size];
  return `${head('Today', 'Calendar', go('map'))}${clock()}
    ${plans.length ? `<div class="list">${plans.slice(0, n).map((p) => planRow(p)).join('')}</div>` : ''}
    ${tasks.length ? `<div class="list">${tasks.slice(0, n).map(taskRow).join('')}</div>` : ''}
    ${!plans.length && !tasks.length ? '<span class="muted">Nothing planned or due today.</span>' : ''}`;
}

// ------------------------------------------------------------ Reminders, Upcoming

function reminders() {
  if (prefs.showReminders === false) return '';
  const due = dueReminders();
  if (!due.length) return '';
  return `${head('Reminders')}<div class="list">${due
    .map((p) => `<div class="row-field">${planRow(p, true)}<button class="nav-btn" data-action="dismissReminder" data-id="${esc(p.id)}">Dismiss</button></div>`)
    .join('')}</div>`;
}

function upcoming(size) {
  const list = upcomingPlans(size === 'l' ? 14 : 7);
  if (size === 's') return `${head('Next 7 days')}<span class="w-big">${list.length}</span><span class="caption">${list[0] ? `Next: ${esc(list[0].title)}, ${esc(F.weekdayDayMonth.format(new Date(list[0].date + 'T12:00')))}` : 'Nothing planned'}</span>`;
  return `${head(size === 'l' ? 'Next 14 days' : 'Next 7 days', 'Calendar', go('map'))}
    ${list.length ? `<div class="list">${list.slice(0, LIMIT[size]).map((p) => planRow(p, true)).join('')}</div>` : `<span class="muted">Nothing planned.</span> <button class="w-link" data-action="newPlan">Plan something</button>`}`;
}

// ------------------------------------------------------------ Tasks, Habits, Projects

function tasks(size) {
  const list = openTasks();
  const overdue = list.filter((t) => t.due && t.due < ymd(new Date())).length;
  if (size === 's') return `${head('Tasks', 'Open', go('tasks'))}<span class="w-big">${list.length}</span><span class="caption">to do${overdue ? ` · ${overdue} overdue` : ''}</span>`;
  return `${head('Tasks', 'All tasks', go('tasks'))}
    ${list.length ? `<div class="list">${list.slice(0, LIMIT[size]).map(taskRow).join('')}</div>` : '<span class="muted">Nothing to do.</span>'}
    <button class="w-link" style="align-self:flex-start" data-action="newTask">${icon('plus')} Add a task</button>`;
}

function habits(size) {
  const list = activeHabits();
  const day = ymd(new Date());
  const done = list.filter((h) => isDone(h.id, day)).length;
  if (!list.length) return `${head('Habits')}<span class="muted">No habits yet.</span><button class="w-link" style="align-self:flex-start" data-action="newHabit">${icon('plus')} Add a habit</button>`;
  if (size === 's') return `${head('Habits', 'Open', go('habits'))}<span class="w-big">${done}/${list.length}</span><span class="caption">done today</span>`;
  return `${head(`Habits · ${done} of ${list.length} today`, 'All', go('habits'))}<div class="list">${list.slice(0, LIMIT[size]).map(habitRow).join('')}</div>`;
}

function projects(size) {
  const list = data.projects.filter((p) => (p.status || 'active') === 'active');
  if (!list.length) return `${head('Projects')}<span class="muted">No active projects.</span><button class="w-link" style="align-self:flex-start" data-action="newProject">${icon('plus')} Start a project</button>`;
  if (size === 's') {
    const avg = list.reduce((n, p) => n + progress(p).ratio, 0) / list.length;
    return `${head('Projects', 'Open', go('projects'))}<span class="w-big">${list.length}</span><span class="caption">active · ${Math.round(avg * 100)}% on average</span>`;
  }
  return `${head('Projects', 'All', go('projects'))}${list.slice(0, LIMIT[size]).map(projectCard).join('')}`;
}

// ------------------------------------------------------------ Journal, Body Oracle

function journal(size) {
  const list = data.records.filter((r) => r.kind === 'journal' && !r.archived).sort(newestFirst);
  const last = list[0];
  if (size === 's') return `${head('Journal', 'Write', 'data-action="newJournal"')}<span class="w-big">${list.length}</span><span class="caption">${last ? `Last: ${esc(F.dayMonth.format(new Date(last.occurredAt)))}` : 'entries'}</span>`;
  return `${head('Journal', 'All', go('journal'))}
    ${last ? `<div class="list">${list.slice(0, size === 'l' ? 5 : 2).map((r) => recordRow(r)).join('')}</div>` : '<span class="muted">Nothing written yet.</span>'}
    <button class="w-link" style="align-self:flex-start" data-action="newJournal">${icon('plus')} Write</button>`;
}

/** "How are you?": Body Oracle's states. Tapping logs it for today (tap again to take it back). */
const todayStateEntry = (stateId) => {
  const day = ymd(new Date());
  return data.records.find((r) => r.kind === 'state' && ymd(new Date(r.occurredAt)) === day && !r.text && ((r.payload && r.payload.stateIds) || []).length === 1 && r.payload.stateIds[0] === stateId);
};
function bodyOracle(size) {
  const states = [...data.states].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
  const recent = data.records.filter((r) => isBodyOracleRecord(r) && r.kind !== 'state' && !r.archived).sort(newestFirst);
  const chips = states.length
    ? `<div class="chip-row">${states.map((s) => {
        const on = !!todayStateEntry(s.id);
        return `<button class="pill ${on ? 'on' : ''}" data-action="logStateToday" data-id="${esc(s.id)}" aria-pressed="${on}"><span class="dot" style="background:${esc(s.color)};width:8px;height:8px"></span>${esc(s.name)}</button>`;
      }).join('')}</div>`
    : '';
  if (!states.length && !recent.length) return `${head('Body Oracle', 'Open', go('bo'))}<span class="muted">Record how you feel, what your body notices, and what you do for yourself.</span>`;
  return `${head('How are you?', 'Body Oracle', go('bo'))}${chips}
    ${size !== 's' && recent.length ? `<div class="list">${recent.slice(0, size === 'l' ? 5 : 2).map((r) => recordRow(r)).join('')}</div>` : ''}`;
}

// ------------------------------------------------------------ This week (personal statistics)

function week() {
  const start = weekStartOf(new Date());
  const prev = addDays(start, -7);
  const end = addDays(start, 7);
  const inRange = (iso, a, b) => { const t = new Date(iso).getTime(); return t >= a.getTime() && t < b.getTime(); };
  const dayIn = (day, a, b) => day >= ymd(a) && day < ymd(b);
  const count = (a, b) => ({
    recorded: data.records.filter((r) => !r.archived && r.kind !== 'journal' && inRange(r.occurredAt, a, b)).length,
    journal: data.records.filter((r) => r.kind === 'journal' && inRange(r.occurredAt, a, b)).length,
    tasks: data.tasks.filter((t) => t.done && t.completedAt && inRange(t.completedAt, a, b)).length,
    habits: data.habitLogs.filter((l) => dayIn(l.date, a, b)).length,
  });
  const now = count(start, end);
  const before = count(prev, start);
  const cell = (label, k) => {
    const d = now[k] - before[k];
    return `<div class="stat"><span class="caption">${label}</span><b>${now[k]}</b><span class="caption">${d === 0 ? 'same as last week' : `${d > 0 ? '+' : '−'}${Math.abs(d)} vs last week`}</span></div>`;
  };
  return `${head('This week', 'Insights', go('insights'))}<div class="stats" style="grid-template-columns:repeat(2,1fr)">${cell('Recorded', 'recorded')}${cell('Journal entries', 'journal')}${cell('Tasks done', 'tasks')}${cell('Habit check-ins', 'habits')}</div>`;
}

register({
  widgets: {
    reminders: { label: 'Reminders', sizes: ['m'], defaultSize: 'm', render: reminders, hint: 'Shows only when a reminder is due' },
    clock: { label: 'Date and time', sizes: ['s'], defaultSize: 's', render: () => `${head('Now')}${clock()}` },
    today: { label: 'Today', sizes: ['s', 'm', 'l'], defaultSize: 'm', render: today },
    month: { label: 'This month', sizes: ['m', 'l'], defaultSize: 'l', render: month, bare: true },
    upcoming: { label: 'Upcoming plans', sizes: ['s', 'm', 'l'], defaultSize: 'm', render: upcoming },
    tasks: { label: 'Tasks', sizes: ['s', 'm', 'l'], defaultSize: 'm', render: tasks },
    habits: { label: 'Habits', sizes: ['s', 'm', 'l'], defaultSize: 's', render: habits },
    projects: { label: 'Projects', sizes: ['s', 'm', 'l'], defaultSize: 'm', render: projects },
    journal: { label: 'Journal', sizes: ['s', 'm', 'l'], defaultSize: 's', render: journal },
    bodyOracle: { label: 'Body Oracle', sizes: ['s', 'm', 'l'], defaultSize: 'm', render: bodyOracle },
    week: { label: 'This week', sizes: ['m'], defaultSize: 'm', render: week },
  },
  actions: {
    async logStateToday(el) {
      const id = el.dataset.id;
      const existing = todayStateEntry(id);
      try {
        if (existing) await BODB.del(existing.id);
        else {
          const now = Date.now();
          await BODB.put({ id: uuid(), type: 'entry', kind: 'state', text: '', date: now, stateIds: [id], photoIds: [], categoryIds: [], threadIds: [], color: null, colorId: null, tags: '', location: '', ritualId: null, intentionId: null, createdAt: now, updatedAt: now });
        }
      } catch (error) {
        return fail(error, 'save this');
      }
      render();
    },
  },
});

export { clock };
