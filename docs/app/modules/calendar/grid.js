/* Calendar grid shared by the Map and the Archive: day numbers, thread bars, event dots. */
import { esc, ymd, addDays, startOfDay, monthStart, maxStr, brightness, F } from '../../core/util.js';
import { firstWeekday } from '../../core/prefs.js';
import { LANE_HEIGHT } from '../../core/catalog.js';
import { eventsBetween, threadsOverlapping, threadHex, categoryHex, lookFor, monthImageKey } from '../../core/queries.js';
import { paletteDots } from '../../ui/components.js';
function monthWeeks(key) {
  const first = monthStart(key);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() - firstWeekday() + 7) % 7;
  const cells = Array(lead).fill(null);
  for (let i = 0; i < count; i++) cells.push(new Date(first.getFullYear(), first.getMonth(), i + 1));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function weekStartOf(date) {
  const d = startOfDay(date);
  return addDays(d, -((d.getDay() - firstWeekday() + 7) % 7));
}

/** Thread bars for one week row, lanes assigned so bars and labels never overlap. */
function barSegments(days, threads, visibleStartYMD) {
  const candidates = [];
  for (const t of threads) {
    const cols = [];
    days.forEach((d, i) => {
      if (!d) return;
      const s = ymd(d);
      if (s >= t.startDate && (!t.endDate || s <= t.endDate)) cols.push(i);
    });
    if (!cols.length) continue;
    const first = cols[0];
    const last = cols[cols.length - 1];
    const showsLabel = ymd(days[first]) === maxStr(t.startDate, visibleStartYMD);
    candidates.push({
      t,
      first,
      last,
      labelEnd: showsLabel ? Math.min(6, Math.max(last, first + 2)) : last,
      label: showsLabel ? (t.endDate ? t.title : `${t.title} · ongoing`) : null,
    });
  }
  candidates.sort((a, b) => a.first - b.first || a.t.startDate.localeCompare(b.t.startDate));
  const laneEnds = [];
  for (const c of candidates) {
    const occupied = Math.max(c.last, c.labelEnd);
    let lane = laneEnds.findIndex((end) => end < c.first);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(occupied);
    } else {
      laneEnds[lane] = occupied;
    }
    c.lane = lane;
  }
  return { segments: candidates, lanes: laneEnds.length };
}

function calendarGrid(weeks, startDate, endDate, palette, readOnly) {
  const accentHex = palette[0];
  const startYMD = ymd(startDate);
  const lastYMD = ymd(addDays(endDate, -1));
  const threads = threadsOverlapping(startYMD, lastYMD);
  const barHex = new Map(threads.map((t, i) => [t.id, threadHex(t, i, palette)]));
  const byDay = {};
  for (const e of eventsBetween(startDate, endDate).sort((a, b) => a.dateOccurred.localeCompare(b.dateOccurred))) {
    const k = ymd(new Date(e.dateOccurred));
    (byDay[k] = byDay[k] || []).push(e);
  }
  const todayYMD = ymd(new Date());
  const sunday = new Date(2023, 0, 1); // a Sunday
  const headers = [...Array(7)].map((_, i) => F.weekday.format(addDays(sunday, (firstWeekday() + i) % 7)));
  const todayBg = accentHex ? `#${accentHex}` : 'var(--text)';
  const todayFg = accentHex ? (brightness(accentHex) > 0.6 ? '#000' : '#fff') : 'var(--bg)';

  const rows = weeks
    .map((days) => {
      const { segments, lanes } = barSegments(days, threads, startYMD);
      const nums = days
        .map((d) => {
          if (!d) return '<div class="day"><span class="num"></span></div>';
          const isToday = ymd(d) === todayYMD;
          const style = isToday ? ` style="background:${todayBg};color:${todayFg}"` : '';
          return `<div class="day"><span class="num${isToday ? ' today' : ''}"${style}>${d.getDate()}</span></div>`;
        })
        .join('');
      const bars = lanes
        ? `<div class="bars" style="height:${lanes * LANE_HEIGHT}px">${segments
            .map((s) => {
              const left = `calc(${s.first} * 100% / 7 + 3px)`;
              const y = s.lane * LANE_HEIGHT;
              const label = s.label
                ? `<div class="bar-label" style="left:${left};top:${y}px;width:calc(${s.labelEnd - s.first + 1} * 100% / 7 - 6px)">${esc(s.label)}</div>`
                : '';
              return `${label}<div class="bar" style="left:${left};top:${y + 17}px;width:calc(${s.last - s.first + 1} * 100% / 7 - 6px);background:#${esc(barHex.get(s.t.id))}"></div>`;
            })
            .join('')}</div>`
        : '';
      const dots = days
        .map((d) => {
          const items = d ? byDay[ymd(d)] || [] : [];
          const readonlyFlag = readOnly ? 1 : -1;
          return `<div class="cell">${items
            .map((e) => `<button class="ev-dot" data-action="openEvent" data-id="${e.id}" data-readonly="${readonlyFlag}" aria-label="${esc(e.title)}"><i style="background:#${categoryHex(e.category, palette)}"></i></button>`)
            .join('')}</div>`;
        })
        .join('');
      return `<div class="week"><div class="days">${nums}</div>${bars}<div class="dots">${dots}</div></div>`;
    })
    .join('');

  return `<div class="cal"><div class="wk-head">${headers.map((h) => `<span>${esc(h)}</span>`).join('')}</div>${rows}</div>`;
}

function monthField(lookKey, startDate, endDate, weeks, readOnly) {
  const look = lookFor(lookKey);
  return `
    ${look.title ? `<div class="body muted">${esc(look.title)}</div>` : ''}
    ${paletteDots(look.palette)}
    ${calendarGrid(weeks, startDate, endDate, look.palette, readOnly)}
    ${look.images.length ? `<div class="img-grid">${look.images.map((n) => `<div class="sq"><img data-file="${esc(monthImageKey(lookKey, n))}" alt=""></div>`).join('')}</div>` : ''}`;
}
export { monthWeeks, weekStartOf, monthField };
