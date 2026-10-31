/* Journal: a private place to write. Entries are records of kind 'journal':
 * { occurredAt, title (optional), text, categoryIds, threadIds, tagIds, linkedRecordIds, … }.
 * The Journal stands on its own; an entry can optionally link to other records (Body Oracle observations,
 * Christina events), which then show the link from their side too. Past months are read-only. */
import { esc, uuid, localInputValue, F, timestamp, monthTitle, rangeText, $ } from '../../core/util.js';
import { DB, data, requestPersistence } from '../../core/db.js';
import {
  recordById, recordMonth, isPastMonth, newestFirst, categoryById, tagById, threadById, recordTitle,
} from '../../core/queries.js';
import { state, push, back } from '../../core/state.js';
import { render, hydrateImages } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { navbar, badge, chips, recordRow, toast, fail } from '../../ui/components.js';
import { openModule } from '../../shell/nav.js';
import { search } from '../../services/search.js';

state.journalQuery = '';
state.journalTag = '';
state.jf = null; // journal form

const KIND = 'journal';
const lower = (s) => String(s || '').trim().toLowerCase();
const journalEntries = () => data.records.filter((r) => r.kind === KIND && !r.archived).sort(newestFirst);
const isLocked = (r) => isPastMonth(recordMonth(r));
/** Records that link to this one (shown on the other record's side). */
const linkedFrom = (id) => data.records.filter((r) => (r.linkedRecordIds || []).includes(id));

// ------------------------------------------------------------ list

function entryRows(list) {
  let html = '';
  let month = '';
  for (const r of list) {
    const m = recordMonth(r);
    if (m !== month) {
      html += `<span class="label" style="margin-top:12px">${esc(monthTitle(m))}</span>`;
      month = m;
    }
    html += `<div class="list">${recordRow(r)}</div>`;
  }
  return html;
}

function listBody() {
  let list = journalEntries();
  if (state.journalTag) list = list.filter((r) => (r.tagIds || []).includes(state.journalTag));
  if (state.journalQuery.trim()) {
    const ids = new Set(search(state.journalQuery, KIND).records.map((r) => r.id));
    list = list.filter((r) => ids.has(r.id));
  }
  if (!journalEntries().length) return '<div class="blank">Nothing written yet. Tap New to write your first entry.</div>';
  if (!list.length) return '<span class="caption">No entries match.</span>';
  return entryRows(list);
}

function viewJournal() {
  const used = new Set(journalEntries().flatMap((r) => r.tagIds || []));
  const tags = data.tags.filter((t) => used.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  if (state.journalTag && !used.has(state.journalTag)) state.journalTag = '';
  return `<div class="page tight">
    <div class="row-field"><h1>Journal</h1><button class="nav-btn strong" data-action="newJournal">${icon('plus')}New</button></div>
    <label class="field search-field">${icon('search')}<input type="search" data-live="journalSearch" value="${esc(state.journalQuery)}" placeholder="Search your journal" autocomplete="off" enterkeyhint="search" aria-label="Search your journal"></label>
    ${
      tags.length
        ? `<div class="strip">${[['', 'All'], ...tags.map((t) => [t.id, t.name])]
            .map(([id, name]) => `<button class="badge" style="background:${state.journalTag === id ? 'var(--text);color:var(--bg)' : 'var(--surface)'};font-size:14px;padding:6px 12px" data-action="journalTag" data-id="${esc(id)}">${esc(name)}</button>`)
            .join('')}</div>`
        : ''
    }
    <div id="journal-body" class="section">${listBody()}</div>
  </div>`;
}

// ------------------------------------------------------------ entry

function viewEntry(id) {
  const r = recordById(id);
  if (!r) return `${navbar('')}<div class="page"><div class="blank">This entry no longer exists.</div></div>`;
  const locked = isLocked(r);
  const categoryId = (r.categoryIds || [])[0];
  const thread = (r.threadIds || [])[0] ? threadById(r.threadIds[0]) : null;
  const tags = (r.tagIds || []).map(tagById).filter(Boolean);
  const linked = (r.linkedRecordIds || []).map(recordById).filter(Boolean);
  const from = linkedFrom(r.id);
  return `${navbar('', locked ? '<span class="caption" style="padding:0 8px">Archived</span>' : `<button class="nav-btn" data-action="editJournal" data-id="${esc(r.id)}">Edit</button>`)}
  <div class="page">
    <div class="row-field" style="justify-content:flex-start;gap:8px">${categoryId ? badge(categoryId) : ''}<span class="caption">${esc(F.full.format(new Date(r.occurredAt)))}</span></div>
    ${r.title ? `<h1>${esc(r.title)}</h1>` : ''}
    <div style="white-space:pre-wrap;font-size:17px;line-height:1.5">${esc(r.text || '')}</div>
    ${tags.length ? `<div class="row-field" style="justify-content:flex-start;flex-wrap:wrap">${tags.map((t) => `<span class="badge" style="background:var(--surface);font-size:14px">${esc(t.name)}</span>`).join('')}</div>` : ''}
    ${
      thread
        ? `<div class="section"><span class="label">Thread</span><button class="card" data-action="openThread" data-id="${esc(thread.id)}"><span class="dot" style="background:#${esc(thread.color)}"></span><span class="row-text"><span>${esc(thread.title)}</span><span class="caption">${esc(rangeText(thread.startDate, thread.endDate))}</span></span>${icon('right', 'chev')}</button></div>`
        : ''
    }
    ${linked.length ? `<div class="section"><span class="label">Linked</span><div class="list">${linked.map((x) => recordRow(x, isLocked(x))).join('')}</div></div>` : ''}
    ${from.length ? `<div class="section"><span class="label">Linked from</span><div class="list">${from.map((x) => recordRow(x, isLocked(x))).join('')}</div></div>` : ''}
    ${locked ? '' : `<button class="btn-secondary danger" data-action="deleteJournal" data-id="${esc(r.id)}" style="margin-top:8px">Delete</button>`}
  </div>`;
}

// ------------------------------------------------------------ editor

function newForm(r) {
  return {
    id: r ? r.id : null,
    date: localInputValue(r ? new Date(r.occurredAt) : new Date()),
    title: r ? r.title || '' : '',
    text: r ? r.text || '' : '',
    categoryId: r ? (r.categoryIds || [])[0] || null : null,
    categoryOptional: true,
    threadId: r ? (r.threadIds || [])[0] || '' : '',
    tags: r ? (r.tagIds || []).map(tagById).filter(Boolean).map((t) => t.name).join(', ') : '',
    linked: r ? [...(r.linkedRecordIds || [])] : [],
  };
}

function viewEdit() {
  const f = state.jf;
  if (!f) return `${navbar('')}<div class="page"><div class="blank">Nothing to edit.</div></div>`;
  const threads = data.threads.filter((t) => !t.archived).sort((a, b) => a.title.localeCompare(b.title));
  const linked = f.linked.map(recordById).filter(Boolean);
  return `${navbar(f.id ? 'Edit entry' : 'New entry', '<button class="nav-btn strong" data-action="saveJournal" data-valid="journal">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">When</span>
      <input class="field" type="datetime-local" data-bind="jf.date" value="${esc(f.date)}" max="${esc(localInputValue(new Date()))}">
    </div>
    <div class="section"><span class="label">Title (optional)</span>
      <input class="field" type="text" data-bind="jf.title" value="${esc(f.title)}" autocomplete="off">
    </div>
    <div class="section"><span class="label">Entry</span>
      <textarea class="field" data-bind="jf.text" style="min-height:220px" placeholder="What happened, what you think about it">${esc(f.text)}</textarea>
    </div>
    <div class="section"><span class="label">Category (optional — tap again to clear)</span>${chips('jf', f.categoryId)}</div>
    <div class="section"><span class="label">Tags (optional, separated by commas)</span>
      <input class="field" type="text" data-bind="jf.tags" value="${esc(f.tags)}" placeholder="e.g. family, berlin" autocomplete="off">
    </div>
    <div class="section"><span class="label">Thread (optional)</span>
      <select class="field" data-bind="jf.threadId">
        <option value="">None</option>
        ${threads.map((t) => `<option value="${esc(t.id)}" ${f.threadId === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
      </select>
    </div>
    <div class="section"><span class="label">Linked records (optional)</span>
      ${linked.length ? `<div class="list">${linked.map((x) => `<div class="row-field">${recordRow(x, true)}<button class="arrow" data-action="unlinkJournal" data-id="${esc(x.id)}" aria-label="Remove link">${icon('x')}</button></div>`).join('')}</div>` : ''}
      <button class="btn-secondary" data-action="openJournalLink">${icon('link')} Link an observation or event</button>
    </div>
  </div>`;
}

const LINKABLE_DAYS = 90;
function viewLink() {
  const f = state.jf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  const since = Date.now() - LINKABLE_DAYS * 864e5;
  const list = data.records
    .filter((r) => r.kind !== KIND && r.id !== f.id && !r.archived && (new Date(r.occurredAt).getTime() >= since || f.linked.includes(r.id)))
    .sort(newestFirst);
  return `${navbar('Link records', '<button class="nav-btn strong" data-action="back">Done</button>')}
  <div class="page tight">
    <p class="footnote" style="padding:0">Records from the last ${LINKABLE_DAYS} days. The link shows on both sides.</p>
    ${
      list.length
        ? `<div class="list">${list
            .map((r) => {
              const on = f.linked.includes(r.id);
              const kind = registry.kinds[r.kind];
              return `<button class="row" data-action="toggleJournalLink" data-id="${esc(r.id)}" aria-pressed="${on}">
                <span class="row-text"><span class="body">${esc(recordTitle(r, kind ? kind.label : ''))}</span><span class="caption">${esc(kind ? kind.label : 'Event')} · ${esc(timestamp(new Date(r.occurredAt)))}</span></span>
                ${on ? icon('check', 'chev') : ''}
              </button>`;
            })
            .join('')}</div>`
        : '<div class="blank">Nothing recorded in that time.</div>'
    }
  </div>`;
}

// ------------------------------------------------------------ saving

/** Tag names → tag ids, creating tags that don't exist yet (matched without regard to case). */
function resolveTags(text, now) {
  const names = [];
  for (const raw of String(text || '').split(',')) {
    const name = raw.trim();
    if (name && !names.some((n) => lower(n) === lower(name))) names.push(name);
  }
  const created = [];
  const ids = names.map((name) => {
    const existing = data.tags.find((t) => lower(t.name) === lower(name));
    if (existing) return existing.id;
    const tag = { id: uuid(), name, createdAt: now, updatedAt: now };
    created.push(tag);
    return tag.id;
  });
  return { ids, created };
}

async function saveJournal() {
  const f = state.jf;
  if (!f || !registry.validators.journal()) return;
  const now = new Date().toISOString();
  const existing = f.id ? recordById(f.id) : null;
  if (existing && isLocked(existing)) return;
  const { ids: tagIds, created } = resolveTags(f.tags, now);
  const record = {
    ...(existing || {}),
    id: existing ? existing.id : uuid(),
    kind: KIND,
    occurredAt: new Date(f.date).toISOString(),
    title: f.title.trim() || null,
    text: f.text.trim(),
    categoryIds: f.categoryId ? [f.categoryId] : [],
    threadIds: f.threadId && threadById(f.threadId) ? [f.threadId] : [],
    tagIds,
    mediaIds: existing ? existing.mediaIds || [] : [],
    linkedRecordIds: f.linked.filter((id) => recordById(id)),
    payload: existing ? existing.payload || {} : {},
    archived: false,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  try {
    await DB.write(['records', 'tags'], (tx) => {
      created.forEach((t) => tx.objectStore('tags').put(t));
      tx.objectStore('records').put(record);
    });
  } catch (error) {
    return fail(error, 'save this entry');
  }
  requestPersistence();
  data.tags.push(...created);
  const i = data.records.findIndex((r) => r.id === record.id);
  if (i === -1) data.records.push(record);
  else data.records[i] = record;
  state.jf = null;
  toast(existing ? 'Saved' : `Saved to ${monthTitle(recordMonth(record))}`);
  back();
  if (!existing) push({ name: 'journalEntry', id: record.id });
}

async function deleteJournal(id) {
  const r = recordById(id);
  if (!r || isLocked(r)) return;
  if (!confirm('Delete this journal entry?')) return;
  try {
    await DB.write(['records'], (tx) => tx.objectStore('records').delete(id));
  } catch (error) {
    return fail(error, 'delete this entry');
  }
  data.records = data.records.filter((x) => x.id !== id);
  back();
}

// ------------------------------------------------------------ registration

function openEntry(r) {
  openModule(KIND);
  push({ name: 'journalEntry', id: r.id });
}

register({
  nav: { id: KIND, label: 'Journal', icon: 'journal', order: 2.5 },
  tabs: { journal: viewJournal },
  kinds: { journal: { label: 'Journal', icon: 'journal', open: openEntry } },
  screens: {
    journalEntry: (view) => viewEntry(view.id),
    journalEdit: () => viewEdit(),
    journalLink: () => viewLink(),
  },
  validators: {
    journal() {
      const f = state.jf;
      return !!f && f.text.trim() !== '' && !!f.date && new Date(f.date).getTime() <= Date.now() + 60000;
    },
  },
  liveInputs: {
    journalSearch(el) {
      state.journalQuery = el.value;
      const box = $('#journal-body');
      if (!box) return;
      box.innerHTML = listBody();
      hydrateImages(box);
    },
  },
  actions: {
    newJournal() {
      state.jf = newForm(null);
      push({ name: 'journalEdit' });
    },
    editJournal(el) {
      const r = recordById(el.dataset.id);
      if (!r || isLocked(r)) return;
      state.jf = newForm(r);
      push({ name: 'journalEdit' });
    },
    saveJournal: () => saveJournal(),
    deleteJournal: (el) => deleteJournal(el.dataset.id),
    journalTag(el) {
      state.journalTag = el.dataset.id;
      render();
    },
    openJournalLink: () => push({ name: 'journalLink' }),
    toggleJournalLink(el) {
      const f = state.jf;
      if (!f) return;
      const id = el.dataset.id;
      f.linked = f.linked.includes(id) ? f.linked.filter((x) => x !== id) : [...f.linked, id];
      render();
    },
    unlinkJournal(el) {
      if (!state.jf) return;
      state.jf.linked = state.jf.linked.filter((x) => x !== el.dataset.id);
      render();
    },
  },
});

export { linkedFrom };
