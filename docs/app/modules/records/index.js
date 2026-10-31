/* Event detail: one recorded event, read-only once its month has passed. */
import { esc, F, rangeText } from '../../core/util.js';
import { DB, data, forgetFileURL } from '../../core/db.js';
import {
  recordById, threadById, recordMonth, isPastMonth, categoryById, recordCategoryId, recordThreadId, recordPhoto, recordDuration,
} from '../../core/queries.js';
import { push, back } from '../../core/state.js';
import { register } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { navbar, catIcon, fail } from '../../ui/components.js';
function viewEventDetail(id, readOnly) {
  const e = recordById(id);
  if (!e) return `${navbar('')}<div class="page"><div class="blank">This event no longer exists.</div></div>`;
  const categoryId = recordCategoryId(e);
  const c = categoryById(categoryId);
  const threadId = recordThreadId(e);
  const thread = threadId ? threadById(threadId) : null;
  const duration = recordDuration(e);
  const photo = recordPhoto(e);
  return `${navbar('')}
  <div class="page">
    <div class="row-field" style="justify-content:flex-start;gap:8px">${catIcon(categoryId, 28)}<span class="label">${esc(c.name)}</span>${readOnly ? '<span class="caption" style="margin-left:auto">Archived</span>' : ''}</div>
    <h1>${esc(e.title)}</h1>
    <div class="section"><span class="label">When</span><span>${esc(F.full.format(new Date(e.occurredAt)))}</span></div>
    ${duration != null ? `<div class="section"><span class="label">Duration</span><span>${duration} min</span></div>` : ''}
    ${
      threadId
        ? `<div class="section"><span class="label">Thread</span>${
            thread
              ? `<button class="card" ${readOnly ? 'disabled style="opacity:1"' : `data-action="openThread" data-id="${thread.id}"`}>
                  <span class="dot" style="background:#${esc(thread.color)}"></span>
                  <span class="row-text"><span>${esc(thread.title)}</span><span class="caption">${esc(rangeText(thread.startDate, thread.endDate))}</span></span>
                  ${readOnly ? '' : icon('right', 'chev')}
                </button>`
              : '<span class="muted">Thread removed</span>'
          }</div>`
        : ''
    }
    ${e.text ? `<div class="section"><span class="label">Notes</span><span style="white-space:pre-wrap">${esc(e.text)}</span></div>` : ''}
    ${photo ? `<div class="photo"><img data-file="${esc(photo)}" alt=""></div>` : ''}
    ${readOnly ? '' : `<button class="btn-secondary danger" data-action="deleteEvent" data-id="${e.id}" style="margin-top:8px">Delete</button>`}
  </div>`;
}

async function deleteEvent(id) {
  const e = recordById(id);
  if (!e) return;
  const media = e.mediaIds || [];
  if (!confirm(media.length ? 'Delete this event and its photo?' : 'Delete this event?')) return;
  try {
    await DB.write(['records', 'files'], (tx) => {
      tx.objectStore('records').delete(e.id);
      media.forEach((key) => tx.objectStore('files').delete(key));
    });
  } catch (error) {
    return fail(error, 'delete this event');
  }
  media.forEach(forgetFileURL);
  data.records = data.records.filter((x) => x.id !== e.id);
  back();
}
register({
  screens: { event: (view) => viewEventDetail(view.id, view.readOnly) },
  actions: {
  openEvent(el) {
    const e = recordById(el.dataset.id);
    if (!e) return;
    const flag = el.dataset.readonly;
    const readOnly = flag === '1' || (flag === '-1' && isPastMonth(recordMonth(e)));
    push({ name: 'event', id: e.id, readOnly });
  },
  deleteEvent(el) {
    deleteEvent(el.dataset.id);
  },
  },
});
