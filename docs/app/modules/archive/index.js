/* Archive: every month that holds something, each opening as a read-only calendar,
 * and one search across everything recorded (events, journal, Body Oracle) and threads. */
import { esc, monthName, monthShort, monthTitle, monthStart, addMonths, rangeText, $ } from '../../core/util.js';
import { lookFor, monthImageKey, monthsWithContent, isPastMonth, recordMonth } from '../../core/queries.js';
import { state, push } from '../../core/state.js';
import { render, hydrateImages } from '../../core/render.js';
import { register } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { navbar, paletteDots, recordRow } from '../../ui/components.js';
import { search } from '../../services/search.js';
import { monthWeeks, monthField } from '../calendar/grid.js';

state.archiveQuery = '';
state.archiveKind = 'all';
const KINDS = [['all', 'All'], ['activity', 'Events'], ['journal', 'Journal'], ['bodyOracle', 'Body Oracle']];

function monthTiles() {
  const months = monthsWithContent();
  if (!months.length) return '<div class="blank">Nothing recorded yet.</div>';
  return `<div class="tiles">${months
    .map((key) => {
      const look = lookFor(key);
      const cover = look.images[0]
        ? `<div class="sq"><img data-file="${esc(monthImageKey(key, look.images[0]))}" alt=""></div>`
        : `<div class="sq">${esc(monthName(key))}</div>`;
      return `<button class="tile" data-action="openMonth" data-month="${key}">${cover}<span class="tile-label">${esc(monthShort(key))}</span>${paletteDots(look.palette.slice(0, 4), 8)}</button>`;
    })
    .join('')}</div>`;
}

function results() {
  const { records, threads } = search(state.archiveQuery, state.archiveKind);
  const count = records.length + threads.length;
  return `<div class="strip">${KINDS.map(([k, l]) => `<button class="badge" style="background:${state.archiveKind === k ? 'var(--text);color:var(--bg)' : 'var(--surface)'};font-size:14px;padding:6px 12px" data-action="archiveKind" data-kind="${k}" aria-pressed="${state.archiveKind === k}">${l}</button>`).join('')}</div>
    <span class="caption">${count ? `${count} ${count === 1 ? 'result' : 'results'}` : 'Nothing matches that search.'}</span>
    ${threads
      .map((t) => `<button class="card" data-action="openThread" data-id="${esc(t.id)}"><span class="dot" style="background:#${esc(t.color)}"></span><span class="row-text"><span>${esc(t.title)}</span><span class="caption">Thread · ${esc(rangeText(t.startDate, t.endDate))}</span></span></button>`)
      .join('')}
    ${records.length ? `<div class="list">${records.slice(0, 200).map((r) => recordRow(r, isPastMonth(recordMonth(r)))).join('')}</div>` : ''}`;
}

const body = () => (state.archiveQuery.trim() ? results() : monthTiles());

function viewArchive() {
  return `<div class="page tight"><h1>Archive</h1>
    <label class="field search-field">${icon('search')}<input type="search" data-live="archiveSearch" value="${esc(state.archiveQuery)}" placeholder="Search everything" autocomplete="off" enterkeyhint="search" aria-label="Search everything"></label>
    <div id="archive-body" class="section" style="margin-top:8px">${body()}</div>
  </div>`;
}

function viewArchiveMonth(key) {
  return `${navbar('')}<div class="page">
    <h1>${esc(monthTitle(key))}</h1>
    ${monthField(key, monthStart(key), monthStart(addMonths(key, 1)), monthWeeks(key), true)}
  </div>`;
}

register({
  nav: { id: 'archive', label: 'Archive', icon: 'archive', order: 4 },
  tabs: { archive: viewArchive },
  screens: { archiveMonth: (view) => viewArchiveMonth(view.month) },
  liveInputs: {
    // Updates only the results, so the field keeps focus while typing.
    archiveSearch(el) {
      state.archiveQuery = el.value;
      const box = $('#archive-body');
      if (!box) return;
      box.innerHTML = body();
      hydrateImages(box);
    },
  },
  actions: {
    openMonth(el) {
      push({ name: 'archiveMonth', month: el.dataset.month });
    },
    archiveKind(el) {
      state.archiveKind = el.dataset.kind;
      render();
    },
  },
});
