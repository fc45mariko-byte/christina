/* Themes: long-running parts of your inner life — "My body", "Becoming her", "Beauty". Not the same as
 * Christina's threads, which are spans of time drawn on the calendar.
 * Store 'themes': { id, name, description, color, icon, coverId, order, createdAt, updatedAt }
 * Records (journal, dreams, signs, states, rituals done) and rituals carry `themeIds`. */
import { esc, uuid } from '../../core/util.js';
import { DB, data } from '../../core/db.js';
import { THREAD_COLORS } from '../../core/catalog.js';
import { newestFirst, isPastMonth, recordMonth } from '../../core/queries.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { putItem } from '../../core/repo.js';
import { icon } from '../../ui/icons.js';
import { navbar, swatches, recordRow, toast, fail } from '../../ui/components.js';
import { mediaHTML, addDraftImage, commitDraftImages } from '../../ui/media.js';
import { ritualCard } from '../rituals/index.js';

const ICONS = ['leaf', 'body', 'heart', 'flower', 'sun', 'star', 'home', 'plane', 'sign', 'mind', 'wave', 'people', 'book', 'money', 'candle', 'key'];
state.thf = null;
const themeById = (id) => (data.themes || []).find((t) => t.id === id);
const ordered = () => [...(data.themes || [])].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.createdAt).localeCompare(String(b.createdAt)));
const recordsIn = (id) => data.records.filter((r) => (r.themeIds || []).includes(id) && !r.archived).sort(newestFirst);
const ritualsIn = (id) => data.rituals.filter((r) => (r.themeIds || []).includes(id));

const badge = (t) => `<span class="rthumb" style="background:#${esc(t.color)}2e;color:#${esc(t.color)}">${t.coverId ? mediaHTML(t.coverId) : icon(t.icon || 'leaf')}</span>`;

function viewThemes() {
  const list = ordered();
  return `<div class="page tight">
    <div class="page-head"><h1>Themes</h1><button class="nav-btn strong" data-action="newTheme">${icon('plus')}New</button></div>
    <span class="caption">Long-running parts of your inner life. Add journal entries, dreams, states and rituals to them.</span>
    ${
      list.length
        ? `<div class="list">${list.map((t) => {
            const n = recordsIn(t.id).length + ritualsIn(t.id).length;
            return `<button class="row" data-action="openTheme" data-id="${esc(t.id)}">${badge(t)}<span class="row-text"><span class="body">${esc(t.name)}</span><span class="caption">${esc(t.description || `${n} ${n === 1 ? 'item' : 'items'}`)}</span></span>${icon('right', 'chev')}</button>`;
          }).join('')}</div>`
        : '<div class="blank">No themes yet. Tap New to start one, e.g. “My body” or “Becoming her”.</div>'
    }
  </div>`;
}

function viewTheme(id) {
  const t = themeById(id);
  if (!t) return `${navbar('')}<div class="page"><div class="blank">This theme no longer exists.</div></div>`;
  const records = recordsIn(id);
  const rituals = ritualsIn(id);
  return `${navbar('', `<button class="nav-btn" data-action="editTheme" data-id="${esc(id)}">Edit</button>`)}
  <div class="page">
    ${t.coverId ? `<div class="photo rhero">${mediaHTML(t.coverId, null, { controls: true })}</div>` : ''}
    <div class="row-field" style="justify-content:flex-start;gap:8px"><span class="dot" style="background:#${esc(t.color)};width:14px;height:14px"></span><span class="label">Theme</span></div>
    <h1>${esc(t.name)}</h1>
    ${t.description ? `<p style="margin:0;color:var(--text2)">${esc(t.description)}</p>` : ''}
    <span class="caption">${records.length} ${records.length === 1 ? 'record' : 'records'} · ${rituals.length} ${rituals.length === 1 ? 'ritual' : 'rituals'}</span>
    <div class="row-field" style="gap:8px"><button class="btn-secondary" data-action="newJournal" data-theme="${esc(id)}">${icon('plus')} Write in this theme</button></div>
    ${rituals.length ? `<div class="section"><span class="label">Rituals</span><div class="rgrid">${rituals.map(ritualCard).join('')}</div></div>` : ''}
    <div class="section"><span class="label">Records</span>${records.length ? `<div class="list">${records.map((r) => recordRow(r, isPastMonth(recordMonth(r)))).join('')}</div>` : '<span class="muted">Nothing in this theme yet.</span>'}</div>
  </div>`;
}

function viewThemeEdit() {
  const f = state.thf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  const colors = THREAD_COLORS.includes(f.color) ? THREAD_COLORS : [...THREAD_COLORS, f.color];
  return `${navbar(f._new ? 'New theme' : 'Edit theme', '<button class="nav-btn strong" data-action="saveTheme" data-valid="theme">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Name</span><input class="field" type="text" data-bind="thf.name" value="${esc(f.name)}" placeholder="e.g. Becoming her" autocomplete="off"></div>
    <div class="section"><span class="label">What it holds (optional)</span><input class="field" type="text" data-bind="thf.description" value="${esc(f.description)}" placeholder="e.g. Intentions · Actions · Identity" autocomplete="off"></div>
    <div class="section"><span class="label">Colour</span>${swatches('thf', f.color, colors)}</div>
    <div class="section"><span class="label">Icon</span><div class="chips">${ICONS.map((n) => `<button class="chip${f.icon === n ? ' on' : ''}" style="${f.icon === n ? `background:#${esc(f.color)}` : ''}" data-action="themeIcon" data-icon="${n}" aria-label="${n}" aria-pressed="${f.icon === n}">${icon(n)}</button>`).join('')}</div></div>
    <div class="section"><span class="label">Cover picture (optional)</span><div style="max-width:200px"><div class="sq rslot">${f.coverId ? `${mediaHTML(f.coverId, f._blobs)}<button class="remove-x" data-action="themeCover" aria-label="Remove picture">${icon('x')}</button>` : `<label class="add-tile" aria-label="Add a cover picture">${icon('plus')}<input type="file" accept="image/*" data-file-input="themeCover"></label>`}</div></div></div>
    ${f._new ? '' : `<button class="btn-secondary danger" data-action="deleteTheme" data-id="${esc(f.id)}">Delete theme</button><p class="footnote" style="padding:0">Deleting a theme keeps everything that was in it.</p>`}
  </div>`;
}

register({
  nav: { id: 'themes', label: 'Themes', icon: 'leaf', order: 3.1 },
  tabs: { themes: viewThemes },
  screens: { theme: (v) => viewTheme(v.id), themeEdit: () => viewThemeEdit() },
  validators: { theme: () => !!state.thf && state.thf.name.trim() !== '' && !(data.themes || []).some((t) => t.id !== state.thf.id && t.name.trim().toLowerCase() === state.thf.name.trim().toLowerCase()) },
  actions: {
    openTheme: (el) => push({ name: 'theme', id: el.dataset.id }),
    newTheme() {
      state.thf = { id: uuid(), _new: true, name: '', description: '', color: THREAD_COLORS[2], icon: 'leaf', coverId: null };
      push({ name: 'themeEdit' });
    },
    editTheme(el) {
      const t = themeById(el.dataset.id);
      if (!t) return;
      state.thf = { ...t };
      push({ name: 'themeEdit' });
    },
    themeIcon(el) {
      state.thf.icon = el.dataset.icon;
      render();
    },
    themeCover() {
      state.thf.coverId = null;
      render();
    },
    async saveTheme() {
      const f = state.thf;
      if (!f || !registry.validators.theme()) return;
      const before = themeById(f.id);
      const { _new, _blobs, ...clean } = f;
      const theme = { ...clean, name: f.name.trim(), description: f.description.trim(), order: before ? before.order : (data.themes || []).length };
      try {
        await commitDraftImages(f, [theme.coverId].filter(Boolean), before && before.coverId ? [before.coverId] : []);
        await putItem('themes', theme);
      } catch (error) {
        return fail(error, 'save this theme');
      }
      state.thf = null;
      toast(before ? 'Saved' : 'Theme added');
      back();
      if (!before) push({ name: 'theme', id: theme.id });
    },
    async deleteTheme(el) {
      const id = el.dataset.id;
      if (!confirm('Delete this theme? Everything in it stays.')) return;
      const now = new Date().toISOString();
      const records = data.records.filter((r) => (r.themeIds || []).includes(id)).map((r) => ({ ...r, themeIds: r.themeIds.filter((x) => x !== id), updatedAt: now }));
      const rituals = data.rituals.filter((r) => (r.themeIds || []).includes(id)).map((r) => ({ ...r, themeIds: r.themeIds.filter((x) => x !== id), updatedAt: now }));
      try {
        await DB.write(['themes', 'records', 'rituals'], (tx) => {
          tx.objectStore('themes').delete(id);
          records.forEach((r) => tx.objectStore('records').put(r));
          rituals.forEach((r) => tx.objectStore('rituals').put(r));
        });
      } catch (error) {
        return fail(error, 'delete this theme');
      }
      data.themes = data.themes.filter((t) => t.id !== id);
      records.forEach((r) => Object.assign(data.records.find((x) => x.id === r.id), r));
      rituals.forEach((r) => Object.assign(data.rituals.find((x) => x.id === r.id), r));
      state.thf = null;
      back();
      back();
    },
  },
  fileActions: {
    async themeCover(files) {
      try {
        state.thf.coverId = await addDraftImage(state.thf, files[0]);
      } catch (error) {
        alert(`Photo problem. ${error.message}`);
      }
      render();
    },
  },
});

export { themeById, ordered as orderedThemes };
