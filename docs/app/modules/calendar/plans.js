/* Calendar plans: scheduled events, which can be in the future (Christina's records are what already happened).
 * Store 'schedule': { id, title, date ('YYYY-MM-DD'), time ('HH:MM'|null = all day), endTime ('HH:MM'|null),
 *                     categoryId, notes, reminder (minutes before the start, or null), dismissedAt, createdAt, updatedAt }
 * Dates and times are kept as local calendar values, so a plan stays on its day wherever the phone is.
 * Reminders are shown inside the app (Overview and on opening it): a web app on iPhone cannot schedule
 * notifications without a server. Plans dated in a past month are read-only. */
import { esc, uuid, ymd, parseYMD, F, monthKeyOf } from '../../core/util.js';
import { data } from '../../core/db.js';
import { categoryById, isPastMonth } from '../../core/queries.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { putItem, removeItem } from '../../core/repo.js';
import { icon } from '../../ui/icons.js';
import { navbar, chips, badge, toast, fail } from '../../ui/components.js';

const REMINDERS = [['', 'None'], ['0', 'At the start'], ['10', '10 minutes before'], ['60', '1 hour before'], ['1440', '1 day before']];
const ALL_DAY_HOUR = 9; // an all-day plan's reminder counts from 9:00
state.plf = null;

const planById = (id) => data.schedule.find((p) => p.id === id);
const plansOn = (day) => data.schedule.filter((p) => p.date === day).sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title));
const isPlanLocked = (p) => isPastMonth(monthKeyOf(parseYMD(p.date)));
const planHex = (p) => (p.categoryId ? categoryById(p.categoryId).color : '7A7A7A');

function planStart(p) {
  const d = parseYMD(p.date);
  if (p.time) {
    const [h, m] = p.time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else d.setHours(ALL_DAY_HOUR, 0, 0, 0);
  return d;
}
const timeLabel = (t) => {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return F.time.format(d);
};
const whenText = (p) => (p.time ? `${timeLabel(p.time)}${p.endTime ? ` – ${timeLabel(p.endTime)}` : ''}` : 'All day');

/** Plans whose reminder time has come and that have not started more than 12 hours ago, and were not dismissed. */
function dueReminders(now = new Date()) {
  return data.schedule.filter((p) => {
    if (p.reminder == null || p.dismissedAt) return false;
    const start = planStart(p);
    const at = new Date(start.getTime() - p.reminder * 60000);
    return now >= at && now.getTime() < start.getTime() + 12 * 3600000;
  });
}
/** Plans in the next `days` days, starting today. */
function upcomingPlans(days = 7) {
  const today = ymd(new Date());
  const end = ymd(new Date(Date.now() + days * 864e5));
  return data.schedule.filter((p) => p.date >= today && p.date < end).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
}

function planRow(p, withDate = false) {
  const hex = planHex(p);
  return `<button class="row" data-action="openPlan" data-id="${esc(p.id)}">
    <span class="cat-icon" style="background:transparent;box-shadow:inset 0 0 0 2px #${esc(hex)};color:#${esc(hex)}">${icon('clock')}</span>
    <span class="row-text"><span class="body">${esc(p.title)}</span><span class="caption">${withDate ? `${esc(F.weekdayDayMonth.format(parseYMD(p.date)))} · ` : ''}${esc(whenText(p))}${p.reminder != null ? ' · reminder' : ''}</span></span>
  </button>`;
}

function newPlanForm(p, day) {
  return {
    id: p ? p.id : null,
    title: p ? p.title : '',
    date: p ? p.date : day || ymd(new Date()),
    allDay: p ? !p.time : false,
    time: p ? p.time || '09:00' : '09:00',
    endTime: p ? p.endTime || '' : '',
    categoryId: p ? p.categoryId || null : null,
    categoryOptional: true,
    reminder: p && p.reminder != null ? String(p.reminder) : '',
    notes: p ? p.notes || '' : '',
  };
}

function viewPlanEdit() {
  const f = state.plf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  return `${navbar(f.id ? 'Plan' : 'New plan', '<button class="nav-btn strong" data-action="savePlan" data-valid="plan">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Title</span><input class="field" type="text" data-bind="plf.title" value="${esc(f.title)}" placeholder="e.g. Dentist" autocomplete="off"></div>
    <div class="section"><span class="label">Date</span><input class="field" type="date" data-bind="plf.date" value="${esc(f.date)}"></div>
    <div class="section">
      <div class="field row-field"><span>All day</span><label class="toggle"><input type="checkbox" data-bind="plf.allDay" data-rerender="1" ${f.allDay ? 'checked' : ''}><span></span></label></div>
      ${
        f.allDay
          ? ''
          : `<div class="row-field"><input class="field" type="time" data-bind="plf.time" value="${esc(f.time)}" aria-label="Starts"><span class="muted">to</span><input class="field" type="time" data-bind="plf.endTime" value="${esc(f.endTime)}" aria-label="Ends (optional)"></div>
             <span class="caption">The end time is optional.</span>`
      }
    </div>
    <div class="section"><span class="label">Category (optional — tap again to clear)</span>${chips('plf', f.categoryId)}</div>
    <div class="section"><span class="label">Reminder</span>
      <select class="field" data-bind="plf.reminder">${REMINDERS.map(([v, l]) => `<option value="${v}" ${f.reminder === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span class="caption">Reminders appear inside Christina, on Overview and when you open it.</span>
    </div>
    <div class="section"><span class="label">Notes (optional)</span><textarea class="field" data-bind="plf.notes">${esc(f.notes)}</textarea></div>
    ${f.id ? `<button class="btn-secondary danger" data-action="deletePlan" data-id="${esc(f.id)}">Delete</button>` : ''}
  </div>`;
}

function viewPlanLocked(p) {
  return `${navbar('', '<span class="caption" style="padding:0 8px">Archived</span>')}<div class="page">
    <div class="row-field" style="justify-content:flex-start;gap:8px">${p.categoryId ? badge(p.categoryId) : ''}<span class="caption">${esc(F.weekdayDayMonth.format(parseYMD(p.date)))} · ${esc(whenText(p))}</span></div>
    <h1>${esc(p.title)}</h1>
    ${p.notes ? `<div style="white-space:pre-wrap">${esc(p.notes)}</div>` : ''}
  </div>`;
}

function newPlan(day) {
  state.plf = newPlanForm(null, day);
  push({ name: 'planEdit' });
}

register({
  screens: {
    planEdit: () => viewPlanEdit(),
    planLocked: (v) => (planById(v.id) ? viewPlanLocked(planById(v.id)) : `${navbar('')}<div class="page"></div>`),
  },
  validators: {
    plan() {
      const f = state.plf;
      return !!f && f.title.trim() !== '' && !!f.date && (f.allDay || !!f.time) && (f.allDay || !f.endTime || f.endTime > f.time);
    },
  },
  actions: {
    newPlan: (el) => newPlan(el.dataset.day || ''),
    openPlan(el) {
      const p = planById(el.dataset.id);
      if (!p) return;
      if (isPlanLocked(p)) return push({ name: 'planLocked', id: p.id });
      state.plf = newPlanForm(p);
      push({ name: 'planEdit' });
    },
    async savePlan() {
      const f = state.plf;
      if (!f || !registry.validators.plan()) return;
      const existing = f.id ? planById(f.id) : null;
      const reminder = f.reminder === '' ? null : Number(f.reminder);
      const plan = {
        ...(existing || { id: uuid() }),
        title: f.title.trim(),
        date: f.date,
        time: f.allDay ? null : f.time,
        endTime: f.allDay ? null : f.endTime || null,
        categoryId: f.categoryId || null,
        reminder,
        notes: f.notes.trim() || null,
      };
      // A changed time or reminder asks again.
      if (existing && (existing.date !== plan.date || existing.time !== plan.time || existing.reminder !== plan.reminder)) plan.dismissedAt = null;
      try {
        await putItem('schedule', plan);
      } catch (error) {
        return fail(error, 'save this plan');
      }
      state.plf = null;
      toast(existing ? 'Saved' : `Planned for ${F.weekdayDayMonth.format(parseYMD(plan.date))}`);
      back();
    },
    async deletePlan(el) {
      if (!confirm('Delete this plan?')) return;
      try {
        await removeItem('schedule', el.dataset.id);
      } catch (error) {
        return fail(error, 'delete this plan');
      }
      state.plf = null;
      back();
    },
    async dismissReminder(el) {
      const p = planById(el.dataset.id);
      if (!p) return;
      try {
        await putItem('schedule', { ...p, dismissedAt: new Date().toISOString() });
      } catch (error) {
        return fail(error, 'dismiss this reminder');
      }
      render();
    },
  },
});

export { plansOn, planRow, planHex, dueReminders, upcomingPlans, whenText, newPlan, planById };
