/* Christina — the More tab (modules without a tab-bar slot) and Settings → Navigation. */
import { esc } from '../core/util.js';
import { state, push } from '../core/state.js';
import { registry, register } from '../core/registry.js';
import { render } from '../core/render.js';
import { icon } from '../ui/icons.js';
import { navbar } from '../ui/components.js';
import { navItems, navItem, tabSlots, setTabSlot, SLOT_COUNT } from './nav.js';

function viewMore() {
  const slots = tabSlots();
  const rest = navItems().filter((n) => !slots.includes(n.id));
  return `<div class="page"><h1>More</h1>
    ${
      rest.length
        ? `<div class="settings-list">${rest
            .map((n) => `<button class="settings-row" data-action="openModule" data-id="${n.id}">${icon(n.icon, 'ic')}<span class="grow">${esc(n.label)}</span>${icon('right', 'chev')}</button>`)
            .join('')}</div>`
        : ''
    }
    <div class="settings-list">
      <button class="settings-row" data-action="openNavigation">${icon('grid', 'ic')}<span class="grow">Tab bar</span>${icon('right', 'chev')}</button>
    </div>
    <p class="footnote">Choose which four sections sit in the tab bar. Everything else opens from here.</p>
  </div>`;
}

/** A module's main screen opened from More: its usual page with a Back button above it. */
function viewModule(view) {
  const n = navItem(view.id);
  const root = registry.tabs[view.id];
  if (!n || !root) return `${navbar('')}<div class="page"><div class="blank">This section is not available.</div></div>`;
  return navbar('') + root();
}

function viewNavigation() {
  const slots = tabSlots();
  const options = (selected) =>
    navItems()
      .map((n) => `<option value="${n.id}" ${n.id === selected ? 'selected' : ''}>${esc(n.label)}</option>`)
      .join('');
  return `${navbar('Tab bar')}<div class="page tight">
    <div class="settings-list">${slots
      .map(
        (id, i) => `<div class="settings-row"><span class="grow">${i < 2 ? `Left ${i + 1}` : `Right ${i - 1}`}</span>
          <select data-change="setTabSlot" data-slot="${i}" aria-label="Tab ${i + 1}" style="border:0;background:none;font-size:16px;color:var(--text2);text-align:right">${options(id)}</select>
        </div>`
      )
      .join('')}</div>
    <p class="footnote">The + button and More always stay in the tab bar. Picking a section that is already in another place swaps the two. On a wide screen every section is listed in the sidebar.</p>
  </div>`;
}

register({
  tabs: { more: viewMore },
  screens: {
    module: viewModule,
    navigation: () => viewNavigation(),
  },
  actions: {
    openModule(el) {
      push({ name: 'module', id: el.dataset.id });
    },
    openNavigation() {
      push({ name: 'navigation' });
    },
  },
  changeActions: {
    setTabSlot(el) {
      const index = Number(el.dataset.slot);
      if (index >= 0 && index < SLOT_COUNT && navItem(el.value)) setTabSlot(index, el.value);
      render();
    },
  },
});

export { viewMore };
