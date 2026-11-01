/* Christina — shared interface pieces: nav bar, list rows, chips, swatches, toast, action sheet. */
import { esc, timestamp, $ } from '../core/util.js';
import { THREAD_COLORS } from '../core/catalog.js';
import { data } from '../core/db.js';
import { categoryById, categoryHex, recordCategoryId, recordDuration, recordTitle, recordHex } from '../core/queries.js';
import { registry } from '../core/registry.js';
import { icon } from './icons.js';
function navbar(title, right = '') {
  return `<div class="navbar">
    <div class="left"><button class="nav-btn" data-action="back" aria-label="Back">${icon('left')}Back</button></div>
    <div class="nav-title">${esc(title)}</div>
    <div class="right">${right}</div>
  </div>`;
}

const paletteDots = (colors, size = 10) =>
  colors.length ? `<div class="palette">${colors.map((c) => `<i style="background:#${esc(c)};width:${size}px;height:${size}px"></i>`).join('')}</div>` : '';

const catIcon = (categoryId, size = 32, palette = null) => {
  const c = categoryById(categoryId);
  const hex = categoryHex(categoryId, palette);
  return `<span class="cat-icon" style="width:${size}px;height:${size}px;background:#${hex}2e;color:#${hex}">${icon(c.icon)}</span>`;
};

const badge = (categoryId) => {
  if (!categoryId) return '';
  const c = categoryById(categoryId);
  return `<span class="badge" style="background:#${c.color}33">${esc(c.name)}</span>`;
};

function eventRow(e, readOnly, palette = null) {
  const duration = recordDuration(e);
  const line = duration != null ? `${e.title} — ${duration} min` : e.title;
  return `<button class="row" data-action="openEvent" data-id="${e.id}" data-readonly="${readOnly ? 1 : 0}">
    ${catIcon(recordCategoryId(e), 32, palette)}
    <span class="row-text"><span class="body">${esc(line)}</span><span class="caption">${esc(timestamp(new Date(e.occurredAt)))}</span></span>
  </button>`;
}

/** Any record in a list. Christina's own events keep their row; other records (journal, rituals, states) show their
 *  kind's icon in their colour, and open in their own section. */
function recordRow(r, readOnly, palette = null) {
  if (r.kind === 'activity') return eventRow(r, readOnly, palette);
  const kind = registry.kinds[r.kind] || { label: r.kind, icon: 'more' };
  const hex = recordHex(r, palette);
  return `<button class="row" data-action="openRecord" data-id="${esc(r.id)}">
    <span class="cat-icon" style="width:32px;height:32px;background:#${hex}2e;color:#${hex}">${icon(kind.icon)}</span>
    <span class="row-text"><span class="body">${esc(recordTitle(r, kind.label))}</span><span class="caption">${esc(kind.label)} · ${esc(timestamp(new Date(r.occurredAt)))}</span></span>
  </button>`;
}

function chips(form, selected) {
  return `<div class="chips">${data.categories.map((c) => {
    const on = selected === c.id;
    return `<button class="chip${on ? ' on' : ''}" style="${on ? `background:#${esc(c.color)}` : ''}" data-action="pickCategory" data-form="${form}" data-category="${esc(c.id)}" aria-pressed="${on}">${icon(c.icon)}<span>${esc(c.name)}</span></button>`;
  }).join('')}</div>`;
}

function swatches(form, selected, colors = THREAD_COLORS) {
  return `<div class="swatches">${colors
    .map((hex) => `<button class="swatch${selected === hex ? ' on' : ''}" data-action="pickColor" data-form="${form}" data-hex="${hex}" aria-label="Color ${hex}" aria-pressed="${selected === hex}"><span style="background:#${hex}"></span></button>`)
    .join('')}</div>`;
}

function settingsRow(label, ic, action, extra = '') {
  return `<button class="settings-row" data-action="${action}">${icon(ic, 'ic')}<span class="grow">${label}</span>${extra}${icon('right', 'chev')}</button>`;
}

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function actionSheet(title, buttons) {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-body">
    <div class="group"><div class="title">${esc(title)}</div>${buttons
      .map((b, i) => `<button data-sheet="${i}" style="${b.destructive ? 'color:var(--danger)' : ''}">${esc(b.label)}</button>`)
      .join('')}</div>
    <div class="group"><button data-sheet="cancel" style="font-weight:600">Cancel</button></div>
  </div>`;
  sheet.classList.remove('hidden');
  sheet.onclick = (event) => {
    const target = event.target.closest('[data-sheet]');
    if (!target && event.target !== sheet) return;
    sheet.classList.add('hidden');
    sheet.innerHTML = '';
    if (target && target.dataset.sheet !== 'cancel') buttons[Number(target.dataset.sheet)].run();
  };
}

function fail(error, action) {
  console.error(error);
  alert(`Couldn't ${action}. ${error && error.message ? error.message : error}`);
}
export { navbar, paletteDots, catIcon, badge, eventRow, recordRow, chips, swatches, settingsRow, toast, actionSheet, fail };
