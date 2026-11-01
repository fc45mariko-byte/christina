/* Overview: a dashboard of widgets the person arranges. Christina's month view is one of them ("This month").
 * Layout (saved per device, `christina.dashboard`): { columns: 2|1, widgets: [{ id, size, on }] }.
 * Saved layouts (`christina.dashboardLayouts`): [{ name, layout }]. Presets: Christina, Plan, Reflect, Everything, Minimal. */
import { esc, F, $ } from '../../core/util.js';
import { prefs, Settings } from '../../core/prefs.js';
import { state, push } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { navbar, toast } from '../../ui/components.js';
import { openModule } from '../../shell/nav.js';
import './widgets.js';
import { moonSVG, moonName } from '../../ui/moon.js';

const layoutOf = (columns, list) => ({ columns, widgets: list.map(([id, size, on = true]) => ({ id, size, on })) });
/** Built when used, so widgets registered by later modules are included in “Everything”. */
const presets = () => ({
  Christina: layoutOf(2, [['reminders', 'm'], ['tonight', 'm'], ['today', 's'], ['habits', 's'], ['states', 'm'], ['month', 'l'], ['tasks', 'm'], ['upcoming', 'm'], ['rituals', 'm'], ['journal', 's'], ['projects', 's'], ['week', 'm']]),
  Plan: layoutOf(2, [['reminders', 'm'], ['today', 'l'], ['tasks', 'l'], ['upcoming', 'm'], ['projects', 'm'], ['habits', 's'], ['clock', 's']]),
  Reflect: layoutOf(1, [['reminders', 'm'], ['tonight', 'm'], ['states', 'l'], ['journal', 'l'], ['rituals', 'm'], ['habits', 'm'], ['month', 'l'], ['week', 'm']]),
  Everything: layoutOf(2, Object.keys(registry.widgets).map((id) => [id, registry.widgets[id].defaultSize])),
  Minimal: layoutOf(1, [['reminders', 'm'], ['month', 'l']]),
});
const DEFAULT = 'Christina';
prefs.dashboard = Settings.read('dashboard', null);
prefs.dashboardLayouts = Settings.read('dashboardLayouts', []);
state.dash = { name: '' };

const clone = (x) => JSON.parse(JSON.stringify(x));
/** The current layout, with any widget that is new since it was saved added at the end (switched off). */
function layout() {
  const base = prefs.dashboard || clone(presets()[DEFAULT]);
  const have = new Set(base.widgets.map((w) => w.id));
  const widgets = base.widgets.filter((w) => registry.widgets[w.id]).map((w) => ({ ...w, size: registry.widgets[w.id].sizes.includes(w.size) ? w.size : registry.widgets[w.id].defaultSize }));
  for (const id of Object.keys(registry.widgets)) if (!have.has(id)) widgets.push({ id, size: registry.widgets[id].defaultSize, on: false });
  return { columns: base.columns === 1 ? 1 : 2, widgets };
}
function saveLayout(next) {
  prefs.dashboard = next;
  Settings.write('dashboard', next);
}

function viewHome() {
  const L = layout();
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  const hint =
    !standalone && !prefs.hideInstallHint
      ? `<div class="install-hint">${icon('share')}<p>To install: tap <b>Share</b>, then <b>Add to Home Screen</b>.</p><button data-action="hideHint">Hide</button></div>`
      : '';
  const cells = L.widgets
    .filter((w) => w.on)
    .map((w) => {
      const def = registry.widgets[w.id];
      const html = def.render(w.size);
      if (!html) return '';
      const wide = L.columns === 1 || w.size !== 's';
      return `<section class="w${def.bare ? ' bare' : ''}${wide ? ' wide' : ''}" data-widget="${w.id}" aria-label="${esc(def.label)}">${html}</section>`;
    })
    .join('');
  return `<div class="page tight">
    ${hint}
    <div class="page-head"><span class="caption" style="display:inline-flex;align-items:center;gap:6px">${esc(F.weekdayDayMonth.format(new Date()))} <span title="${esc(moonName())}">${moonSVG()}</span></span><button class="nav-btn" data-action="editDashboard" aria-label="Customize Overview">${icon('sliders')}Customize</button></div>
    <div class="wgrid">${cells || '<div class="blank wide">Every widget is switched off. Tap Customize to choose some.</div>'}</div>
  </div>`;
}

// ------------------------------------------------------------ Customize

function viewEdit() {
  const L = layout();
  const sizeName = { s: 'Small', m: 'Medium', l: 'Large' };
  const presetPills = Object.keys(presets()).map((name) => `<button class="pill" data-action="applyLayout" data-preset="${esc(name)}">${esc(name)}</button>`).join('');
  const saved = prefs.dashboardLayouts || [];
  return `${navbar('Customize Overview')}
  <div class="page">
    <div class="section"><span class="label">Layouts</span>
      <div class="chip-row">${presetPills}</div>
      ${saved.length ? `<div class="chip-row">${saved.map((s, i) => `<span class="pill" style="padding-right:4px"><button data-action="applyLayout" data-saved="${i}">${esc(s.name)}</button><button class="arrow" style="width:28px;height:28px" data-action="deleteLayout" data-saved="${i}" aria-label="Delete layout ${esc(s.name)}">${icon('x')}</button></span>`).join('')}</div>` : ''}
      <div class="row-field"><input class="field" type="text" data-bind="dash.name" placeholder="Name this layout to save it" autocomplete="off"><button class="nav-btn strong" data-action="saveLayoutAs">Save</button></div>
    </div>
    <div class="section"><span class="label">Columns</span>
      <div class="segmented"><button class="${L.columns === 2 ? 'on' : ''}" data-action="dashColumns" data-c="2">Two</button><button class="${L.columns === 1 ? 'on' : ''}" data-action="dashColumns" data-c="1">One</button></div>
      <span class="caption">With two columns, small widgets sit side by side.</span>
    </div>
    <div class="section"><span class="label">Widgets</span>
      <div class="settings-list">${L.widgets
        .map((w, i) => {
          const def = registry.widgets[w.id];
          return `<div class="settings-row" style="flex-wrap:wrap;padding-top:8px;padding-bottom:8px">
            <label class="toggle"><input type="checkbox" data-change="toggleWidget" data-i="${i}" ${w.on ? 'checked' : ''} aria-label="Show ${esc(def.label)}"><span></span></label>
            <span class="grow"><span class="body">${esc(def.label)}</span>${def.hint ? `<br><span class="caption">${esc(def.hint)}</span>` : ''}</span>
            <button class="arrow" data-action="moveWidget" data-i="${i}" data-d="-1" aria-label="Move ${esc(def.label)} up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
            <button class="arrow" data-action="moveWidget" data-i="${i}" data-d="1" aria-label="Move ${esc(def.label)} down" ${i === L.widgets.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
            ${def.sizes.length > 1 ? `<div class="segmented" style="flex-basis:100%">${def.sizes.map((s) => `<button class="${w.size === s ? 'on' : ''}" data-action="sizeWidget" data-i="${i}" data-s="${s}">${sizeName[s]}</button>`).join('')}</div>` : ''}
          </div>`;
        })
        .join('')}</div>
    </div>
    <button class="btn-secondary" data-action="applyLayout" data-preset="${DEFAULT}">Reset to the default layout</button>
  </div>`;
}

function update(fn) {
  const L = clone(layout());
  fn(L);
  saveLayout(L);
  render();
}

// Keep "Date and time" current without redrawing the page.
setInterval(() => {
  document.querySelectorAll('[data-clock]').forEach((el) => (el.textContent = F.time.format(new Date())));
}, 20000);

register({
  nav: { id: 'home', label: 'Overview', icon: 'home', order: 1 },
  tabs: { home: viewHome },
  screens: { dashboardEdit: () => viewEdit() },
  actions: {
    hideHint() {
      prefs.hideInstallHint = true;
      Settings.write('hideInstallHint', true);
      render();
    },
    editDashboard: () => push({ name: 'dashboardEdit' }),
    goModule(el) {
      openModule(el.dataset.id);
      render();
    },
    moveWidget(el) {
      const i = Number(el.dataset.i);
      const j = i + Number(el.dataset.d);
      update((L) => {
        if (j < 0 || j >= L.widgets.length) return;
        [L.widgets[i], L.widgets[j]] = [L.widgets[j], L.widgets[i]];
      });
    },
    sizeWidget: (el) => update((L) => (L.widgets[Number(el.dataset.i)].size = el.dataset.s)),
    dashColumns: (el) => update((L) => (L.columns = Number(el.dataset.c))),
    applyLayout(el) {
      const source = el.dataset.preset ? presets()[el.dataset.preset] : (prefs.dashboardLayouts[Number(el.dataset.saved)] || {}).layout;
      if (!source) return;
      saveLayout(clone(source));
      toast(`Layout: ${el.dataset.preset || prefs.dashboardLayouts[Number(el.dataset.saved)].name}`);
      render();
    },
    saveLayoutAs() {
      const name = (state.dash.name || '').trim();
      if (!name) return toast('Give the layout a name first');
      const list = (prefs.dashboardLayouts || []).filter((s) => s.name.toLowerCase() !== name.toLowerCase());
      list.push({ name, layout: clone(layout()) });
      prefs.dashboardLayouts = list;
      Settings.write('dashboardLayouts', list);
      state.dash.name = '';
      toast(`Saved “${name}”`);
      render();
    },
    deleteLayout(el) {
      const i = Number(el.dataset.saved);
      const list = [...(prefs.dashboardLayouts || [])];
      const [gone] = list.splice(i, 1);
      if (!gone || !confirm(`Delete the layout “${gone.name}”?`)) return;
      prefs.dashboardLayouts = list;
      Settings.write('dashboardLayouts', list);
      render();
    },
  },
  changeActions: {
    toggleWidget: (el) => update((L) => (L.widgets[Number(el.dataset.i)].on = el.checked)),
  },
});
