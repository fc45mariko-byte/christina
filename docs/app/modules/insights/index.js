/* Insights: what your own records show over time — counts you can check, not interpretations.
 * Every number is counted from stored records, and every bar opens the records it was counted from.
 * "Recorded together" says how often two things appeared on the same days; it never says one causes the other. */
import { esc, ymd, parseYMD, addDays, F, monthKeyOf, monthStart, addMonths, monthShort, currentMonth } from '../../core/util.js';
import { data } from '../../core/db.js';
import { isWriting, categoryById, recordTitle, newestFirst, isPastMonth, recordMonth } from '../../core/queries.js';
import { state, push } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { navbar, recordRow } from '../../ui/components.js';
import { weekStartOf } from '../calendar/grid.js';
import { activeHabits, habitStats, daysOf } from '../habits/index.js';
import { progress } from '../projects/index.js';

const PERIODS = { w4: { label: '4 weeks', weeks: 4 }, m3: { label: '3 months', weeks: 13 }, y1: { label: '12 months', months: 12 } };
state.insightPeriod = 'w4';
state.insightList = null;

// ------------------------------------------------------------ periods and buckets

/** Buckets (weeks, or months for a year) from oldest to newest, plus the equal period before them. */
function buckets(periodKey = state.insightPeriod) {
  const p = PERIODS[periodKey];
  const out = [];
  if (p.months) {
    const now = currentMonth();
    for (let i = p.months - 1; i >= 0; i--) {
      const key = addMonths(now, -i);
      out.push({ start: monthStart(key), end: monthStart(addMonths(key, 1)), label: monthShort(key), short: monthShort(key) });
    }
  } else {
    const thisWeek = weekStartOf(new Date());
    for (let i = p.weeks - 1; i >= 0; i--) {
      const start = addDays(thisWeek, -7 * i);
      out.push({ start, end: addDays(start, 7), label: `Week of ${F.dayMonth.format(start)}`, short: F.dayMonth.format(start) });
    }
  }
  const from = out[0].start;
  const to = out[out.length - 1].end;
  const span = to.getTime() - from.getTime();
  return { list: out, from, to, prevFrom: new Date(from.getTime() - span), prevTo: from };
}
const inRange = (iso, a, b) => { const t = new Date(iso).getTime(); return t >= a.getTime() && t < b.getTime(); };
const dayInRange = (day, a, b) => day >= ymd(a) && day < ymd(b);
const periodRecords = (a, b) => data.records.filter((r) => !r.archived && inRange(r.occurredAt, a, b));

// ------------------------------------------------------------ drawing (plain HTML bars; values on hover/focus, tap opens records)

function columnChart(series, name, unit) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const total = series.reduce((n, s) => n + s.value, 0);
  if (!total) return '<span class="muted">Nothing recorded in this period.</span>';
  const peak = series.reduce((a, b) => (b.value > a.value ? b : a));
  return `<div class="vbars" role="list" aria-label="${esc(name)}">${series
    .map((s, i) => {
      const tip = `${s.label}: ${s.value} ${s.value === 1 ? unit[0] : unit[1]}`;
      return `<button class="vbar" role="listitem" data-action="insightOpen" data-key="${esc(name)}" data-i="${i}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" ${s.value ? '' : 'disabled'}>
        <i style="height:${(s.value / max) * 100}%"></i>${s === peak ? `<b>${s.value}</b>` : ''}
      </button>`;
    })
    .join('')}</div>
    <div class="vaxis"><span>${esc(series[0].short)}</span><span>${esc(series[series.length - 1].short)}</span></div>`;
}

function barList(rows, name, format = (v) => String(v)) {
  if (!rows.length) return '<span class="muted">Nothing recorded in this period.</span>';
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<div class="hbars">${rows
    .map((r, i) => `<button class="hbar" data-action="insightOpen" data-key="${esc(name)}" data-i="${i}" aria-label="${esc(`${r.label}: ${format(r.value)}`)}">
      <span class="hbar-label">${r.hex ? `<span class="dot" style="background:#${esc(r.hex)};width:8px;height:8px"></span>` : ''}${esc(r.label)}</span>
      <span class="hbar-track"><i style="width:${(r.value / max) * 100}%"></i></span>
      <span class="hbar-value">${esc(format(r.value))}</span>
    </button>`)
    .join('')}</div>`;
}

// What a tap opens: kept per render, by chart name and row index.
let OPEN = {};
const remember = (name, rows) => (OPEN[name] = rows.map((r) => ({ title: r.title || r.label, ids: r.ids || [] })));

// ------------------------------------------------------------ the numbers

function summary(B) {
  const count = (a, b) => ({
    recorded: periodRecords(a, b).filter((r) => !isWriting(r)).length,
    journal: periodRecords(a, b).filter(isWriting).length,
    tasks: data.tasks.filter((t) => t.done && t.completedAt && inRange(t.completedAt, a, b)).length,
    checkins: data.habitLogs.filter((l) => dayInRange(l.date, a, b)).length,
  });
  const now = count(B.from, B.to);
  const prev = count(B.prevFrom, B.prevTo);
  const tile = (label, k) => {
    const d = now[k] - prev[k];
    return `<div class="stat"><span class="caption">${label}</span><b>${now[k]}</b><span class="caption">${d === 0 ? 'same as the period before' : `${d > 0 ? '+' : '−'}${Math.abs(d)} vs the period before`}</span></div>`;
  };
  return `<div class="stats" style="grid-template-columns:repeat(2,1fr)">${tile('Recorded', 'recorded')}${tile('Journal entries', 'journal')}${tile('Tasks done', 'tasks')}${tile('Habit check-ins', 'checkins')}</div>`;
}

function perBucket(B, filter, name, unit) {
  const series = B.list.map((b) => {
    const rs = periodRecords(b.start, b.end).filter(filter);
    return { label: b.label, short: b.short, value: rs.length, ids: rs.map((r) => r.id) };
  });
  remember(name, series);
  return columnChart(series, name, unit);
}

function timeByCategory(B) {
  const totals = new Map();
  for (const r of periodRecords(B.from, B.to)) {
    const minutes = r.kind === 'activity' && r.payload && r.payload.duration;
    if (!minutes) continue;
    const id = (r.categoryIds || [])[0] || 'cat-other';
    const t = totals.get(id) || { value: 0, ids: [] };
    t.value += minutes;
    t.ids.push(r.id);
    totals.set(id, t);
  }
  const rows = [...totals].map(([id, t]) => ({ label: categoryById(id).name, hex: categoryById(id).color, value: t.value, ids: t.ids, title: `Time on ${categoryById(id).name}` })).sort((a, b) => b.value - a.value);
  remember('time', rows);
  const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);
  return rows.length ? barList(rows, 'time', hm) : '<span class="muted">No durations recorded in this period. Add minutes when you record an event to see them here.</span>';
}

function byCategory(B) {
  const totals = new Map();
  for (const r of periodRecords(B.from, B.to)) {
    for (const id of r.categoryIds || []) {
      const t = totals.get(id) || { value: 0, ids: [] };
      t.value++;
      t.ids.push(r.id);
      totals.set(id, t);
    }
  }
  const rows = [...totals].map(([id, t]) => ({ label: categoryById(id).name, hex: categoryById(id).color, value: t.value, ids: t.ids })).sort((a, b) => b.value - a.value).slice(0, 10);
  remember('categories', rows);
  return barList(rows, 'categories');
}

function habitsSection(B) {
  const list = activeHabits();
  if (!list.length) return '<span class="muted">No habits yet.</span>';
  const days = Math.round((B.to.getTime() - B.from.getTime()) / 864e5);
  return `<div class="list">${list
    .map((h) => {
      const done = [...daysOf(h)].filter((d) => dayInRange(d, B.from, B.to) && d <= ymd(new Date())).length;
      const elapsed = Math.min(days, Math.round((Date.now() - B.from.getTime()) / 864e5) + 1);
      const expected = h.frequency === 'weekly' ? Math.ceil(elapsed / 7) * (h.target || 1) : elapsed;
      const rate = expected ? Math.min(1, done / expected) : 0;
      const s = habitStats(h);
      return `<button class="row" data-action="openHabit" data-id="${esc(h.id)}">
        <span class="row-text"><span class="body">${esc(h.name)}</span><span class="caption">${done} check-ins · current streak ${s.current} ${s.unit}${s.current === 1 ? '' : 's'} · longest ${s.longest}</span>
        <span class="progress" style="margin-top:4px"><i style="width:${Math.round(rate * 100)}%"></i></span></span>
        <span class="hbar-value">${Math.round(rate * 100)}%</span>
      </button>`;
    })
    .join('')}</div><span class="caption">Share of days (or weekly targets) in this period with a check-in.</span>`;
}

function statesSection(B) {
  const rs = periodRecords(B.from, B.to).filter((r) => r.kind === 'state' || ((r.payload && r.payload.stateIds) || []).length);
  const totals = new Map();
  for (const r of rs) for (const id of (r.payload && r.payload.stateIds) || []) {
    const t = totals.get(id) || { value: 0, ids: [] };
    t.value++;
    t.ids.push(r.id);
    totals.set(id, t);
  }
  const rows = [...totals]
    .map(([id, t]) => {
      const s = data.states.find((x) => x.id === id);
      return s ? { label: s.name, hex: String(s.color || '').replace('#', ''), value: t.value, ids: t.ids } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);
  remember('states', rows);
  return barList(rows, 'states');
}

function ritualsSection(B) {
  const done = periodRecords(B.from, B.to).filter((r) => r.kind === 'ritual');
  const totals = new Map();
  for (const r of done) {
    const id = (r.payload && r.payload.ritualId) || r.title;
    const t = totals.get(id) || { value: 0, ids: [], label: r.title || 'Ritual' };
    t.value++;
    t.ids.push(r.id);
    totals.set(id, t);
  }
  const rows = [...totals.values()].sort((a, b) => b.value - a.value);
  remember('rituals', rows);
  return rows.length ? barList(rows, 'rituals', (v) => `${v}×`) : '<span class="muted">No rituals done in this period.</span>';
}

function projectsSection() {
  const list = data.projects.filter((p) => (p.status || 'active') === 'active');
  if (!list.length) return '<span class="muted">No active projects.</span>';
  return `<div class="hbars">${list
    .map((p) => {
      const pr = progress(p);
      return `<button class="hbar" data-action="openProject" data-id="${esc(p.id)}" aria-label="${esc(`${p.title}: ${pr.done} of ${pr.total} done`)}">
        <span class="hbar-label"><span class="dot" style="background:#${esc(p.color)};width:8px;height:8px"></span>${esc(p.title)}</span>
        <span class="hbar-track"><i style="width:${Math.round(pr.ratio * 100)}%"></i></span><span class="hbar-value">${pr.done}/${pr.total}</span></button>`;
    })
    .join('')}</div>`;
}

// ------------------------------------------------------------ recorded together

/** For each day in the period, the things recorded that day: categories, states, habits checked in, rituals done. */
function dayTokens(B) {
  const byDay = new Map();
  const add = (day, key, label, id) => {
    if (!byDay.has(day)) byDay.set(day, new Map());
    const m = byDay.get(day);
    if (!m.has(key)) m.set(key, { label, ids: [] });
    if (id) m.get(key).ids.push(id);
  };
  for (const r of periodRecords(B.from, B.to)) {
    const day = ymd(new Date(r.occurredAt));
    for (const id of r.categoryIds || []) add(day, `c:${id}`, categoryById(id).name, r.id);
    if (r.kind === 'ritual' && r.payload && r.payload.ritualId) add(day, `r:${r.payload.ritualId}`, `${r.title || 'a ritual'} (ritual)`, r.id);
    for (const id of (r.payload && r.payload.stateIds) || []) {
      const s = data.states.find((x) => x.id === id);
      if (s) add(day, `s:${id}`, s.name, r.id);
    }
  }
  for (const l of data.habitLogs) {
    if (!dayInRange(l.date, B.from, B.to)) continue;
    const h = data.habits.find((x) => x.id === l.habitId);
    if (h) add(l.date, `h:${h.id}`, `${h.name} (habit)`, null);
  }
  return byDay;
}

const MIN_DAYS = 3;
function together(B, limit = 5) {
  const byDay = dayTokens(B);
  const daysWith = new Map();
  for (const [day, m] of byDay) for (const [key, v] of m) {
    if (!daysWith.has(key)) daysWith.set(key, { label: v.label, days: new Set() });
    daysWith.get(key).days.add(day);
  }
  const keys = [...daysWith.keys()].filter((k) => daysWith.get(k).days.size >= MIN_DAYS);
  const findings = [];
  for (const a of keys) for (const b of keys) {
    if (a === b) continue;
    const A = daysWith.get(a);
    const Bk = daysWith.get(b);
    const both = [...A.days].filter((d) => Bk.days.has(d));
    if (both.length < MIN_DAYS) continue;
    findings.push({ a, b, aLabel: A.label, bLabel: Bk.label, both, of: A.days.size, ratio: both.length / A.days.size });
  }
  // keep one direction per pair: the stronger one
  const seen = new Set();
  return findings
    .sort((x, y) => y.ratio - x.ratio || y.both.length - x.both.length)
    .filter((f) => {
      const k = [f.a, f.b].sort().join('|');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit)
    .map((f) => ({ ...f, text: `On ${f.both.length} of the ${f.of} days you recorded ${f.aLabel}, you also recorded ${f.bLabel}.` }));
}

function togetherSection(B) {
  const list = together(B);
  remember('together', list.map((f) => ({ title: `Days with ${f.aLabel} and ${f.bLabel}`, ids: data.records.filter((r) => f.both.includes(ymd(new Date(r.occurredAt))) && !r.archived).map((r) => r.id) })));
  return `${list.length ? `<div class="list">${list.map((f, i) => `<button class="row" data-action="insightOpen" data-key="together" data-i="${i}"><span class="row-text"><span class="body">${esc(f.text)}</span><span class="caption">See those days</span></span>${icon('right', 'chev')}</button>`).join('')}</div>` : `<span class="muted">Nothing has been recorded on the same days often enough yet (at least ${MIN_DAYS} days each).</span>`}
    <span class="caption">This only shows what appeared on the same days. It does not mean one caused the other.</span>`;
}

// ------------------------------------------------------------ month by month

function monthTable() {
  const months = [0, 1, 2].map((i) => addMonths(currentMonth(), -i));
  const rows = [
    ['Recorded', (a, b) => periodRecords(a, b).filter((r) => !isWriting(r)).length],
    ['Journal entries', (a, b) => periodRecords(a, b).filter(isWriting).length],
    ['Rituals done', (a, b) => periodRecords(a, b).filter((r) => r.kind === 'ritual').length],
    ['States logged', (a, b) => periodRecords(a, b).filter((r) => r.kind === 'state').length],
    ['Tasks done', (a, b) => data.tasks.filter((t) => t.done && t.completedAt && inRange(t.completedAt, a, b)).length],
    ['Habit check-ins', (a, b) => data.habitLogs.filter((l) => dayInRange(l.date, a, b)).length],
    ['Plans', (a, b) => data.schedule.filter((p) => dayInRange(p.date, a, b)).length],
  ];
  return `<div class="table-wrap"><table class="table"><thead><tr><th></th>${months.map((m) => `<th>${esc(monthShort(m))}</th>`).join('')}</tr></thead><tbody>${rows
    .map(([label, fn]) => `<tr><th scope="row">${label}</th>${months.map((m) => `<td>${fn(monthStart(m), monthStart(addMonths(m, 1)))}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

// ------------------------------------------------------------ page

function card(title, body, note = '') {
  return `<section class="w"><div class="w-head"><span class="w-title">${esc(title)}</span>${note ? `<span class="caption">${esc(note)}</span>` : ''}</div>${body}</section>`;
}

function viewInsights() {
  OPEN = {};
  const B = buckets();
  const unitLabel = PERIODS[state.insightPeriod].months ? 'by month' : 'by week';
  return `<div class="page tight">
    <h1>Insights</h1>
    <div class="chip-row">${Object.entries(PERIODS).map(([k, p]) => `<button class="pill ${state.insightPeriod === k ? 'on' : ''}" data-action="insightPeriod" data-p="${k}">${p.label}</button>`).join('')}</div>
    <span class="caption">${esc(F.dayMonth.format(B.from))} – ${esc(F.dayMonth.format(addDays(B.to, -1)))} · counted from what is stored on this device. Tap a bar to see its records.</span>
    ${card('In this period', summary(B))}
    ${card('Everything recorded', perBucket(B, (r) => !isWriting(r), 'recorded', ['record', 'records']), unitLabel)}
    ${card('Journal entries', perBucket(B, isWriting, 'journal', ['entry', 'entries']), unitLabel)}
    ${card('Time by category', timeByCategory(B), 'from event durations')}
    ${card('Records by category', byCategory(B))}
    ${card('Habits', habitsSection(B))}
    ${card('How you felt', statesSection(B), 'states logged')}
    ${card('Rituals done', ritualsSection(B))}
    ${card('Projects', projectsSection(), 'now')}
    ${card('Recorded together', togetherSection(B))}
    ${card('Month by month', monthTable())}
  </div>`;
}

function viewList() {
  const L = state.insightList;
  if (!L) return `${navbar('')}<div class="page"></div>`;
  const records = L.ids.map((id) => data.records.find((r) => r.id === id)).filter(Boolean).sort(newestFirst);
  return `${navbar(L.title)}<div class="page tight">
    <span class="caption">${records.length} ${records.length === 1 ? 'record' : 'records'} counted</span>
    ${records.length ? `<div class="list">${records.map((r) => recordRow(r, isPastMonth(recordMonth(r)))).join('')}</div>` : '<div class="blank">Nothing here.</div>'}
  </div>`;
}

// Overview widget: the headline numbers and the strongest "recorded together".
function widget() {
  const B = buckets('w4');
  const top = together(B, 1)[0];
  return `<div class="w-head"><span class="w-title">Insights · last 4 weeks</span><button class="w-link" data-action="goModule" data-id="insights">Open</button></div>
    ${summary(B)}${top ? `<span class="caption">${esc(top.text)}</span>` : ''}`;
}

register({
  nav: { id: 'insights', label: 'Insights', icon: 'chart', order: 2.9 },
  tabs: { insights: viewInsights },
  screens: { insightRecords: () => viewList() },
  widgets: { insights: { label: 'Insights', sizes: ['m'], defaultSize: 'm', render: widget } },
  actions: {
    insightPeriod(el) {
      state.insightPeriod = el.dataset.p;
      render();
    },
    insightOpen(el) {
      const rows = OPEN[el.dataset.key];
      const row = rows && rows[Number(el.dataset.i)];
      if (!row) return;
      state.insightList = { title: row.title, ids: row.ids };
      push({ name: 'insightRecords' });
    },
  },
});

export { together, buckets };
