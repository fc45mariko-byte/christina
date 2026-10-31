/* Tasks: things to do, with an optional due date, priority, category and project.
 * Store 'tasks': { id, title, notes, due ('YYYY-MM-DD'|null), priority ('high'|'normal'|'low'),
 *                  categoryId, projectId, done, completedAt, createdAt, updatedAt }
 * Tasks due on a day show in the Calendar's day view and as a small square on the month grid.
 * A task completed in a past month is read-only, like every other record from a past month. */
import { esc, uuid, ymd, parseYMD, addDays, F, monthKeyOf } from '../../core/util.js';
import { data } from '../../core/db.js';
import { categoryById, isPastMonth } from '../../core/queries.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { putItem, removeItem } from '../../core/repo.js';
import { icon } from '../../ui/icons.js';
import { navbar, chips, badge, toast, fail } from '../../ui/components.js';
import { openModule } from '../../shell/nav.js';

const PRIORITY = { high: 'High', normal: 'Normal', low: 'Low' };
const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };
state.taskView = 'open';
state.tkf = null;

const taskById = (id) => data.tasks.find((t) => t.id === id);
const isTaskLocked = (t) => t.done && t.completedAt && isPastMonth(monthKeyOf(new Date(t.completedAt)));
const byDue = (a, b) =>
  (a.due || '9999').localeCompare(b.due || '9999') || PRIORITY_ORDER[a.priority || 'normal'] - PRIORITY_ORDER[b.priority || 'normal'] || a.createdAt.localeCompare(b.createdAt);
const openTasks = () => data.tasks.filter((t) => !t.done).sort(byDue);
const tasksDueOn = (day) => data.tasks.filter((t) => t.due === day);

function dueText(t) {
  if (!t.due) return '';
  const today = ymd(new Date());
  if (t.due === today) return 'Today';
  if (t.due === ymd(addDays(new Date(), 1))) return 'Tomorrow';
  if (t.due === ymd(addDays(new Date(), -1))) return 'Yesterday';
  return F.weekdayDayMonth.format(parseYMD(t.due));
}

/** One task line: a round check, the title, and its due date / project. Used by Tasks, Calendar, Projects, Overview. */
function taskRow(t) {
  const project = t.projectId ? data.projects.find((p) => p.id === t.projectId) : null;
  const overdue = !t.done && t.due && t.due < ymd(new Date());
  const meta = [dueText(t), project ? project.title : '', t.priority === 'high' ? 'High priority' : ''].filter(Boolean).join(' · ');
  const locked = isTaskLocked(t);
  return `<div class="row">
    <button class="check ${t.done ? 'on' : ''}" data-action="toggleTask" data-id="${esc(t.id)}" aria-label="${t.done ? 'Mark as not done' : 'Mark as done'}" aria-pressed="${!!t.done}" ${locked ? 'disabled' : ''}>${icon('check')}</button>
    <button class="row-text" data-action="openTask" data-id="${esc(t.id)}" style="text-align:left">
      <span class="body ${t.done ? 'done-text' : ''}">${esc(t.title)}</span>
      ${meta ? `<span class="caption ${overdue ? 'danger' : ''}">${esc(meta)}</span>` : ''}
    </button>
    ${t.categoryId ? `<span class="dot" style="background:#${esc(categoryById(t.categoryId).color)}"></span>` : ''}
  </div>`;
}

function section(title, list) {
  return list.length ? `<span class="label" style="margin-top:12px">${esc(title)}</span><div class="list">${list.map(taskRow).join('')}</div>` : '';
}

function viewTasks() {
  const today = ymd(new Date());
  const open = openTasks();
  const done = data.tasks.filter((t) => t.done).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  let body;
  if (state.taskView === 'done') {
    body = done.length ? `<div class="list">${done.slice(0, 100).map(taskRow).join('')}</div>` : '<div class="blank">Nothing marked done yet.</div>';
  } else if (!open.length) {
    body = `<div class="blank">${data.tasks.length ? 'Nothing left to do.' : 'No tasks yet. Tap New to add one.'}</div>`;
  } else {
    body =
      section('Overdue', open.filter((t) => t.due && t.due < today)) +
      section('Today', open.filter((t) => t.due === today)) +
      section('Upcoming', open.filter((t) => t.due && t.due > today)) +
      section('No date', open.filter((t) => !t.due));
  }
  return `<div class="page tight">
    <div class="page-head"><h1>Tasks</h1><button class="nav-btn strong" data-action="newTask">${icon('plus')}New</button></div>
    <div class="segmented" style="margin:8px 0">
      <button class="${state.taskView === 'open' ? 'on' : ''}" data-action="taskView" data-view="open">To do (${open.length})</button>
      <button class="${state.taskView === 'done' ? 'on' : ''}" data-action="taskView" data-view="done">Done (${done.length})</button>
    </div>
    ${body}
  </div>`;
}

function newTaskForm(t, defaults = {}) {
  return {
    id: t ? t.id : null,
    title: t ? t.title : '',
    notes: t ? t.notes || '' : '',
    due: t ? t.due || '' : defaults.due || '',
    priority: t ? t.priority || 'normal' : 'normal',
    categoryId: t ? t.categoryId || null : null,
    categoryOptional: true,
    projectId: t ? t.projectId || '' : defaults.projectId || '',
  };
}

function viewTaskEdit() {
  const f = state.tkf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  const projects = data.projects.filter((p) => p.status !== 'archived').sort((a, b) => a.title.localeCompare(b.title));
  const t = f.id ? taskById(f.id) : null;
  return `${navbar(f.id ? 'Task' : 'New task', '<button class="nav-btn strong" data-action="saveTask" data-valid="task">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Title</span><input class="field" type="text" data-bind="tkf.title" value="${esc(f.title)}" placeholder="e.g. Send the application" autocomplete="off" enterkeyhint="done"></div>
    <div class="section"><span class="label">Due date (optional)</span>
      <div class="row-field"><input class="field" type="date" data-bind="tkf.due" data-rerender="1" value="${esc(f.due)}">${f.due ? `<button class="nav-btn" data-action="clearTaskDue">Clear</button>` : ''}</div>
    </div>
    <div class="section"><span class="label">Priority</span>
      <div class="segmented">${Object.entries(PRIORITY).map(([k, l]) => `<button class="${f.priority === k ? 'on' : ''}" data-action="taskPriority" data-p="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="section"><span class="label">Category (optional — tap again to clear)</span>${chips('tkf', f.categoryId)}</div>
    <div class="section"><span class="label">Project (optional)</span>
      <select class="field" data-bind="tkf.projectId"><option value="">None</option>${projects.map((p) => `<option value="${esc(p.id)}" ${f.projectId === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select>
    </div>
    <div class="section"><span class="label">Notes (optional)</span><textarea class="field" data-bind="tkf.notes">${esc(f.notes)}</textarea></div>
    ${t && t.done && t.completedAt ? `<span class="caption">Done ${esc(F.full.format(new Date(t.completedAt)))}</span>` : ''}
    ${t ? `<button class="btn-secondary danger" data-action="deleteTask" data-id="${esc(t.id)}">Delete</button>` : ''}
  </div>`;
}

function viewTaskLocked(t) {
  return `${navbar('', '<span class="caption" style="padding:0 8px">Archived</span>')}<div class="page">
    <div class="row-field" style="justify-content:flex-start;gap:8px">${t.categoryId ? badge(t.categoryId) : ''}<span class="caption">Done ${esc(F.full.format(new Date(t.completedAt)))}</span></div>
    <h1 class="done-text">${esc(t.title)}</h1>
    ${t.notes ? `<div style="white-space:pre-wrap">${esc(t.notes)}</div>` : ''}
  </div>`;
}

async function saveTask() {
  const f = state.tkf;
  if (!f || !registry.validators.task()) return;
  const existing = f.id ? taskById(f.id) : null;
  const task = {
    ...(existing || { id: uuid(), done: false, completedAt: null }),
    title: f.title.trim(),
    notes: f.notes.trim() || null,
    due: f.due || null,
    priority: f.priority,
    categoryId: f.categoryId || null,
    projectId: f.projectId || null,
  };
  try {
    await putItem('tasks', task);
  } catch (error) {
    return fail(error, 'save this task');
  }
  state.tkf = null;
  toast(existing ? 'Saved' : 'Task added');
  back();
}

async function toggleTask(id) {
  const t = taskById(id);
  if (!t || isTaskLocked(t)) return;
  const done = !t.done;
  try {
    await putItem('tasks', { ...t, done, completedAt: done ? new Date().toISOString() : null });
  } catch (error) {
    return fail(error, 'update this task');
  }
  render();
}

/** Opens the task editor from anywhere, optionally prefilled (a due day from the Calendar, a project). */
function newTask(defaults = {}) {
  state.tkf = newTaskForm(null, defaults);
  push({ name: 'taskEdit' });
}

register({
  nav: { id: 'tasks', label: 'Tasks', icon: 'check', order: 2.6 },
  tabs: { tasks: viewTasks },
  screens: {
    taskEdit: () => viewTaskEdit(),
    taskLocked: (view) => (taskById(view.id) ? viewTaskLocked(taskById(view.id)) : `${navbar('')}<div class="page"></div>`),
  },
  validators: { task: () => !!state.tkf && state.tkf.title.trim() !== '' },
  actions: {
    newTask: (el) => newTask({ due: el.dataset.due || '', projectId: el.dataset.project || '' }),
    openTask(el) {
      const t = taskById(el.dataset.id);
      if (!t) return;
      if (isTaskLocked(t)) return push({ name: 'taskLocked', id: t.id });
      state.tkf = newTaskForm(t);
      push({ name: 'taskEdit' });
    },
    toggleTask: (el) => toggleTask(el.dataset.id),
    saveTask: () => saveTask(),
    async deleteTask(el) {
      if (!confirm('Delete this task?')) return;
      try {
        await removeItem('tasks', el.dataset.id);
      } catch (error) {
        return fail(error, 'delete this task');
      }
      state.tkf = null;
      back();
    },
    taskView(el) {
      state.taskView = el.dataset.view;
      render();
    },
    taskPriority(el) {
      state.tkf.priority = el.dataset.p;
      render();
    },
    clearTaskDue() {
      state.tkf.due = '';
      render();
    },
    goTasks() {
      openModule('tasks');
      render();
    },
  },
});

export { taskRow, openTasks, tasksDueOn, taskById, newTask, dueText };
