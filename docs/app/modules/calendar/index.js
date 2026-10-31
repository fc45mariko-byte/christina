/* Calendar (Map tab): month or week, stepping with arrows. */
import { esc, ymd, parseYMD, addDays, monthKeyOf, monthStart, addMonths, monthTitle, rangeText } from '../../core/util.js';
import { prefs } from '../../core/prefs.js';
import { state } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { monthWeeks, weekStartOf, monthField } from './grid.js';
function viewMap() {
  let start, end, weeks, lookKey, title;
  if (prefs.weekView) {
    start = weekStartOf(parseYMD(state.weekAnchor));
    end = addDays(start, 7);
    weeks = [[...Array(7)].map((_, i) => addDays(start, i))];
    lookKey = monthKeyOf(addDays(start, 3));
    title = rangeText(ymd(start), ymd(addDays(start, 6)));
  } else {
    start = monthStart(state.mapMonth);
    end = monthStart(addMonths(state.mapMonth, 1));
    weeks = monthWeeks(state.mapMonth);
    lookKey = state.mapMonth;
    title = monthTitle(state.mapMonth);
  }
  const unit = prefs.weekView ? 'week' : 'month';
  return `<div class="page">
    <div class="month-head">
      <button class="arrow" data-action="mapStep" data-dir="-1" aria-label="Previous ${unit}">${icon('left')}</button>
      <h1>${esc(title)}</h1>
      <button class="arrow" data-action="mapStep" data-dir="1" aria-label="Next ${unit}">${icon('right')}</button>
    </div>
    ${monthField(lookKey, start, end, weeks, false)}
  </div>`;
}
register({
  tabs: { map: viewMap },
  actions: {
    mapStep(el) {
      const dir = Number(el.dataset.dir);
      if (prefs.weekView) state.weekAnchor = ymd(addDays(parseYMD(state.weekAnchor), 7 * dir));
      else state.mapMonth = addMonths(state.mapMonth, dir);
      render();
    },
  },
});
