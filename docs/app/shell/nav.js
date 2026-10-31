/* Christina — navigation shell.
 *
 * Phone: a tab bar with four slots the person chooses, the + button in the middle, and More at the end.
 *   [slot 1] [slot 2] [+] [slot 3] [slot 4] [More]
 * Modules not in a slot open from More, inside the More tab, with a Back button.
 * Wide screens (≥ 900px): a sidebar lists every module; the tab bar is hidden.
 *
 * Modules declare themselves with register({ nav: { id, label, icon, order } }). The `id` is the
 * module's tab id (its root view is registry.tabs[id]). */
import { $, esc } from '../core/util.js';
import { state } from '../core/state.js';
import { registry } from '../core/registry.js';
import { prefs, Settings } from '../core/prefs.js';
import { icon } from '../ui/icons.js';

const SLOT_COUNT = 4;
const DEFAULT_SLOTS = ['home', 'map', 'journal', 'threads'];
const WIDE = window.matchMedia('(min-width: 900px)');

const navItems = () => [...registry.nav].sort((a, b) => a.order - b.order);
const navItem = (id) => registry.nav.find((n) => n.id === id);
const isWide = () => WIDE.matches;

/** The four tab-bar slots: saved choice, cleaned of unknown or repeated modules, filled from the defaults. */
function tabSlots() {
  const known = new Set(registry.nav.map((n) => n.id));
  const saved = Array.isArray(prefs.tabSlots) ? prefs.tabSlots : [];
  const slots = [];
  for (const id of [...saved, ...DEFAULT_SLOTS, ...navItems().map((n) => n.id)]) {
    if (slots.length === SLOT_COUNT) break;
    if (known.has(id) && !slots.includes(id)) slots.push(id);
  }
  return slots;
}

function setTabSlot(index, id) {
  const slots = tabSlots();
  const other = slots.indexOf(id);
  if (other !== -1) slots[other] = slots[index]; // choosing a module already in another slot swaps the two
  slots[index] = id;
  prefs.tabSlots = slots;
  Settings.write('tabSlots', slots);
}

const isPinned = (id) => tabSlots().includes(id);

/** Shows a module's main screen: as its own tab when it has one, otherwise inside More. */
function openModule(id) {
  if (isWide() || isPinned(id)) {
    state.tab = id;
    state.stacks[id] = [];
  } else {
    state.tab = 'more';
    state.stacks.more = [{ name: 'module', id }];
  }
}

/** Which tab-bar button is lit: the current tab, or More for a module that has no slot. */
function activeTab() {
  if (state.tab === 'add' || state.tab === 'more' || isPinned(state.tab)) return state.tab;
  return 'more';
}

function renderTabBar() {
  const active = activeTab();
  const item = (id, label, ic) =>
    `<button class="tab ${active === id ? 'active' : ''}" data-action="tab" data-tab="${id}" aria-label="${esc(label)}">${icon(ic)}<span>${esc(label)}</span></button>`;
  const slot = (id) => {
    const n = navItem(id);
    return item(id, n.label, n.icon);
  };
  const [a, b, c, d] = tabSlots();
  $('#tabbar').innerHTML =
    slot(a) +
    slot(b) +
    `<div class="tab-add-wrap"><button class="tab-add" data-action="tab" data-tab="add" aria-label="Add">${icon('plus')}</button></div>` +
    slot(c) +
    slot(d) +
    item('more', 'More', 'more');
}

function renderSidebar() {
  const el = $('#sidebar');
  if (!el) return;
  el.innerHTML = `
    <div class="side-brand">Christina</div>
    <button class="side-add ${state.tab === 'add' ? 'active' : ''}" data-action="tab" data-tab="add">${icon('plus')}<span>Add</span></button>
    <div class="side-list">${navItems()
      .map((n) => `<button class="side-item ${state.tab === n.id ? 'active' : ''}" data-action="tab" data-tab="${n.id}">${icon(n.icon)}<span>${esc(n.label)}</span></button>`)
      .join('')}</div>`;
}

function renderNav() {
  renderTabBar();
  renderSidebar();
}

export { navItems, navItem, tabSlots, setTabSlot, isPinned, isWide, openModule, renderNav, SLOT_COUNT, WIDE };
