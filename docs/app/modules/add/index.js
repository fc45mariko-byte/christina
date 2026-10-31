/* Add (+ tab): "I did something" records an event, "I want this to happen" starts a thread. */
import { esc, uuid, localInputValue, rangeText, monthTitle, $ } from '../../core/util.js';
import { DB, data, blobRecord, requestPersistence } from '../../core/db.js';
import { threadById, recordMonth } from '../../core/queries.js';
import { state, newEventForm, newThreadForm } from '../../core/state.js';
import { render } from '../../core/render.js';
import { openModule } from '../../shell/nav.js';
import { register, registry } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { chips, swatches, toast, fail } from '../../ui/components.js';
import { compressImage, ensureSpace } from '../../services/media.js';
const activeThreads = () => data.threads.filter((t) => !t.archived).sort((a, b) => a.title.localeCompare(b.title) || a.startDate.localeCompare(b.startDate));

function viewAdd() {
  return `<div class="page">
    <div class="segmented" role="tablist">
      <button class="${state.addMode === 'did' ? 'on' : ''}" data-action="addMode" data-mode="did">I did something</button>
      <button class="${state.addMode === 'want' ? 'on' : ''}" data-action="addMode" data-mode="want">I want this to happen</button>
    </div>
    ${state.addMode === 'did' ? eventFormHTML() : threadFormHTML()}
  </div>`;
}

function eventFormHTML() {
  const f = state.ef;
  const threads = activeThreads();
  return `
    <div class="section"><span class="label">When</span>
      <input class="field" type="datetime-local" data-bind="ef.date" value="${esc(f.date)}" max="${esc(localInputValue(new Date()))}">
    </div>
    <div class="section"><span class="label">Title</span>
      <input class="field" type="text" data-bind="ef.title" value="${esc(f.title)}" placeholder="e.g. Studied Spanish" enterkeyhint="done" autocomplete="off">
    </div>
    <div class="section"><span class="label">Category</span>${chips('ef', f.categoryId)}</div>
    <div class="section"><span class="label">Duration (minutes, optional)</span>
      <input class="field" type="text" inputmode="numeric" pattern="[0-9]*" data-bind="ef.duration" value="${esc(f.duration)}" placeholder="e.g. 25">
      <span class="caption danger hidden" id="durationError">Enter a whole number of minutes.</span>
    </div>
    <div class="section"><span class="label">Thread (optional)</span>
      <select class="field" data-bind="ef.threadId">
        <option value="">None</option>
        ${threads.map((t) => `<option value="${t.id}" ${f.threadId === t.id ? 'selected' : ''}>${esc(t.title)} · ${esc(rangeText(t.startDate, t.endDate))}</option>`).join('')}
      </select>
    </div>
    <div class="section"><span class="label">Notes (optional)</span>
      <textarea class="field" data-bind="ef.notes">${esc(f.notes)}</textarea>
    </div>
    <div class="section"><span class="label">Photo (optional)</span>
      <label class="field file-btn">${icon('camera')}<span>${f.photo ? 'Replace photo' : 'Add photo'}</span>${f.processing ? '<span class="muted">Processing…</span>' : ''}
        <input type="file" accept="image/*" data-file-input="eventPhoto">
      </label>
      ${f.photoURL ? `<div class="photo"><img src="${f.photoURL}" alt=""><button class="remove-x" data-action="removeEventPhoto" aria-label="Remove photo">${icon('x')}</button></div>` : ''}
    </div>
    <button class="btn-primary" data-action="saveEvent" data-valid="event">Save</button>`;
}

function threadFormHTML() {
  const f = state.tf;
  const tied = f.tieTo ? threadById(f.tieTo) : null;
  const threads = activeThreads();
  return `
    <div class="section"><span class="label">Start date</span>
      <input class="field" type="date" data-bind="tf.start" data-rerender="1" value="${esc(f.start)}">
    </div>
    <div class="section"><span class="label">End date</span>
      <div class="field row-field"><span>No end date (ongoing)</span>
        <label class="toggle"><input type="checkbox" data-bind="tf.ongoing" data-rerender="1" ${f.ongoing ? 'checked' : ''}><span></span></label>
      </div>
      ${f.ongoing ? '' : `<input class="field" type="date" data-bind="tf.end" value="${esc(f.end)}" min="${esc(f.start)}">`}
    </div>
    <div class="section"><span class="label">Title</span>
      ${
        tied
          ? `<div class="field muted">${esc(tied.title)}</div>`
          : `<input class="field" type="text" data-bind="tf.title" value="${esc(f.title)}" placeholder="e.g. Master applications" enterkeyhint="done" autocomplete="off">`
      }
    </div>
    <div class="section"><span class="label">Category</span>${chips('tf', f.categoryId)}</div>
    <div class="section"><span class="label">Thread</span>
      <select class="field" data-bind="tf.tieTo" data-rerender="1">
        <option value="">Create a new thread</option>
        ${threads.map((t) => `<option value="${t.id}" ${f.tieTo === t.id ? 'selected' : ''}>Tie to: ${esc(t.title)} · ${esc(rangeText(t.startDate, t.endDate))}</option>`).join('')}
      </select>
    </div>
    <div class="section"><span class="label">Color</span>
      ${
        tied
          ? `<div class="field row-field" style="justify-content:flex-start"><span class="dot" style="width:24px;height:24px;background:#${esc(tied.color)}"></span><span class="label">Uses the color of “${esc(tied.title)}”</span></div>`
          : swatches('tf', f.color)
      }
    </div>
    <button class="btn-primary" data-action="saveThread" data-valid="thread">Save</button>`;
}

async function saveEvent() {
  const f = state.ef;
  if (!registry.validators.event()) return;
  const now = new Date().toISOString();
  const event = {
    id: uuid(),
    kind: 'activity',
    occurredAt: new Date(f.date).toISOString(),
    title: f.title.trim(),
    text: f.notes.trim() || null,
    categoryIds: [f.categoryId],
    threadIds: f.threadId && threadById(f.threadId) ? [f.threadId] : [],
    tagIds: [],
    mediaIds: [],
    linkedRecordIds: [],
    payload: { duration: f.duration.trim() ? Number(f.duration.trim()) : null },
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    let record = null;
    if (f.photo) {
      await ensureSpace(f.photo.size);
      event.mediaIds = [`photos/${uuid()}.jpg`];
      record = await blobRecord(f.photo);
    }
    await DB.write(['records', 'files'], (tx) => {
      if (record) tx.objectStore('files').put(record, event.mediaIds[0]);
      tx.objectStore('records').put(event);
    });
  } catch (error) {
    return fail(error, 'save this event');
  }
  requestPersistence();
  data.records.push(event);
  if (f.photoURL) URL.revokeObjectURL(f.photoURL);
  state.ef = newEventForm();
  toast(`Saved to ${monthTitle(recordMonth(event))}`);
  openModule('home');
  render();
}

async function saveThread(skipDuplicateCheck = false) {
  const f = state.tf;
  if (!registry.validators.thread()) return;
  const tied = f.tieTo ? threadById(f.tieTo) : null;
  const title = tied ? tied.title : f.title.trim();
  if (!tied && !skipDuplicateCheck && data.threads.some((t) => t.title.toLowerCase() === title.toLowerCase())) {
    if (!confirm(`A thread named “${title}” already exists.\n\nIt will be saved as a separate thread.`)) return;
  }
  const now = new Date().toISOString();
  const thread = {
    id: uuid(),
    title,
    categoryId: f.categoryId,
    color: tied ? tied.color : f.color,
    startDate: f.start,
    endDate: f.ongoing ? null : f.end,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await DB.write(['threads'], (tx) => tx.objectStore('threads').put(thread));
  } catch (error) {
    return fail(error, 'save this thread');
  }
  requestPersistence();
  data.threads.push(thread);
  state.tf = newThreadForm();
  state.addMode = 'did'; // Add opens in its default mode next time
  toast('Thread saved');
  openModule('map');
  state.mapMonth = thread.startDate.slice(0, 7);
  state.weekAnchor = thread.startDate;
  render();
}
register({
  tabs: { add: viewAdd },
  validators: {
  event() {
    const f = state.ef;
    const d = f.duration.trim();
    const durationOK = d === '' || (/^\d+$/.test(d) && Number(d) > 0);
    const err = $('#durationError');
    if (err) err.classList.toggle('hidden', durationOK);
    return f.title.trim() !== '' && !!f.categoryId && durationOK && !!f.date && !f.processing;
  },
  thread() {
    const f = state.tf;
    const title = f.tieTo ? (threadById(f.tieTo) || {}).title : f.title.trim();
    return !!title && !!f.categoryId && !!f.start && (f.ongoing || (!!f.end && f.end >= f.start));
  },
  },
  actions: {
  addMode(el) {
    state.addMode = el.dataset.mode;
    render();
  },
  pickCategory(el) {
    state[el.dataset.form].categoryId = el.dataset.category;
    render();
  },
  pickColor(el) {
    state[el.dataset.form].color = el.dataset.hex;
    render();
  },
  removeEventPhoto() {
    if (state.ef.photoURL) URL.revokeObjectURL(state.ef.photoURL);
    state.ef.photo = null;
    state.ef.photoURL = null;
    render();
  },
  saveEvent() {
    saveEvent();
  },
  saveThread() {
    saveThread();
  },
  },
  fileActions: {
  async eventPhoto(files) {
    const f = state.ef;
    f.processing = true;
    render();
    try {
      const blob = await compressImage(files[0]);
      if (f.photoURL) URL.revokeObjectURL(f.photoURL);
      f.photo = blob;
      f.photoURL = URL.createObjectURL(blob);
    } catch (error) {
      alert(`Photo problem. ${error.message}`);
    } finally {
      f.processing = false;
      render();
    }
  },
  },
  bindHook(el) {
    if (el.dataset.bind === 'tf.start' && !state.tf.ongoing && state.tf.end < state.tf.start) state.tf.end = state.tf.start;
  },
});

export { activeThreads };
