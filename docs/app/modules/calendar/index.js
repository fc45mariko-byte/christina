/* Calendar: Day, Week and Month views. Month and Week keep Christina's grid (thread bars, record dots) and add
 * plans (rings) and open tasks due (small squares). The Day view lists the day's plans, tasks due and records. */
import { esc, ymd, parseYMD, addDays, monthKeyOf, monthStart, addMonths, monthTitle, rangeText, F } from '../../core/util.js';
import { prefs, Settings } from '../../core/prefs.js';
import { data } from '../../core/db.js';
import { isPastMonth, recordMonth, newestFirst } from '../../core/queries.js';
import { state, push } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { navbar, recordRow } from '../../ui/components.js';
import { monthWeeks, weekStartOf, monthField } from './grid.js';
import { plansOn, planRow } from './plans.js';
import { taskRow, tasksDueOn } from '../tasks/index.js';

state.dayAnchor = ymd(new Date());
/** 'day' | 'week' | 'month'. Kept in step with the older "Week view" setting. */
const calendarView = () => prefs.calendarView || (prefs.weekView ? 'week' : 'month');
function setCalendarView(v) {
  prefs.calendarView = v;
  Settings.write('calendarView', v);
  if (v !== 'day') {
    prefs.weekView = v === 'week';
    Settings.write('weekView', prefs.weekView);
  }
}

/** Everything on one day. Used by the Day view and by tapping a day number on the grid. */
function dayBody(day) {
  const plans = plansOn(day);
  const tasks = tasksDueOn(day);
  const records = data.records.filter((r) => !r.archived && ymd(new Date(r.occurredAt)) === day).sort(newestFirst);
  const locked = isPastMonth(monthKeyOf(parseYMD(day)));
  return `
    <div class="section"><div class="page-head"><span class="label">Plans</span>${locked ? '' : `<button class="nav-btn" data-action="newPlan" data-day="${day}">${icon('plus')}Plan</button>`}</div>
      ${plans.length ? `<div class="list">${plans.map((p) => planRow(p)).join('')}</div>` : '<span class="muted">Nothing planned.</span>'}</div>
    <div class="section"><div class="page-head"><span class="label">Tasks due</span>${locked ? '' : `<button class="nav-btn" data-action="newTask" data-due="${day}">${icon('plus')}Task</button>`}</div>
      ${tasks.length ? `<div class="list">${tasks.map(taskRow).join('')}</div>` : '<span class="muted">No tasks due.</span>'}</div>
    <div class="section"><span class="label">Recorded</span>
      ${records.length ? `<div class="list">${records.map((r) => recordRow(r, isPastMonth(recordMonth(r)))).join('')}</div>` : '<span class="muted">Nothing recorded.</span>'}</div>`;
}

function switcher() {
  const v = calendarView();
  return `<div class="segmented">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-action="calendarView" data-view="${k}">${l}</button>`).join('')}</div>`;
}

function viewMap() {
  const view = calendarView();
  if (view === 'day') {
    const d = parseYMD(state.dayAnchor);
    return `<div class="page">${switcher()}
      <div class="month-head">
        <button class="arrow" data-action="mapStep" data-dir="-1" aria-label="Previous day">${icon('left')}</button>
        <h1>${esc(F.weekdayDayMonth.format(d))}</h1>
        <button class="arrow" data-action="mapStep" data-dir="1" aria-label="Next day">${icon('right')}</button>
      </div>
      ${state.dayAnchor !== ymd(new Date()) ? `<button class="nav-btn" style="align-self:center" data-action="calendarToday">Today</button>` : ''}
      ${dayBody(state.dayAnchor)}
    </div>`;
  }
  let start, end, weeks, lookKey, title;
  if (view === 'week') {
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
  return `<div class="page">${switcher()}
    <div class="month-head">
      <button class="arrow" data-action="mapStep" data-dir="-1" aria-label="Previous ${view}">${icon('left')}</button>
      <h1>${esc(title)}</h1>
      <button class="arrow" data-action="mapStep" data-dir="1" aria-label="Next ${view}">${icon('right')}</button>
    </div>
    ${monthField(lookKey, start, end, weeks, false)}
    <span class="caption">Dots: recorded · rings: planned · squares: tasks due. Tap a day to see it.</span>
  </div>`;
}

register({
  nav: { id: 'map', label: 'Calendar', icon: 'calendar', order: 2 },
  tabs: { map: viewMap },
  screens: {
    calDay: (v) => `${navbar(F.weekdayDayMonth.format(parseYMD(v.day)))}<div class="page">${dayBody(v.day)}</div>`,
  },
  actions: {
    mapStep(el) {
      const dir = Number(el.dataset.dir);
      const view = calendarView();
      if (view === 'day') state.dayAnchor = ymd(addDays(parseYMD(state.dayAnchor), dir));
      else if (view === 'week') state.weekAnchor = ymd(addDays(parseYMD(state.weekAnchor), 7 * dir));
      else state.mapMonth = addMonths(state.mapMonth, dir);
      render();
    },
    calendarView(el) {
      setCalendarView(el.dataset.view);
      render();
    },
    calendarToday() {
      state.dayAnchor = ymd(new Date());
      render();
    },
    openDay: (el) => push({ name: 'calDay', day: el.dataset.day }),
  },
});

export { calendarView, setCalendarView, dayBody };
