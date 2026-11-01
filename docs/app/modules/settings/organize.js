/* Settings → Categories, Tags and Sections: the person's own organization.
 * Categories are shared by every section (events, journal, tasks, plans, habits, and the calendar's
 * colours). "Other" always exists: anything whose category is deleted is shown under it. */
import { esc, uuid } from '../../core/util.js';
import { DB, data } from '../../core/db.js';
import { OTHER_CATEGORY_ID, THREAD_COLORS } from '../../core/catalog.js';
import { prefs, Settings } from '../../core/prefs.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { putItems } from '../../core/repo.js';
import { icon } from '../../ui/icons.js';
import { navbar, catIcon, swatches, toast, fail } from '../../ui/components.js';

const ICONS = ['book', 'briefcase', 'activity', 'users', 'user', 'home', 'heart', 'more', 'palette', 'camera', 'folder', 'flag', 'clock', 'repeat', 'journal', 'chart', 'eye', 'calendar', 'bell', 'body', 'mind', 'ritual', 'dream', 'leaf', 'sun', 'plane', 'money', 'flower', 'star', 'people', 'study', 'sign'];
const sortCategories = () => data.categories.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
state.cf = null;
state.tagf = null;

// ------------------------------------------------------------ Categories

function viewCategories() {
  const list = sortCategories();
  return `${navbar('Categories')}<div class="page tight">
    <div class="settings-list">${list
      .map((c, i) => `<div class="settings-row">
        ${catIcon(c.id, 28)}
        <button class="grow" style="text-align:left;min-height:44px" data-action="editCategory" data-id="${esc(c.id)}">${esc(c.name)}</button>
        <button class="arrow" data-action="moveCategory" data-i="${i}" data-d="-1" aria-label="Move ${esc(c.name)} up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
        <button class="arrow" data-action="moveCategory" data-i="${i}" data-d="1" aria-label="Move ${esc(c.name)} down" ${i === list.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
      </div>`)
      .join('')}
      <button class="settings-row" data-action="newCategory">${icon('plus', 'ic')}<span class="grow">Add a category</span></button>
    </div>
    <p class="footnote">Categories are shared everywhere: events, journal, plans, tasks and habits. Their colours are the calendar's colours. A month with its own palette recolours them by position.</p>
  </div>`;
}

function viewCategoryEdit() {
  const f = state.cf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  const colors = THREAD_COLORS.includes(f.color) ? THREAD_COLORS : [...THREAD_COLORS, f.color];
  return `${navbar(f.id ? 'Edit category' : 'New category', '<button class="nav-btn strong" data-action="saveCategory" data-valid="category">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Name</span><input class="field" type="text" data-bind="cf.name" value="${esc(f.name)}" autocomplete="off"></div>
    <div class="section"><span class="label">Colour</span>${swatches('cf', f.color, colors)}
      <div class="field row-field"><span>Another colour</span><input type="color" data-bind="cf.custom" value="#${esc(f.color)}" data-change="categoryCustomColor" style="width:44px;height:32px;border:0;background:none;padding:0" aria-label="Pick any colour"></div>
    </div>
    <div class="section"><span class="label">Icon</span>
      <div class="chips">${ICONS.map((n) => `<button class="chip${f.icon === n ? ' on' : ''}" style="${f.icon === n ? `background:#${esc(f.color)}` : ''}" data-action="categoryIcon" data-icon="${n}" aria-label="${n}" aria-pressed="${f.icon === n}">${icon(n)}</button>`).join('')}</div>
    </div>
    ${f.id && f.id !== OTHER_CATEGORY_ID ? `<button class="btn-secondary danger" data-action="deleteCategory" data-id="${esc(f.id)}">Delete category</button><p class="footnote" style="padding:0">Records in a deleted category are shown under Other.</p>` : ''}
  </div>`;
}

// ------------------------------------------------------------ Tags

function tagUses(id) {
  return data.records.filter((r) => (r.tagIds || []).includes(id)).length;
}
function viewTags() {
  const list = [...data.tags].sort((a, b) => a.name.localeCompare(b.name));
  return `${navbar('Tags')}<div class="page tight">
    ${list.length ? `<div class="settings-list">${list.map((t) => `<button class="settings-row" data-action="editTag" data-id="${esc(t.id)}"><span class="grow">${esc(t.name)}</span><span class="caption">${tagUses(t.id)}</span>${icon('right', 'chev')}</button>`).join('')}</div>` : '<div class="blank">No tags yet. Add them to journal entries.</div>'}
    <p class="footnote">Tags are made when you type them on a journal entry.</p>
  </div>`;
}
function viewTagEdit() {
  const f = state.tagf;
  if (!f) return `${navbar('')}<div class="page"></div>`;
  return `${navbar('Tag', '<button class="nav-btn strong" data-action="saveTag" data-valid="tag">Save</button>')}<div class="page">
    <div class="section"><span class="label">Name</span><input class="field" type="text" data-bind="tagf.name" value="${esc(f.name)}" autocomplete="off"></div>
    <span class="caption">Used on ${tagUses(f.id)} ${tagUses(f.id) === 1 ? 'entry' : 'entries'}.</span>
    <button class="btn-secondary danger" data-action="deleteTag" data-id="${esc(f.id)}">Delete tag</button>
  </div>`;
}

// ------------------------------------------------------------ Sections

const ALWAYS = ['home', 'settings'];
function viewSections() {
  const hidden = new Set(prefs.hiddenModules || []);
  const items = [...registry.nav].filter((n) => !ALWAYS.includes(n.id)).sort((a, b) => a.order - b.order);
  return `${navbar('Sections')}<div class="page tight">
    <div class="settings-list">${items
      .map((n) => `<div class="settings-row">${icon(n.icon, 'ic')}<span class="grow">${esc(n.label)}</span><label class="toggle"><input type="checkbox" data-change="toggleSection" data-id="${n.id}" ${hidden.has(n.id) ? '' : 'checked'} aria-label="Show ${esc(n.label)}"><span></span></label></div>`)
      .join('')}</div>
    <p class="footnote">Hidden sections leave the tab bar, More and the sidebar. Nothing is deleted, and what they hold still shows elsewhere (Overview, Calendar, Archive). Overview and Settings are always shown.</p>
  </div>`;
}

register({
  screens: {
    categories: () => viewCategories(),
    categoryEdit: () => viewCategoryEdit(),
    tags: () => viewTags(),
    tagEdit: () => viewTagEdit(),
    sections: () => viewSections(),
  },
  validators: {
    category: () => !!state.cf && state.cf.name.trim() !== '' && !data.categories.some((c) => c.id !== state.cf.id && c.name.trim().toLowerCase() === state.cf.name.trim().toLowerCase()),
    tag: () => !!state.tagf && state.tagf.name.trim() !== '',
  },
  actions: {
    openTags: () => push({ name: 'tags' }),
    openSections: () => push({ name: 'sections' }),
    newCategory() {
      state.cf = { id: null, name: '', color: THREAD_COLORS[7], icon: 'more', custom: '' };
      push({ name: 'categoryEdit' });
    },
    editCategory(el) {
      const c = data.categories.find((x) => x.id === el.dataset.id);
      if (!c) return;
      state.cf = { id: c.id, name: c.name, color: c.color, icon: c.icon || 'more', custom: '' };
      push({ name: 'categoryEdit' });
    },
    categoryIcon(el) {
      state.cf.icon = el.dataset.icon;
      render();
    },
    async saveCategory() {
      const f = state.cf;
      if (!f || !registry.validators.category()) return;
      const existing = f.id ? data.categories.find((c) => c.id === f.id) : null;
      const category = { ...(existing || { id: uuid(), order: data.categories.length, preset: false }), name: f.name.trim(), color: f.color, icon: f.icon };
      try {
        await putItems('categories', [category]);
      } catch (error) {
        return fail(error, 'save this category');
      }
      sortCategories();
      state.cf = null;
      toast('Saved');
      back();
    },
    async deleteCategory(el) {
      const id = el.dataset.id;
      if (id === OTHER_CATEGORY_ID || !confirm('Delete this category? Records in it will be shown under Other.')) return;
      try {
        await DB.write(['categories'], (tx) => tx.objectStore('categories').delete(id));
      } catch (error) {
        return fail(error, 'delete this category');
      }
      data.categories = data.categories.filter((c) => c.id !== id);
      state.cf = null;
      back();
    },
    async moveCategory(el) {
      const list = [...sortCategories()];
      const i = Number(el.dataset.i);
      const j = i + Number(el.dataset.d);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      try {
        // Renumber everything so orders stay 0..n-1.
        await putItems('categories', list.map((c, k) => ({ ...c, order: k })));
      } catch (error) {
        return fail(error, 'reorder categories');
      }
      sortCategories();
      render();
    },
    editTag(el) {
      const t = data.tags.find((x) => x.id === el.dataset.id);
      if (!t) return;
      state.tagf = { id: t.id, name: t.name };
      push({ name: 'tagEdit' });
    },
    async saveTag() {
      const f = state.tagf;
      const t = f && data.tags.find((x) => x.id === f.id);
      if (!t || !registry.validators.tag()) return;
      try {
        await putItems('tags', [{ ...t, name: f.name.trim() }]);
      } catch (error) {
        return fail(error, 'rename this tag');
      }
      back();
    },
    async deleteTag(el) {
      const id = el.dataset.id;
      if (!confirm('Delete this tag? It is removed from every entry that has it.')) return;
      const changed = data.records.filter((r) => (r.tagIds || []).includes(id)).map((r) => ({ ...r, tagIds: r.tagIds.filter((x) => x !== id), updatedAt: new Date().toISOString() }));
      try {
        await DB.write(['tags', 'records'], (tx) => {
          tx.objectStore('tags').delete(id);
          changed.forEach((r) => tx.objectStore('records').put(r));
        });
      } catch (error) {
        return fail(error, 'delete this tag');
      }
      data.tags = data.tags.filter((t) => t.id !== id);
      changed.forEach((r) => Object.assign(data.records.find((x) => x.id === r.id), r));
      back();
    },
  },
  changeActions: {
    categoryCustomColor(el) {
      if (!state.cf) return;
      state.cf.color = el.value.replace('#', '').toUpperCase();
      render();
    },
    toggleSection(el) {
      const hidden = new Set(prefs.hiddenModules || []);
      if (el.checked) hidden.delete(el.dataset.id);
      else hidden.add(el.dataset.id);
      prefs.hiddenModules = [...hidden];
      Settings.write('hiddenModules', prefs.hiddenModules);
      render();
    },
  },
});
