/* Overview (Home tab): the current month at a glance. */
import { esc, monthTitle, monthName, monthStart, addMonths, currentMonth } from '../../core/util.js';
import { prefs, Settings } from '../../core/prefs.js';
import { lookFor, eventsBetween, monthImageKey } from '../../core/queries.js';
import { render } from '../../core/render.js';
import { register } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { paletteDots, eventRow } from '../../ui/components.js';
function viewHome() {
  const key = currentMonth();
  const look = lookFor(key);
  const start = monthStart(key);
  const events = eventsBetween(start, monthStart(addMonths(key, 1))).sort(
    (a, b) => b.dateOccurred.localeCompare(a.dateOccurred) || b.createdAt.localeCompare(a.createdAt)
  );
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  const hint =
    !standalone && !prefs.hideInstallHint
      ? `<div class="install-hint">${icon('share')}<p>To install: tap <b>Share</b>, then <b>Add to Home Screen</b>.</p><button data-action="hideHint">Hide</button></div>`
      : '';

  return `<div class="page tight">
    ${hint}
    <h1>${esc(monthTitle(key))}</h1>
    ${look.title ? `<div class="body muted">${esc(look.title)}</div>` : ''}
    ${paletteDots(look.palette)}
    ${look.images.length ? `<div class="strip">${look.images.map((n) => `<div class="sq"><img data-file="${esc(monthImageKey(key, n))}" alt=""></div>`).join('')}</div>` : ''}
    ${
      events.length
        ? `<div class="list">${events.map((e) => eventRow(e, false, look.palette)).join('')}</div>`
        : `<div class="blank">${esc(monthName(key))} is blank. Tap + to add something.</div>`
    }
  </div>`;
}
register({
  tabs: { home: viewHome },
  actions: {
    hideHint() {
      prefs.hideInstallHint = true;
      Settings.write('hideInstallHint', true);
      render();
    },
  },
});
