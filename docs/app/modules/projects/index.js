/* Projects: personal projects with milestones, tasks and progress — no fixed method.
 * Store 'projects': { id, title, description, color, status ('active'|'done'|'archived'), targetDate,
 *                     threadId (optional: the thread its records belong to), milestones: [{ id, title, done, doneAt }],
 *                     createdAt, updatedAt }
 * Progress = done milestones and done tasks, out of all of them. */
import { esc, uuid, F, parseYMD, rangeText } from '../../core/util.js';
import { data } from '../../core/db.js';
import { THREAD_COLORS } from '../../core/catalog.js';
import { threadById, newestFirst, isPastMonth, recordMonth } from '../../core/queries.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { putItem, removeItem, putItems } from '../../core/repo.js';
import { icon } from '../../ui/icons.js';
import { navbar, swatches, recordRow, toast, fail } from '../../ui/components.js';
import { taskRow } from '../tasks/index.js';

state.pf = null;
state.projectView = 'active';
const STATUS = { active: 'Active', done: 'Done', archived: 'Archived' };
const projectById = (id) => data.projects.find((p) => p.id === id);
const projectTasks = (p) => data.tasks.filter((t) => t.projectId === p.id);

function progress(p) {
  const ms = p.milestones || [];
  const ts = projectTasks(p);
  const total = ms.length + ts.length;
  const done = ms.filter((m) => m.done).length + ts.filter((t) => t.done).length;
  return { done, total, ratio: total ? done / total : 0 };
}
const bar = (ratio, hex) => `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ratio * 100)}"><i style="width:${Math.round(ratio * 100)}%;background:#${esc(hex)}"></i></div>`;

/** A project card: title, progress bar and count. Used by Projects and the Overview widget. */
function projectCard(p) {
  const pr = progress(p);
  const meta = [pr.total ? `${pr.done} of ${pr.total} done` : 'Nothing planned yet', p.targetDate ? `by ${F.dayMonth.format(parseYMD(p.targetDate))}` : ''].filter(Boolean).join(' · ');
  return `<button class="card" data-action="openProject" data-id="${esc(p.id)}" style="flex-direction:column;align-items:stretch;gap:8px">
    <span class="row-field"><span class="body" style="font-weight:600">${esc(p.title)}</span><span class="caption">${Math.round(pr.ratio * 100)}%</span></span>
    ${bar(pr.ratio, p.color)}
    <span class="caption">${esc(meta)}</span>
  </button>`;
}

function viewProjects() {
  const list = data.projects.filter((p) => (p.status || 'active') === state.projectView).sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999') || a.title.localeCompare(b.title));
  return `<div class="page tight">
    <div class="page-head"><h1>Projects</h1><button class="nav-btn strong" data-action="newProject">${icon('plus')}New</button></div>
    <div class="segmented" style="margin:8px 0">${Object.entries(STATUS).map(([k, l]) => `<button class="${state.projectView === k ? 'on' : ''}" data-action="projectView" data-view="${k}">${l}</button>`).join('')}</div>
    ${list.length ? list.map(projectCard).join('') : `<div class="blank">${state.projectView === 'active' ? 'No projects yet. Tap New to start one.' : `Nothing ${STATUS[state.projectView].toLowerCase()}.`}</div>`}
  </div>`;
}

function viewProject(id) {
  const p = projectById(id);
  if (!p) return `${navbar('')}<div class="page"><div class="blank">This project no longer exists.</div></div>`;
  const pr = progress(p);
  const ms = p.milestones || [];
  const tasks = projectTasks(p).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
  const thread = p.threadId ? threadById(p.threadId) : null;
  const records = thread ? data.records.filter((r) => (r.threadIds || []).includes(thread.id) && !r.archived).sort(newestFirst).slice(0, 10) : [];
  return `${navbar('', `<button class="nav-btn" data-action="editProject" data-id="${esc(p.id)}">Edit</button>`)}
  <div class="page">
    <div class="row-field" style="justify-content:flex-start;gap:8px"><span class="dot" style="background:#${esc(p.color)};width:14px;height:14px"></span><span class="label">${esc(STATUS[p.status || 'active'])}${p.targetDate ? ` · by ${esc(F.dayMonth.format(parseYMD(p.targetDate)))}` : ''}</span></div>
    <h1>${esc(p.title)}</h1>
    ${p.description ? `<div style="white-space:pre-wrap">${esc(p.description)}</div>` : ''}
    <div class="section">${bar(pr.ratio, p.color)}<span class="caption">${pr.total ? `${pr.done} of ${pr.total} done (${Math.round(pr.ratio * 100)}%)` : 'Add milestones or tasks to follow progress.'}</span></div>
    <div class="section"><span class="label">Milestones</span>
      ${ms.length ? `<div class="list">${ms.map((m) => `<div class="row"><button class="check ${m.done ? 'on' : ''}" data-action="toggleMilestone" data-id="${esc(p.id)}" data-m="${esc(m.id)}" aria-pressed="${!!m.done}" aria-label="${m.done ? 'Mark as not reached' : 'Mark as reached'}">${icon('check')}</button><span class="row-text"><span class="body ${m.done ? 'done-text' : ''}">${esc(m.title)}</span>${m.done && m.doneAt ? `<span class="caption">Reached ${esc(F.dayMonth.format(new Date(m.doneAt)))}</span>` : ''}</span><button class="arrow" data-action="removeMilestone" data-id="${esc(p.id)}" data-m="${esc(m.id)}" aria-label="Remove milestone">${icon('x')}</button></div>`).join('')}</div>` : ''}
      <div class="row-field"><input class="field" type="text" data-bind="pmil.title" placeholder="Add a milestone" autocomplete="off" enterkeyhint="done"><button class="nav-btn strong" data-action="addMilestone" data-id="${esc(p.id)}">Add</button></div>
    </div>
    <div class="section"><div class="page-head"><span class="label">Tasks</span><button class="nav-btn" data-action="newTask" data-project="${esc(p.id)}">${icon('plus')}Task</button></div>
      ${tasks.length ? `<div class="list">${tasks.map(taskRow).join('')}</div>` : '<span class="muted">No tasks in this project.</span>'}
    </div>
    ${
      thread
        ? `<div class="section"><span class="label">Thread</span><button class="card" data-action="openThread" data-id="${esc(thread.id)}"><span class="dot" style="background:#${esc(thread.color)}"></span><span class="row-text"><span>${esc(thread.title)}</span><span class="caption">${esc(rangeText(thread.startDate, thread.endDate))}</span></span>${icon('right', 'chev')}</button>
           ${records.length ? `<div class="list">${records.map((r) => recordRow(r, isPastMonth(recordMonth(r)))).join('')}</div>` : ''}</div>`
        : ''
    }
  </div>`;
}

function newProjectForm(p) {
  return {
    id: p ? p.id : null,
    title: p ? p.title : '',
    description: p ? p.description || '' : '',
    color: p ? p.color : THREAD_COLORS[1],
    status: p ? p.status || 'active' : 'active',
    targetDate: p ? p.targetDate || '' : '',
    threadId: p ? p.threadId || '' : '',
  };
}

function viewProjectEdit() {
  const f = state.pf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  const threads = data.threads.filter((t) => !t.archived || t.id === f.threadId).sort((a, b) => a.title.localeCompare(b.title));
  const colors = THREAD_COLORS.includes(f.color) ? THREAD_COLORS : [...THREAD_COLORS, f.color];
  return `${navbar(f.id ? 'Edit project' : 'New project', '<button class="nav-btn strong" data-action="saveProject" data-valid="project">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Title</span><input class="field" type="text" data-bind="pf.title" value="${esc(f.title)}" placeholder="e.g. Move to Berlin" autocomplete="off"></div>
    <div class="section"><span class="label">What it is (optional)</span><textarea class="field" data-bind="pf.description">${esc(f.description)}</textarea></div>
    <div class="section"><span class="label">Target date (optional)</span><input class="field" type="date" data-bind="pf.targetDate" value="${esc(f.targetDate)}"></div>
    <div class="section"><span class="label">Colour</span>${swatches('pf', f.color, colors)}</div>
    <div class="section"><span class="label">Thread (optional)</span>
      <select class="field" data-bind="pf.threadId"><option value="">None</option>${threads.map((t) => `<option value="${esc(t.id)}" ${f.threadId === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
      <span class="caption">Records in that thread show on the project page.</span>
    </div>
    ${f.id ? `<div class="section"><span class="label">Status</span><div class="segmented">${Object.entries(STATUS).map(([k, l]) => `<button class="${f.status === k ? 'on' : ''}" data-action="projectStatus" data-s="${k}">${l}</button>`).join('')}</div></div>
      <button class="btn-secondary danger" data-action="deleteProject" data-id="${esc(f.id)}">Delete project</button>` : ''}
  </div>`;
}

async function saveProjectChange(p, changes, what) {
  try {
    await putItem('projects', { ...p, ...changes });
  } catch (error) {
    return fail(error, what);
  }
  render();
}

state.pmil = { title: '' };

register({
  nav: { id: 'projects', label: 'Projects', icon: 'folder', order: 2.8 },
  tabs: { projects: viewProjects },
  screens: { project: (v) => viewProject(v.id), projectEdit: () => viewProjectEdit() },
  validators: { project: () => !!state.pf && state.pf.title.trim() !== '' },
  actions: {
    newProject() {
      state.pf = newProjectForm(null);
      push({ name: 'projectEdit' });
    },
    openProject: (el) => push({ name: 'project', id: el.dataset.id }),
    editProject(el) {
      state.pf = newProjectForm(projectById(el.dataset.id));
      push({ name: 'projectEdit' });
    },
    projectView(el) {
      state.projectView = el.dataset.view;
      render();
    },
    projectStatus(el) {
      state.pf.status = el.dataset.s;
      render();
    },
    async saveProject() {
      const f = state.pf;
      if (!f || !registry.validators.project()) return;
      const existing = f.id ? projectById(f.id) : null;
      const project = {
        ...(existing || { id: uuid(), milestones: [] }),
        title: f.title.trim(),
        description: f.description.trim() || null,
        color: f.color,
        status: f.status,
        targetDate: f.targetDate || null,
        threadId: f.threadId || null,
      };
      try {
        await putItem('projects', project);
      } catch (error) {
        return fail(error, 'save this project');
      }
      state.pf = null;
      toast(existing ? 'Saved' : 'Project added');
      back();
      if (!existing) push({ name: 'project', id: project.id });
    },
    async deleteProject(el) {
      const id = el.dataset.id;
      if (!confirm('Delete this project? Its tasks stay, without a project.')) return;
      const tasks = data.tasks.filter((t) => t.projectId === id).map((t) => ({ ...t, projectId: null }));
      try {
        if (tasks.length) await putItems('tasks', tasks);
        await removeItem('projects', id);
      } catch (error) {
        return fail(error, 'delete this project');
      }
      state.pf = null;
      back();
      back();
    },
    addMilestone(el) {
      const p = projectById(el.dataset.id);
      const title = (state.pmil.title || '').trim();
      if (!p || !title) return;
      state.pmil.title = '';
      saveProjectChange(p, { milestones: [...(p.milestones || []), { id: uuid(), title, done: false, doneAt: null }] }, 'add this milestone');
    },
    toggleMilestone(el) {
      const p = projectById(el.dataset.id);
      if (!p) return;
      const milestones = (p.milestones || []).map((m) => (m.id === el.dataset.m ? { ...m, done: !m.done, doneAt: m.done ? null : new Date().toISOString() } : m));
      saveProjectChange(p, { milestones }, 'update this milestone');
    },
    removeMilestone(el) {
      const p = projectById(el.dataset.id);
      if (!p || !confirm('Remove this milestone?')) return;
      saveProjectChange(p, { milestones: (p.milestones || []).filter((m) => m.id !== el.dataset.m) }, 'remove this milestone');
    },
  },
});

export { projectCard, progress };
