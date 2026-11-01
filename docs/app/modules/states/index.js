/* States: your own words for how you are (Calm, Heavy, Magnetic…), logged for a day.
 * Store 'states': { id, name, color ('#rrggbb'), description, order, createdAt, updatedAt }
 * A log is a record of kind 'state' with payload.stateIds; it appears in Overview, Calendar, Archive and Insights.
 * Logging: Overview's "How are you?" widget, or + → How are you?. Edit the list in Settings → States. */
import { esc, uuid, ymd } from '../../core/util.js';
import { DB, data } from '../../core/db.js';
import { THREAD_COLORS } from '../../core/catalog.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { putItems } from '../../core/repo.js';
import { icon } from '../../ui/icons.js';
import { navbar, swatches, toast, fail } from '../../ui/components.js';

state.stf = null;
const orderedStates = () => [...data.states].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.createdAt).localeCompare(String(b.createdAt)));
const stateById = (id) => data.states.find((s) => s.id === id);
const colorOf = (s) => String((s && s.color) || '#A9A9A9');

/** Today's single-state log for this state, if any (a log with words in it is never undone by a tap). */
function todayEntry(stateId) {
  const day = ymd(new Date());
  return data.records.find((r) => r.kind === 'state' && ymd(new Date(r.occurredAt)) === day && !r.text && ((r.payload && r.payload.stateIds) || []).length === 1 && r.payload.stateIds[0] === stateId);
}

/** Tap a state: log it for today; tap again: take it back. */
async function toggleToday(stateId) {
  const s = stateById(stateId);
  if (!s) return;
  const existing = todayEntry(stateId);
  if (existing) {
    await DB.write(['records'], (tx) => tx.objectStore('records').delete(existing.id));
    data.records = data.records.filter((r) => r.id !== existing.id);
    return;
  }
  const now = new Date().toISOString();
  const record = { id: uuid(), kind: 'state', occurredAt: now, title: s.name, text: null, categoryIds: [], threadIds: [], themeIds: [], tagIds: [], mediaIds: [], linkedRecordIds: [], payload: { stateIds: [stateId] }, archived: false, createdAt: now, updatedAt: now };
  await DB.write(['records'], (tx) => tx.objectStore('records').put(record));
  data.records.push(record);
}

/** The row of state pills (Overview widget, + → How are you?). */
function statePills() {
  return `<div class="chip-row" style="flex-wrap:wrap">${orderedStates()
    .map((s) => {
      const on = !!todayEntry(s.id);
      return `<button class="pill ${on ? 'on' : ''}" data-action="logStateToday" data-id="${esc(s.id)}" aria-pressed="${on}"><span class="dot" style="background:${esc(colorOf(s))};width:8px;height:8px"></span>${esc(s.name)}</button>`;
    })
    .join('')}</div>`;
}

function viewLog() {
  return `${navbar('How are you?')}<div class="page tight">
    ${data.states.length ? statePills() : '<div class="blank">No states yet.</div>'}
    <span class="caption">Tap what fits today; tap again to take it back.</span>
    <button class="btn-secondary" data-action="openStates">Edit your states</button>
  </div>`;
}

function viewStates() {
  const list = orderedStates();
  return `${navbar('States')}<div class="page tight">
    <div class="settings-list">${list
      .map((s, i) => `<div class="settings-row"><span class="dot" style="background:${esc(colorOf(s))};width:14px;height:14px"></span>
        <button class="grow" style="text-align:left;min-height:44px" data-action="editState" data-id="${esc(s.id)}">${esc(s.name)}</button>
        <button class="arrow" data-action="moveState" data-i="${i}" data-d="-1" aria-label="Move ${esc(s.name)} up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
        <button class="arrow" data-action="moveState" data-i="${i}" data-d="1" aria-label="Move ${esc(s.name)} down" ${i === list.length - 1 ? 'disabled' : ''}>${icon('down')}</button></div>`)
      .join('')}
      <button class="settings-row" data-action="newState">${icon('plus', 'ic')}<span class="grow">Add a state</span></button></div>
    <p class="footnote">Your own words for how you are. They appear in "How are you?" on Overview and in Insights.</p>
  </div>`;
}

function viewStateEdit() {
  const f = state.stf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  const hex = f.color.replace('#', '').toUpperCase();
  const colors = THREAD_COLORS.includes(hex) ? THREAD_COLORS : [...THREAD_COLORS, hex];
  return `${navbar(f._new ? 'New state' : 'Edit state', '<button class="nav-btn strong" data-action="saveState" data-valid="stateItem">Save</button>')}<div class="page">
    <div class="section"><span class="label">Name</span><input class="field" type="text" data-bind="stf.name" value="${esc(f.name)}" placeholder="e.g. Magnetic" autocomplete="off"></div>
    <div class="section"><span class="label">What it feels like (optional)</span><textarea class="field" data-bind="stf.description">${esc(f.description || '')}</textarea></div>
    <div class="section"><span class="label">Colour</span>${swatches('stf', hex, colors)}</div>
    ${f._new ? '' : `<button class="btn-secondary danger" data-action="deleteState" data-id="${esc(f.id)}">Delete state</button><p class="footnote" style="padding:0">Days you logged it keep their record.</p>`}
  </div>`;
}

register({
  kinds: { state: { label: 'State', icon: 'state', open: (r) => push({ name: 'recordView', id: r.id }) } },
  screens: { stateLog: () => viewLog(), states: () => viewStates(), stateEdit: () => viewStateEdit() },
  validators: { stateItem: () => !!state.stf && state.stf.name.trim() !== '' },
  actions: {
    async logStateToday(el) {
      try {
        await toggleToday(el.dataset.id);
      } catch (error) {
        return fail(error, 'save this');
      }
      render();
    },
    openStateLog: () => push({ name: 'stateLog' }),
    openStates: () => push({ name: 'states' }),
    newState() {
      state.stf = { id: uuid(), _new: true, name: '', description: '', color: `#${THREAD_COLORS[4]}` };
      push({ name: 'stateEdit' });
    },
    editState(el) {
      const s = stateById(el.dataset.id);
      if (!s) return;
      state.stf = { ...s, color: colorOf(s) };
      push({ name: 'stateEdit' });
    },
    async saveState() {
      const f = state.stf;
      if (!f || !registry.validators.stateItem()) return;
      const { _new, ...clean } = f;
      const item = { ...clean, name: f.name.trim(), color: `#${String(f.color).replace('#', '')}`, order: _new ? data.states.length : f.order };
      try {
        await putItems('states', [item]);
      } catch (error) {
        return fail(error, 'save this state');
      }
      state.stf = null;
      toast('Saved');
      back();
    },
    async deleteState(el) {
      if (!confirm('Delete this state? Days you logged it keep their record.')) return;
      try {
        await DB.write(['states'], (tx) => tx.objectStore('states').delete(el.dataset.id));
      } catch (error) {
        return fail(error, 'delete this state');
      }
      data.states = data.states.filter((s) => s.id !== el.dataset.id);
      state.stf = null;
      back();
    },
    async moveState(el) {
      const list = orderedStates();
      const i = Number(el.dataset.i);
      const j = i + Number(el.dataset.d);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      try {
        await putItems('states', list.map((s, k) => ({ ...s, order: k })));
      } catch (error) {
        return fail(error, 'reorder states');
      }
      render();
    },
  },
});

export { statePills, orderedStates, stateById, toggleToday };
