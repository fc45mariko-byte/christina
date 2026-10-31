/* Threads: spans of time with a title, colour and category, drawn as bars on the calendar. */
import { esc, ymd, rangeText } from '../../core/util.js';
import { DB, data } from '../../core/db.js';
import { THREAD_COLORS } from '../../core/catalog.js';
import { threadById, isPastMonth, recordMonth, newestFirst } from '../../core/queries.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { navbar, badge, eventRow, chips, swatches, actionSheet, fail } from '../../ui/components.js';
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
    ${badge(t.categoryId)}
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
  const linked = data.records.filter((e) => (e.threadIds || []).includes(t.id) && !e.archived).sort(newestFirst);
  return `${navbar('', `<button class="nav-btn" data-action="editThread" data-id="${t.id}">Edit</button>`)}
  <div class="page">
    <div class="row-field" style="justify-content:flex-start">
      <span class="dot" style="width:14px;height:14px;background:#${esc(t.color)}"></span>${badge(t.categoryId)}${t.archived ? '<span class="caption">Archived</span>' : ''}
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
      ${linked.length ? `<div class="list">${linked.map((e) => eventRow(e, isPastMonth(recordMonth(e)))).join('')}</div>` : '<span class="muted">No linked events.</span>'}
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
    <div class="section"><span class="label">Category</span>${chips('te', f.categoryId)}</div>
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

async function updateThread(thread, changes, action = 'update this thread') {
  changes = { ...changes, updatedAt: new Date().toISOString() };
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

/** Deletes the thread; linked records remain (their link to it is removed). */
async function deleteThread(id, popAfter) {
  const t = threadById(id);
  if (!t) return;
  if (!confirm('Remove this thread? Linked events will remain.')) return;
  const linked = data.records.filter((e) => (e.threadIds || []).includes(id));
  const unlink = (e) => ({ ...e, threadIds: e.threadIds.filter((x) => x !== id), updatedAt: new Date().toISOString() });
  const updated = linked.map(unlink);
  try {
    await DB.write(['threads', 'records'], (tx) => {
      tx.objectStore('threads').delete(id);
      for (const e of updated) tx.objectStore('records').put(e);
    });
  } catch (error) {
    return fail(error, 'remove this thread');
  }
  linked.forEach((e, i) => Object.assign(e, updated[i]));
  data.threads = data.threads.filter((x) => x.id !== id);
  if (popAfter) back();
  else render();
}
const actions = {
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
    state.te = { id: t.id, title: t.title, categoryId: data.categories.some((c) => c.id === t.categoryId) ? t.categoryId : null, color: t.color, start: t.startDate, end: t.endDate || t.startDate, ongoing: !t.endDate };
    push({ name: 'threadEdit', id: t.id });
  },
  async saveThreadEdit() {
    const f = state.te;
    const t = threadById(f.id);
    if (!t || !registry.validators.threadEdit()) return;
    const title = f.title.trim();
    if (title.toLowerCase() !== t.title.toLowerCase() && data.threads.some((x) => x.id !== t.id && x.title.toLowerCase() === title.toLowerCase())) {
      if (!confirm(`A thread named “${title}” already exists.\n\nBoth threads will be kept separately.`)) return;
    }
    const ok = await updateThread(t, { title, categoryId: f.categoryId, color: f.color, startDate: f.start, endDate: f.ongoing ? null : f.end });
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
};

register({
  screens: {
    thread: (view) => viewThreadDetail(view.id),
    threadEdit: () => viewThreadEdit(),
  },
  tabs: { threads: viewThreads },
  actions,
  changeActions: {
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
  },
  validators: {
  threadEdit() {
    const f = state.te;
    return !!f && f.title.trim() !== '' && !!f.categoryId && !!f.start && (f.ongoing || (!!f.end && f.end >= f.start));
  },
  },
  bindHook(el) {
    if (el.dataset.bind === 'te.start' && state.te && !state.te.ongoing && state.te.end < state.te.start) state.te.end = state.te.start;
  },
});
