/* Archive: every month that holds something, each opening as a read-only calendar. */
import { esc, monthName, monthShort, monthTitle, monthStart, addMonths } from '../../core/util.js';
import { lookFor, monthImageKey, monthsWithContent } from '../../core/queries.js';
import { push } from '../../core/state.js';
import { register } from '../../core/registry.js';
import { navbar, paletteDots } from '../../ui/components.js';
import { monthWeeks, monthField } from '../calendar/grid.js';
function viewArchive() {
  const months = monthsWithContent();
  if (!months.length) return `<div class="page"><h1>Archive</h1><div class="blank">Nothing recorded yet.</div></div>`;
  return `<div class="page"><h1>Archive</h1><div class="tiles">${months
    .map((key) => {
      const look = lookFor(key);
      const cover = look.images[0]
        ? `<div class="sq"><img data-file="${esc(monthImageKey(key, look.images[0]))}" alt=""></div>`
        : `<div class="sq">${esc(monthName(key))}</div>`;
      return `<button class="tile" data-action="openMonth" data-month="${key}">${cover}<span class="tile-label">${esc(monthShort(key))}</span>${paletteDots(look.palette.slice(0, 4), 8)}</button>`;
    })
    .join('')}</div></div>`;
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
  actions: {
    openMonth(el) {
      push({ name: 'archiveMonth', month: el.dataset.month });
    },
  },
});
